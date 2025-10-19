import sfxSprite from '../../../assets/audio/ui/sfx-sprite.mp3';

export class SFXManager {
    static audioContext = null;
    static audioBuffer = null;
    static isLoading = false;
    static sprites = {
        click: { start: 0, duration: 0.2 },
        pop: { start: 0.2, duration: 0.1 },
        transitionIn: { start: 3.000, duration: 1.500 },
        explodeGM: { start: 4.909, duration: 1.803 },
        aspirationGM: { start: 6.752, duration: 1.557 },
        star1: { start: 51.856, duration: 1.962 },
        star2: { start: 53.898, duration: 1.962 },
        star3: { start: 55.539, duration: 1.962 },
        star4: { start: 57.978, duration: 1.962 },
        star5: { start: 60.523, duration: 1.962 },
        obtainStar: { start: 66.648, duration: 0.976 },
        superstar: { start: 68.588, duration: 5.301 },
        megastar: { start: 78.500, duration: 5.741 },
        crown: { start: 85.739, duration: 0.925 },
        recapGauge: { start: 33.727, duration: 5.600 },
        recapApplause: { start: 45.255, duration: 6.238 }
    };

    static async init() {
        if (this.audioContext) {
            return;
        }
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('SFXManager initialized with audio context');
            
            // Load and decode audio file
            await this._loadAudio(sfxSprite);
            this._unlockAudio();
        } catch (error) {
            console.error('Error initializing SFXManager:', error);
        }
    }

    static async _loadAudio(url) {
        if (this.isLoading || this.audioBuffer) {
            return;
        }

        this.isLoading = true;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('Audio buffer loaded successfully');
        } catch (error) {
            console.error('Error loading or decoding audio:', error);
        } finally {
            this.isLoading = false;
        }
    }

    static _unlockAudio() {
        if (this.audioContext.state === 'suspended') {
            const unlock = () => {
                this.audioContext.resume().then(() => {
                    console.log('AudioContext resumed successfully');
                });
                
                document.body.removeEventListener('touchstart', unlock);
                document.body.removeEventListener('touchend', unlock);
                document.body.removeEventListener('click', unlock);
            };

            document.body.addEventListener('touchstart', unlock, false);
            document.body.addEventListener('touchend', unlock, false);
            document.body.addEventListener('click', unlock, false);
            
            // Also try to resume on page visibility change
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.audioContext.resume().catch(console.error);
                }
            });
        }
    }

    static async play(soundId, volume = 1) {
        await this.init();
        
        if (!this.audioBuffer) {
            console.warn('Audio buffer not loaded yet, trying to load it now');
            await this._loadAudio(sfxSprite);
            if (!this.audioBuffer) {
                console.error('Failed to load audio buffer');
                return;
            }
        }

        if (!this.sprites[soundId]) {
            console.warn(`Sound ID "${soundId}" not found in sprites`);
            return;
        }

        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.audioBuffer;
            
            // Create a gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;
            
            // Connect source to gain, gain to destination
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            const sprite = this.sprites[soundId];
            source.start(0, sprite.start, sprite.duration);
            
            return source;
        } catch (error) {
            console.error(`Error playing sound "${soundId}":`, error);
        }
    }

    static async playSfx(start, end, volume = 1) {
        await this.init();
        
        if (!this.audioBuffer) {
            console.warn('Audio buffer not loaded yet');
            await this._loadAudio(sfxSprite);
            if (!this.audioBuffer) {
                return;
            }
        }

        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.audioBuffer;
            
            // Create a gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;
            
            // Connect source to gain, gain to destination
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            source.start(0, start / 1000, (end - start) / 1000);
            
            return source; 
        } catch (error) {
            console.error('Error playing custom sound:', error);
        }
    }
    
    // Method to stop all sounds if needed
    static stopAll() {
        if (this.audioContext) {
            this.audioContext.close().then(() => {
                this.audioContext = null;
                this.audioBuffer = null;
                console.log('Audio context closed');
            }).catch(console.error);
        }
    }
}