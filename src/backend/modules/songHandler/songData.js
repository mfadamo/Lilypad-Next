// backend/modules/songHandler/songData.js
const UAF2BlueStar = require('../songParser/UAF2BlueStar.js');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const existsAsync = promisify(fs.exists);
const { writeTempFile } = require('../utils/tempFileManager');
var decodeDXT = require('decode-dxt'),
    parseDDS = require('parse-dds');

class SongDataLoader {
    constructor(gamevar) {
        this.gamevar = gamevar;
        this.isUbiArt = false;
        // Check if it's a local path (starts with / or, on Windows, with drive letter followed by :)
        this.isLocal = gamevar.selectedBase && (gamevar.selectedBase.startsWith('/') || /^[a-zA-Z]:/.test(gamevar.selectedBase));
        this.modelsBuffer = [];
        this.cachedResponses = new Map();
    }

    async fetchData(urlOrPath, binary = false) {
        const cacheKey = `${urlOrPath}_${binary}`;
        if (this.cachedResponses.has(cacheKey)) {
            return this.cachedResponses.get(cacheKey);
        }

        let response;
        if (this.isLocal) {
            try {
                const normalizedPath = path.normalize(urlOrPath);
                
                if (!await existsAsync(normalizedPath)) {
                    throw new Error(`File not found: ${normalizedPath}`);
                }

                const options = binary ? null : 'utf8';
                const content = await readFileAsync(normalizedPath, options);

                response = {
                    ok: true,
                    text: () => Promise.resolve(binary ? content.toString() : content),
                    json: () => Promise.resolve(JSON.parse((binary ? content.toString() : content).replace(/\x00/g, ''))),
                    buffer: () => Promise.resolve(content),
                    arrayBuffer: () => Promise.resolve(content.buffer)
                };
            } catch (err) {
                response = { ok: false, error: err.message };
            }
        } else {
            try {
                response = await fetch(urlOrPath);
            } catch (err) {
                response = { ok: false, error: err.message };
            }
        }

        this.cachedResponses.set(cacheKey, response);
        return response;
    }

    async listDirectory(dirPath) {
        const cacheKey = `dir_${dirPath}`;
        if (this.cachedResponses.has(cacheKey)) {
            return this.cachedResponses.get(cacheKey);
        }

        let response;
        if (this.isLocal) {
            try {
                const normalizedPath = path.normalize(dirPath);
                const files = await readdirAsync(normalizedPath);
                
                response = {
                    ok: true,
                    json: () => Promise.resolve(files)
                };
            } catch (err) {
                response = { ok: false, error: err.message };
            }
        } else {
            try {
                response = await fetch(dirPath);
            } catch (err) {
                response = { ok: false, error: err.message };
            }
        }

        this.cachedResponses.set(cacheKey, response);
        return response;
    }

    getFullPath(relativePath) {
        if (this.isLocal) {
            // Handle Windows path properly and remove any leading slashes from relativePath
            const cleanRelativePath = relativePath.replace(/^\/+/, '');
            return path.normalize(path.join(this.gamevar.selectedBase, cleanRelativePath));
        } else {
            const base = this.gamevar.selectedBase.endsWith('/') 
                ? this.gamevar.selectedBase.slice(0, -1) 
                : this.gamevar.selectedBase;
            const relPath = relativePath.startsWith('/') 
                ? relativePath.slice(1) 
                : relativePath;
            return `${base}/${relPath}`;
        }
    }

    async parseJsonResponse(response) {
        const text = await response.text();
        return JSON.parse(text.replace(/\x00/g, ''));
    }
    
