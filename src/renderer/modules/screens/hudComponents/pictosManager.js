import BrokenTexture from '../../../../assets/texture/texturesbroken.png';

class PictosManager {
    constructor(gamevar) {
        this.gamevar = gamevar;
        this.atlas = null;  // Store the atlas
        this.activeAnimations = [];  // Track active picto animations
    }

    // Add a method to set the atlas
    setAtlas(atlas) {
        this.atlas = atlas;
        console.log(this.atlas);
    }

    ShowPictos(cdn, atlas, SlideDuration, DisappearDuration, size) {
        const pictos = document.createElement('div');
        pictos.className = "picto";
        pictos.innerHTML = '<canvas class="texture"></canvas><span class="currentPictos"></span>';
        
        const texture = pictos.querySelector('.texture');
        const currentPictos = pictos.querySelector('.currentPictos');
        const width = size.split('x');
        texture.width = width[0];
        texture.height = width[1];
        
        const context = texture.getContext('2d');
        
        // Instead of checking for 'a', check if it's UbiArt format
        if (this.atlas && this.atlas.isUbiArt) {
            if (this.atlas.decodedImages && this.atlas.decodedImages[cdn]) {
                // Decoded DXT data
                const imageInfo = this.atlas.decodedImages[cdn];
            
                fetch(imageInfo.path)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to fetch raw image data from ${cleanedPath}`);
                        }
                        return response.arrayBuffer();
                    })
                    .then(arrayBuffer => {
                        const rgbaData = new Uint8ClampedArray(arrayBuffer);
                        texture.width = imageInfo.width;
                        texture.height = imageInfo.height;
                        const imageData = context.createImageData(imageInfo.width, imageInfo.height);
                        
                        for (let i = 0; i < rgbaData.length; i++) {
                            imageData.data[i] = rgbaData[i];
                        }
                        
                        context.putImageData(imageData, 0, 0);
                    })
                    .catch(error => {
                        console.error(`Error loading raw picto data for ${cdn}:`, error);
                        const image = new Image();
                        image.src = BrokenTexture;
                        image.onload = function() {
                            texture.width = this.width;
                            texture.height = this.height;
                            context.drawImage(image, 0, 0);
                        };
                        currentPictos.textContent = cdn;
                        pictos.classList.add('broken');
                    });
            } else {
                // Regular PNG within UbiArt structure
                const image = new Image();
                image.src = `${this.gamevar.selectedBase}/timeline/pictos/${cdn}.png`;
                image.onerror = function() {
                    image.src = BrokenTexture;
                    currentPictos.textContent = cdn;
                    pictos.classList.add('broken');
                };
                image.onload = function() {
                    texture.width = this.width;
                    texture.height = this.height;
                    context.drawImage(image, 0, 0);
                };
            }
        } else if (cdn === 'a' && atlas) {  // Traditional atlas format (BlueStar)
            const image = new Image();
            // Check if we actually have a pictos-atlas.png for BlueStar format
            const atlasPath = `${this.gamevar.selectedBase}/pictos-atlas.png`;
            
            // First check if the atlas file exists
            if (this.gamevar.isLocal) {
                const fs = require('fs');
                if (!fs.existsSync(this.gamevar.selectedBase + '/pictos-atlas.png')) {
                    // Fallback to individual pictos
                    console.warn('pictos-atlas.png not found, falling back to individual pictos');
                    this._loadIndividualPicto(cdn, texture, currentPictos);
                    return;
                }
            }
            
            image.src = atlasPath;
            image.onload = function() {
                context.drawImage(image, atlas[0] * -1, atlas[1] * -1, this.width, this.height);
            };
            image.onerror = () => {
                console.warn('Atlas loading failed, falling back to individual pictos');
                this._loadIndividualPicto(cdn, texture, currentPictos);
            };
        } else {  // Individual pictos for other BlueStar formats
            this._loadIndividualPicto(cdn, texture, currentPictos);
        }

        // Check if #pictos has multi-coach class before deciding animation
        const pictosContainer = document.querySelector('#pictos');
        const isMultiCoach = pictosContainer.classList.contains('multi-coach');
        
        // Store picto information for tracking
        const pictosInfo = {
            element: pictos,
            showTime: null, // Will be set when added to DOM
            startVideoTime: null, // Will be set when added to DOM
            slideDuration: SlideDuration,
            disappearDuration: DisappearDuration,
            isHiding: false
        };
        
        // Add picto to the DOM
        document.querySelector('#pictos').appendChild(pictos);
        
        if (!isMultiCoach) {
            pictos.style.animation = `PictosScrollSolo ${SlideDuration}ms linear`;
        } else {
            pictos.style.animation = `PictosScroll ${SlideDuration}ms linear`;
        }
        
        this.activeAnimations.push(pictosInfo);
        return pictosInfo;
    }

    _loadIndividualPicto(cdn, texture, currentPictos) {
        const image = new Image();
        const context = texture.getContext('2d');
        
        image.src = `${this.gamevar.selectedBase}/${cdn}.png`;
        image.onerror = function() {
            image.src = BrokenTexture;
            currentPictos.textContent = cdn;
            texture.parentElement.classList.add('broken');
        };
        image.onload = function() {
            texture.width = this.width;
            texture.height = this.height;
            context.drawImage(image, 0, 0);
        };
    }

    hidePictos(pictos, DisappearDuration) {
        // Start Hide
        pictos.style.animation = `PictosHide ${DisappearDuration}ms`;

        // Remove after animation completes
        setTimeout(() => {
            // Remove
            pictos.remove();
        }, DisappearDuration);
    }
    
    // Updated method to check pictos animations based on video time
    updatePictosAnimations(currentVideoTime) {
        // Check all active animations
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const pictoInfo = this.activeAnimations[i];
            
            // Initialize timing information if not set
            if (pictoInfo.startVideoTime === null) {
                pictoInfo.startVideoTime = currentVideoTime;
                pictoInfo.showTime = Date.now();
            }
            
            // Calculate elapsed video time
            const elapsedVideoTime = currentVideoTime - pictoInfo.startVideoTime;
            
            // If slide animation is complete and not already hiding
            if (elapsedVideoTime >= pictoInfo.slideDuration && !pictoInfo.isHiding) {
                // Start hide animation
                pictoInfo.isHiding = true;
                this.hidePictos(pictoInfo.element, pictoInfo.disappearDuration);
                
                // Remove from active animations after hide completes
                setTimeout(() => {
                    const index = this.activeAnimations.indexOf(pictoInfo);
                    if (index > -1) {
                        this.activeAnimations.splice(index, 1);
                    }
                }, pictoInfo.disappearDuration);
            }
        }
    }
}

export default PictosManager
