const fs = require('fs').promises;
const path = require('path');
const { pathToFileURL } = require('url');

class SongListFiller {
  constructor(gameDir) {
    this.gameDir = gameDir;
    this.mapsDir = path.join(gameDir);
  }

  async fetchSongList() {
    try {
      const directories = await fs.readdir(this.mapsDir);
      const songPromises = directories.map(dir => this.processSongDirectory(dir));

      // Process all song directories
      const songs = await Promise.all(songPromises);

      // Filter out null entries (directories that didn't have valid song data)
      return songs.filter(song => song !== null);
    } catch (error) {
      console.error('Error fetching song list:', error);
      throw new Error(`Failed to fetch song list: ${error.message}`);
    }
  }

  async processSongDirectory(dirName) {
    const dirPath = path.join(this.mapsDir, dirName);

    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) return null;

      const files = await fs.readdir(dirPath);

      // Check which type of song format we're dealing with
      if (files.includes(`${dirName}.json`)) {
        // JSON format
        return await this.processJsonSong(dirPath, dirName);
      } else if (files.includes('songdesc.tpl.ckd')) {
        // UbiArt format
        return await this.processUbiArtSong(dirPath, dirName);
      } else {
        // Try to find any JSON file
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        if (jsonFiles.length > 0) {
          return await this.processJsonSong(dirPath, jsonFiles[0].replace('.json', ''));
        }
      }