    async loadMSMModels() {
        try {
            // Try multiple possible directories where MSM files might be located
            const possibleDirs = [
                'timeline/moves/wiiu',
                'timeline/moves/msm',
                'timeline/moves'
            ];
            
            let modelFiles = [];
            
            // Try each directory
            for (const dir of possibleDirs) {
                const dirPath = this.getFullPath(dir);
                const dirResponse = await this.listDirectory(dirPath);
                
                if (dirResponse.ok) {
                    const files = await dirResponse.json();
                    const msmFiles = files.filter(file => file.toLowerCase().endsWith('.msm'));
                    
                    if (msmFiles.length > 0) {
                        console.log(`Found ${msmFiles.length} MSM files in ${dir}`);
                        
                        const loadedModels = await Promise.all(
                            msmFiles.map(async filename => {
                                try {
                                    const filePath = this.getFullPath(`${dir}/${filename}`);
                                    const response = await this.fetchData(filePath, true);
                                    
                                    if (response.ok) {
                                        const buffer = await response.buffer();
                                        return {
                                            name: filename,
                                            arrayBuffer: Array.from(new Uint8Array(buffer))
                                        };
                                    }
                                    return null;
                                } catch (err) {
                                    console.error(`Error loading MSM file ${filename}:`, err);
                                    return null;
                                }
                            })
                        );
                        
                        modelFiles = modelFiles.concat(loadedModels.filter(model => model !== null));
                    }
                }
            }
            
            if (modelFiles.length > 0) {
                console.log(`Successfully loaded ${modelFiles.length} MSM model files`);
                this.modelsBuffer = modelFiles;
                return modelFiles;
            } else {
                console.log('No MSM model files found');
                return [];
            }
        } catch (err) {
            console.error('Error loading MSM models:', err);
            return [];
        }
    }