      return null;
    } catch (error) {
      console.error(`Error processing directory ${dirName}:`, error);
      return null;
    }
  }

  async processJsonSong(dirPath, songName) {
    try {
      const jsonPath = path.join(dirPath, `${songName}.json`);
      let content = await fs.readFile(jsonPath, 'utf8');

      // Handle JSONP format (e.g., SavageLove({...})) or smth
      if (content.trim().startsWith(songName)) {
        content = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
      }

      const songData = JSON.parse(content);

      // Process assets
      const assets = await this.processJsonAssets(dirPath, songName, songData);

      return this.formatSongData(songData, assets, songName);
    } catch (error) {
      console.error(`Error processing JSON song ${songName}:`, error);
      return null;
    }
  }

  async processUbiArtSong(dirPath, dirName) {
    try {
      const songdescPath = path.join(dirPath, 'songdesc.tpl.ckd');
      let content = await fs.readFile(songdescPath, 'utf8');

      // Remove null bytes that might cause JSON parse issues (ubiart ahh moment)
      content = content.replace(/\x00/g, '');

      const songdescData = JSON.parse(content);
      const songData = songdescData.COMPONENTS.find(c => c.__class === 'JD_SongDescTemplate');

      if (!songData) return null;

      // Process assets for UbiArt
      const assets = await this.processUbiArtAssets(dirPath, songData);

      return this.formatSongData(songData, assets, songData.MapName);
    } catch (error) {
      console.error(`Error processing UbiArt song ${dirName}:`, error);
      return null;
    }
  }

  async processJsonAssets(dirPath, songName, songData) {
    const assetsDir = path.join(dirPath, 'assets');
    let assets = {};
  
    try {
      const assetFiles = await fs.readdir(assetsDir);
  
      for (const file of assetFiles) {
        const filePath = path.join(assetsDir, file);
        const fileUrl = pathToFileURL(filePath).href;
        const lowerFile = file.toLowerCase();
  
        if (lowerFile.includes('cover')) {
          if (lowerFile.includes('generic') || lowerFile.includes('1024')) {
            assets.coverImageUrl = fileUrl;
          } else if (lowerFile.includes('phone')) {
            assets.phoneCoverImageUrl = fileUrl;
          } else {
            assets.coverImageUrl = fileUrl;
          }
        } else if (lowerFile.includes('coach')) {
          const coachMatch = lowerFile.match(/coach[_\-]?(\d+)/); // match Coach_1, Coach-1, Coach1
          if (coachMatch) {
            const coachNum = coachMatch[1];
            if (lowerFile.includes('phone')) {
              assets[`phoneCoach${coachNum}ImageUrl`] = fileUrl;
            } else {
              assets[`coach${coachNum}ImageUrl`] = fileUrl;
            }
          }
        } else if (lowerFile.includes('preview') && lowerFile.includes('video')) {
          assets.videoPreviewVideoURL = fileUrl;
        }
      }
    } catch (error) {
      console.log(`No assets directory for ${songName}`);
    }
  
    if (songData.assets) {
      assets = { ...assets, ...songData.assets };
    }
  
    return assets;
  }
  
  async processUbiArtAssets(dirPath, songData, gameDir) {
    const assets = {};
    const menuartDir = path.join(dirPath, 'menuart');
  
    try {
      const files = await fs.readdir(menuartDir);
  
      for (const file of files) {
        const filePath = path.join(menuartDir, file);
        const fileUrl = pathToFileURL(filePath).href;
        const lowerFile = file.toLowerCase();
  
        if (lowerFile.includes('cover')) {
          if (lowerFile.includes('phone')) {
            assets.phoneCoverImageUrl = fileUrl;
          } else if (lowerFile.includes('1024')) {
            assets.cover_1024ImageUrl = fileUrl;
          } else if (lowerFile.includes('generic')) {
            assets.coverImageUrl = fileUrl;
          } else if (lowerFile.includes('online') || lowerFile.includes('small')) {
            assets.cover_smallImageUrl = fileUrl;
          } else if (lowerFile.includes('albumbkg') || lowerFile.includes('expandbkg')) {
            assets.expandBkgImageUrl = fileUrl;
          } else if (lowerFile.includes('albumcoach') || lowerFile.includes('expandcoach')) {
            assets.expandCoachImageUrl = fileUrl;
          } else {
            assets.coverImageUrl = fileUrl;
          }
        } else if (lowerFile.includes('coach')) {
          const coachMatch = lowerFile.match(/coach[_\-]?(\d)/);
          if (coachMatch) {
            const coachNum = coachMatch[1];
            if (lowerFile.includes('phone')) {
              assets[`phoneCoach${coachNum}ImageUrl`] = fileUrl;
            } else {
              assets[`coach${coachNum}ImageUrl`] = fileUrl;
            }
          }
        } else if (lowerFile.includes('banner') && lowerFile.includes('bkg')) {
          assets.banner_bkgImageUrl = fileUrl;
        } else if (lowerFile.includes('map_bkg')) {
          assets.map_bkgImageUrl = fileUrl;
        }
      }
    } catch (error) {
      console.log(`No menuart directory for ${songData?.MapName || 'unknown song'}`);
    }
  
    if (songData.PhoneImages && typeof gameDir === 'string') {
      try {
        if (typeof songData.PhoneImages.cover === 'string') {
          const phoneCoverPath = path.join(gameDir, songData.PhoneImages.cover);
          assets.phoneCoverImageUrl = pathToFileURL(phoneCoverPath).href;
        }
  
        const numCoaches = typeof songData.NumCoach === 'number' ? songData.NumCoach : 0;
        for (let i = 1; i <= numCoaches; i++) {
          const coachKey = `coach${i}`;
          if (typeof songData.PhoneImages[coachKey] === 'string') {
            const phoneCoachPath = path.join(gameDir, songData.PhoneImages[coachKey]);
            assets[`phoneCoach${i}ImageUrl`] = pathToFileURL(phoneCoachPath).href;
          }
        }
      } catch (err) {
        console.warn(`Error processing PhoneImages for ${songData?.MapName || 'unknown song'}:`, err.message);
      }
    }
  
    return assets;
  }
  


  formatSongData(songData, assets, mapName) {
    return {
      mapName: mapName || songData.MapName,
      title: songData.Title || '',
      artist: songData.Artist || '',
      credits: songData.Credits || '',
      coachCount: songData.NumCoach || 0,
      difficulty: songData.Difficulty || 0,
      originalJDVersion: songData.OriginalJDVersion || songData.JDVersion || 0,
      jdVersion: songData.JDVersion || 0,
      status: songData.Status || 3,
      lyricsType: songData.LyricsType || 0,
      lyricsColor: this.formatLyricsColor(songData),
      assets: assets,
      songColors: this.formatSongColors(songData.DefaultColors),
      tags: songData.Tags || [],
      audioPreviewData: songData.AudioPreview || songData.audioPreviewData
    };
  }

  formatLyricsColor(songData) {
    if (songData.lyricsColor) {
      return songData.lyricsColor;
    } else if (songData.DefaultColors && songData.DefaultColors.lyrics) {
      const lyrics = songData.DefaultColors.lyrics;
      if (Array.isArray(lyrics) && lyrics.length === 4) {
        return `#${Math.round(lyrics[1] * 255).toString(16).padStart(2, '0')}${Math.round(lyrics[2] * 255).toString(16).padStart(2, '0')}${Math.round(lyrics[3] * 255).toString(16).padStart(2, '0')}`;
      }
    }
    return "#FFFFFF";
  }

  formatSongColors(defaultColors) {
    if (!defaultColors) return null;

    const songColors = {};

    if (Array.isArray(defaultColors.songcolor_1a)) {
      songColors.songColor_1A = this.arrayColorToHex(defaultColors.songcolor_1a);
      songColors.songColor_1B = this.arrayColorToHex(defaultColors.songcolor_1b);
      songColors.songColor_2A = this.arrayColorToHex(defaultColors.songcolor_2a);
      songColors.songColor_2B = this.arrayColorToHex(defaultColors.songcolor_2b);
    } else {
      songColors.songColor_1A = defaultColors.songColor_1A || defaultColors.songcolor_1a;
      songColors.songColor_1B = defaultColors.songColor_1B || defaultColors.songcolor_1b;
      songColors.songColor_2A = defaultColors.songColor_2A || defaultColors.songcolor_2a;
      songColors.songColor_2B = defaultColors.songColor_2B || defaultColors.songcolor_2b;
    }

    return songColors;
  }

  arrayColorToHex(colorArray) {
    if (!colorArray || colorArray.length < 4) return "#FFFFFFFF";

    // Format: [alpha, r, g, b]
    const alpha = Math.round(colorArray[0] * 255).toString(16).padStart(2, '0');
    const r = Math.round(colorArray[1] * 255).toString(16).padStart(2, '0');
    const g = Math.round(colorArray[2] * 255).toString(16).padStart(2, '0');
    const b = Math.round(colorArray[3] * 255).toString(16).padStart(2, '0');

    return `#${r}${g}${b}${alpha}`;
  }

  async fetchDataAndPlaySong() {
    return await this.fetchSongList();
  }
}

module.exports = SongListFiller;