    async fetchDataAndPlaySong() {
        try {
            // First try UbiArt format - non-blocking
            // This also loads MSM files in parallel
            const ubiArtPromise = this.tryLoadUbiArt();
            
            // Start loading pictos while waiting for song data - parallel loading
            let pictosPromise;
            
            // Check UbiArt result
            const ubiArtData = await ubiArtPromise;
            if (ubiArtData) {
                this.isUbiArt = true;
                pictosPromise = this.loadUbiArtPictos();
                return { data: ubiArtData, pictos: await pictosPromise, modelsBuffer: this.modelsBuffer };
            }

            // Fallback to BlueStar format
            const jsonPath = this.getFullPath(`${this.gamevar.cdn}.json`);
            console.log('Loading BlueStar data from:', jsonPath);

            const response = await this.fetchData(jsonPath);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.error || 'Unknown error'}`);
            }

            const jsona = await response.text();
            let data = this.parseJsonData(jsona);

            if (!this.isLocal && this.gamevar.selectedBase.includes('https://jdnow-api-contentapistoragest.justdancenow.com')) {
                this.gamevar.selectedBase += "/assets/web";
            }

            // Load moves data in parallel
            const [moves0, moves1, moves2, moves3] = await Promise.all([
                this.loadMoves("moves0"),
                this.loadMoves("moves1"),
                this.loadMoves("moves2"),
                this.loadMoves("moves3")
            ]);

            data.moves0 = moves0;
            data.moves1 = moves1;
            data.moves2 = moves2;
            data.moves3 = moves3;

            // Try to load MSM models for BlueStar format too
            await this.loadMSMModels();
            
            // Load pictos atlas
            const pictosatlas = await this.loadPictosAtlas();
            
            // Ensure we return the modelsBuffer with the result
            return { data, pictos: pictosatlas, modelsBuffer: this.modelsBuffer };
        } catch (err) {
            console.error('Error fetching data and playing song:', err);
            return { data: {}, pictos: this.getDefaultAtlas(), modelsBuffer: [] };
        }
    }

    async tryLoadUbiArt() {
        try {
            const baseDir = this.getFullPath('');
            const prefix = this.gamevar.cdn.toLowerCase();
            
            // Start MSM loading in parallel
            const msmLoadingPromise = this.loadMSMModels();
            
            // Parallel fetching of all required files
            const [dtapeRes, ktapeRes, musictrackRes, songdescRes, mainsequenceRes] = await Promise.all([
                this.fetchData(this.getFullPath(`timeline/${prefix}_tml_dance.dtape.ckd`)),
                this.fetchData(this.getFullPath(`timeline/${prefix}_tml_karaoke.ktape.ckd`)),
                this.fetchData(this.getFullPath(`audio/${prefix}_musictrack.tpl.ckd`)),
                this.fetchData(this.getFullPath('songdesc.tpl.ckd')),
                this.fetchData(this.getFullPath(`cinematics/${prefix}_mainsequence.tape.ckd`)),
            ]);

            if (!dtapeRes.ok || !ktapeRes.ok || !musictrackRes.ok || !songdescRes.ok || !mainsequenceRes.ok) {
                // Continue MSM loading even if UbiArt loading fails
                await msmLoadingPromise;
                return null;
            }

            const converter = new UAF2BlueStar();
            
            // Clean and parse JSON in parallel
            const [dtape, ktape, musictrack, songdesc, mainsequence] = await Promise.all([
                this.parseJsonResponse(dtapeRes),
                this.parseJsonResponse(ktapeRes),
                this.parseJsonResponse(musictrackRes),
                this.parseJsonResponse(songdescRes),
                this.parseJsonResponse(mainsequenceRes)
            ]);
            
            // Wait for MSM loading to complete
            await msmLoadingPromise;
            
            converter.processJsonData(dtape, ktape, musictrack, songdesc, mainsequence);
            return converter.getSongData(false);
        } catch (err) {
            console.log('Not a UbiArt format, falling back to BlueStar', err);
            return null;
        }
    }

    async loadUbiArtPictos() {
        function arrayBufferFromBuffer(buf, start = 0, len = buf.length - start) {
            return buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + start + len);
        }
    
        console.log('Re-cooking UbiArt DirectDraw-Surface to RGBA Data');
        let cooked = 0;
        let error = 0;
    
        try {
            const pictoFiles = await this.listDirectory(this.getFullPath('timeline/pictos/'));
            if (!pictoFiles.ok) throw new Error('Pictos directory not found');
            const pictoList = await pictoFiles.json();
    
            const atlas = {
                isUbiArt: true,
                imageSize: { width: 256, height: 256 },
                images: {},
                decodedImages: {}
            };
    
            // Process files in batches to avoid memory spikes
            const BATCH_SIZE = 10;
            const batches = [];
            
            for (let i = 0; i < pictoList.length; i += BATCH_SIZE) {
                batches.push(pictoList.slice(i, i + BATCH_SIZE));
            }
            
            for (const batch of batches) {
                const batchResults = await Promise.all(batch.map(async (fileName) => {
                    let id, fileBuffer;
                    let needsDecoding = false;
        
                    if (fileName.endsWith('.png.ckd') || fileName.endsWith('.dds') || fileName.endsWith('.tga.ckd')) {
                        id = fileName.replace(/\.(png|tga)\.ckd$|\.dds$/, '');
                        needsDecoding = true;
                    } else if (fileName.endsWith('.png')) {
                        id = fileName.replace('.png', '');
                        needsDecoding = false;
                    } else {
                        return null; // skip unsupported
                    }
        
                    const filePath = this.getFullPath(`timeline/pictos/${fileName}`);
        
                    try {
                        const response = await this.fetchData(filePath, true);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch ${fileName}`);
                        }
                        
                        fileBuffer = await response.buffer();
                        atlas.images[id] = [0, 0];
        
                        if (needsDecoding) {
                            try {
                                const magicOffset = 0x2C;
                                const ddsArrayBuffer = arrayBufferFromBuffer(fileBuffer, magicOffset);
                                const ddsData = parseDDS(ddsArrayBuffer);
        
                                const ddsImage = ddsData.images[0];
                                const imageWidth = ddsImage.shape[0];
                                const imageHeight = ddsImage.shape[1];
                                const imageDataView = new DataView(ddsArrayBuffer, ddsImage.offset, ddsImage.length);
        
                                const rgbaData = decodeDXT(imageDataView, imageWidth, imageHeight, ddsData.format);
        
                                // Save the raw RGBA data to a temporary file
                                // The renderer will need to know the width and height to interpret this raw data.
                                const tempFilePath = await writeTempFile(`picto-${id}`, Buffer.from(rgbaData), 'raw');
        
                                atlas.decodedImages[id] = {
                                    path: tempFilePath,
                                    width: imageWidth,
                                    height: imageHeight
                                };
        
                                cooked++;
                                return true;
                            } catch (e) {
                                error++;
                                console.warn(`Failed to decode or save ${id}:`, e);
                                return false;
                            }
                        }
                        return true;
                    } catch (err) {
                        console.warn(`Error loading picto ${id}:`, err);
                        return false;
                    }
                }));
                
                // add a small delay between batches to allow GC to work
                await new Promise(resolve => setTimeout(resolve, 10));
            }
    
            console.log(`Cooked ${cooked} pictos, ${error} errors`);
            return atlas;
        } catch (err) {
            console.error('Error loading UbiArt pictos:', err);
            return this.getDefaultAtlas();
        }
    }

    async loadMoves(MovesNumber = "moves0") {
        try {
            let fetchPath = `${this.gamevar.cdn}_${MovesNumber}.json`;

            if (!this.isLocal && this.gamevar.selectedBase.includes('justdancenow.com')) {
                fetchPath = `data/moves/${fetchPath}`;
            }

            const fullPath = this.getFullPath(fetchPath);
            const response = await this.fetchData(fullPath);

            if (!response.ok) {
                console.warn(`Moves file not found: ${MovesNumber}`);
                return {};
            }

            const jsona = await response.text();
            let data = {};

            try {
                // Handle \x00 in JSON files
                const cleanJson = jsona.replace(/\x00/g, '');
                data = JSON.parse(cleanJson);
                
                // Handle possible different format where moves are under a specific key
                if (data.moves0 && MovesNumber === "moves0") {
                    return data;
                }
            } catch (err) {
                try {
                    // Try alternative parsing approach if standard parsing fails
                    const startIndex = jsona.indexOf('{');
                    const endIndex = jsona.lastIndexOf('}') + 1;
                    
                    if (startIndex >= 0 && endIndex > startIndex) {
                        const jsonSubstring = jsona.substring(startIndex, endIndex);
                        data = JSON.parse(jsonSubstring.replace(/\x00/g, ''));
                    } else {
                        // Last resort - try the original approach
                        const a = jsona.substring(this.gamevar.cdn.length + 2, jsona.lastIndexOf(')'));
                        data = JSON.parse(a.replace(/\x00/g, ''));
                    }
                } catch (finalErr) {
                    console.error(`Failed to parse ${MovesNumber}:`, finalErr);
                    return {};
                }
            }

            return data;
        } catch (err) {
            console.error(`Error loading moves ${MovesNumber}:`, err);
            return {};
        }
    }

    async loadPictosAtlas() {
        try {
            let fetchPath = `pictos-atlas.json`;

            if (!this.isLocal && this.gamevar.selectedBase.includes('justdancenow.com')) {
                fetchPath = `data/pictos/${fetchPath}`;
            }

            const fullPath = this.getFullPath(fetchPath);
            const response = await this.fetchData(fullPath);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            return await response.json();
        } catch (err) {
            console.error('Error loading pictos atlas:', err);
            return this.getDefaultAtlas();
        }
    }

    parseJsonData(jsona) {
        try {
            // Remove null characters from JSON
            return JSON.parse(jsona.replace(/\x00/g, ''));
        } catch (err) {
            try {
                // Try alternative parsing approach
                const a = jsona.substring(this.gamevar.cdn.length + 1, jsona.lastIndexOf(')'));
                return JSON.parse(a.replace(/\x00/g, ''));
            } catch (finalErr) {
                console.error('Failed to parse JSON:', finalErr);
                // Return an empty object instead of throwing to prevent app crash
                return {};
            }
        }
    }

    getDefaultAtlas() {
        return {
            "NoSprite": true,
            "imageSize": {
                "width": 256,
                "height": 256
            },
            "images": {
                "placeholder": [0, 0]
            }
        };
    }

    // Set models buffer from external source
    setModelsBuffer(models) {
        if (Array.isArray(models)) {
            this.modelsBuffer = models;
            console.log(`Set models buffer with ${models.length} models`);
        } else {
            console.error('Invalid models buffer format. Expected array of {name, arrayBuffer} objects');
        }
    }

    // Clear cache if needed
    clearCache() {
        this.cachedResponses.clear();
        console.log('Response cache cleared');
    }
}

module.exports = SongDataLoader;
