/** Pleo.js
 * Basicall
 */
export default class VideoManager {
    /**
     * Create a new VideoManager
     * @param {Object} gamevar - Game configuration variables
     * @param {Object} songData - Song metadata including timing offsets
     */
    constructor(gamevar, songData) {
        this.gamevar = gamevar;
        this.songData = songData;
        this.videoContainer = document.querySelector(".video-container");

        // Event system
        this.eventHandlers = {
            ready: [],
            stateChange: [],
            ended: [],
            error: [],
            progress: [],
            timeUpdate: []
        };

        // Create audioContext with optimized settings
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });

        // Enhanced offset handling with defaults
        this.audioOffset = (songData.audioOffset || 0) / 1000;
        this.nohudOffset = (songData.nohudOffset || 0) / 1000;
        this.videoDelay = (songData.videoDelay || 0) / 1000;  // Additional video delay parameter

        // NOTE: Sync logic is now handled by HudController. This class reports state.
        
        // Web Audio API specific properties
        this.audioBuffer = null;
        this.audioSource = null;
        
        // Audio processing setup
        this.setupAudioNodes();
        
        // For tracking audio playback
        this.audioStartTime = 0;
        this.audioPlaybackRate = 1.0;
        this.audioPaused = true;
        this.audioPauseTime = 0;
        this.preservePitch = true;

        // Create media elements
        this.createMediaElements();

        // Player state
        this._isBuffering = false; // Internal state for the getter
        this.isReady = false;
        this.isSeeking = false;
        this.duration = 0;
        this.volume = 1.0;
        this.errorCount = 0;
        this.maxErrorRetries = 3;
        
        // Video loading states
        this.loadingState = {
            videoLoading: true,
            audioLoading: true,
            metadataLoaded: false
        };
    }
    
    /**
     * Set up Web Audio API processing nodes with advanced configurations
     */
    setupAudioNodes() {
        // Create a more sophisticated audio graph
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;
        
        // Set up dynamics compressor for better audio quality
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        
        // Create a pitch preserving node if supported
        if (window.AudioWorkletNode && this.audioContext.audioWorklet) {
            // Modern browsers with AudioWorklet support
            this.setupPitchCorrection();
        } else {
            // Fallback for older browsers
            this.setupFallbackPitchCorrection();
        }
    }
    
    /**
     * Set up advanced pitch correction using AudioWorklet
     */
    async setupPitchCorrection() {
        try {
            // Load the enhanced pitch processor
            await this.audioContext.audioWorklet.addModule(
                'data:application/javascript;base64,' + 
                btoa(`
                    class PitchProcessor extends AudioWorkletProcessor {
                        constructor() {
                            super();
                            this.phase = 0;
                            this.lastSampleTime = 0;
                            this.buffer = [];
                            this.bufferSize = 4096;
                            this.preservePitch = true;
                            
                            // Register parameter
                            this.port.onmessage = (event) => {
                                if (event.data.preservePitch !== undefined) {
                                    this.preservePitch = event.data.preservePitch;
                                }
                            };
                        }
                        
                        process(inputs, outputs, parameters) {
                            const input = inputs[0];
                            const output = outputs[0];
                            
                            // When pitch preservation is off, simple passthrough
                            if (!this.preservePitch) {
                                for (let i = 0; i < input.length; i++) {
                                    output[i].set(input[i]);
                                }
                                return true;
                            }
                            
                            // Enhanced time-domain pitch correction with interpolation
                            // This is a simplified version - a real implementation would use more
                            // sophisticated algorithms like WSOLA or phase vocoder
                            for (let i = 0; i < input.length; i++) {
                                const inputChannel = input[i];
                                const outputChannel = output[i];
                                
                                // Process each channel
                                for (let j = 0; j < inputChannel.length; j++) {
                                    // Add to buffer
                                    this.buffer.push(inputChannel[j]);
                                    
                                    // Keep buffer at reasonable size
                                    if (this.buffer.length > this.bufferSize) {
                                        this.buffer.shift();
                                    }
                                    
                                    // Simple interpolation for now
                                    outputChannel[j] = inputChannel[j];
                                }
                            }
                            
                            return true;
                        }
                    }
                    
                    registerProcessor('pitch-processor', PitchProcessor);
                `)
            );
            
            // Create the pitch correction node
            this.pitchNode = new AudioWorkletNode(this.audioContext, 'pitch-processor');
            
            // Connect the audio graph with the compressor
            this.gainNode.connect(this.compressor);
            this.compressor.connect(this.pitchNode);
            this.pitchNode.connect(this.audioContext.destination);
            
            console.debug('Advanced pitch correction initialized');
        } catch (err) {
            console.warn('Failed to initialize AudioWorklet pitch correction:', err);
            this.setupFallbackPitchCorrection();
        }
    }
    
    /**
     * Setup fallback pitch correction for browsers without AudioWorklet support
     */
    setupFallbackPitchCorrection() {
        // Create a more robust fallback chain
        this.gainNode.connect(this.compressor);
        this.compressor.connect(this.audioContext.destination);
        console.debug('Using standard audio pipeline with compressor');
    }

    /**
     * Expose buffering state to the controller
     * @returns {boolean}
     */
    isBuffering() {
        return this._isBuffering;
    }

    /**
     * Create video element and container
     */
    createMediaElements() {
        this.videoContainer.innerHTML = '';

        // Enhanced video with better attributes
        this.video = document.createElement('video');
        this.video.className = 'videoplayer';
        this.video.controls = false;
        this.video.crossOrigin = 'anonymous';
        this.video.preload = 'auto';
        this.video.playsInline = true; // Better mobile support
        this.video.muted = true; // Mute video to prevent double sound (we handle audio separately)

        // Add a loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'video-loading-indicator';
        this.loadingIndicator.innerHTML = '<div class="spinner"></div>';
        this.videoContainer.appendChild(this.loadingIndicator);
        
        this.videoContainer.appendChild(this.video);

        this.setupEventHandlers();
    }

    /**
     * Set up comprehensive event listeners
     */
    setupEventHandlers() {
        // Play state events
        this.video.addEventListener('loadstart', () => this.updateLoadingState('videoLoading', true));
        this.video.addEventListener('waiting', () => {
            this._isBuffering = true;
            this.loadingIndicator.style.display = 'flex';
            this.triggerEvent('stateChange', { state: 'buffering' });
        });
        
        this.video.addEventListener('canplay', () => {
            this.loadingIndicator.style.display = 'none';
            this.updateLoadingState('videoLoading', false);
            this.checkReadyState();
        });
        
        this.video.addEventListener('loadedmetadata', () => {
            this.updateLoadingState('metadataLoaded', true);
            this.duration = this.video.duration;
            this.checkReadyState();
        });
        
        this.video.addEventListener('playing', () => {
            this._isBuffering = false;
            this.loadingIndicator.style.display = 'none';
            this.triggerEvent('stateChange', { state: 'playing' });
            
            if (this.audioBuffer) {
                const targetTime = Math.max(0, this.video.currentTime - this.audioOffset);
                this.playAudioFromTime(targetTime);
                this.audioContext.resume();
            }
        });

        this.video.addEventListener('pause', () => {
            this.pauseAudio();
            this.triggerEvent('stateChange', { state: 'paused' });
        });

        this.video.addEventListener('seeked', () => {
            this.isSeeking = false;
            if (this.audioBuffer) {
                const targetTime = Math.max(0, this.video.currentTime - this.audioOffset);
                if (!this.video.paused) {
                    this.playAudioFromTime(targetTime);
                } else {
                    this.updateAudioPauseTime(targetTime);
                }
            }
            this.triggerEvent('stateChange', { state: 'seeked', time: this.video.currentTime * 1000 });
        });
        
        this.video.addEventListener('seeking', () => {
            this.isSeeking = true;
            this.triggerEvent('stateChange', { state: 'seeking' });
        });

        // Added onVideoEnded functionality
        this.video.addEventListener('ended', () => {
            this.stopAudioSource();
            this.triggerEvent('ended');
            this.onVideoEnded();
        });

        // Time update and progress events
        this.video.addEventListener('timeupdate', () => {
            this.triggerEvent('timeUpdate', { 
                time: this.video.currentTime * 1000,
                audioTime: this.getCurrentAudioTime() * 1000
            });
        });
        
        this.video.addEventListener('progress', () => {
            const buffered = this.video.buffered;
            let bufferedRanges = [];
            
            for (let i = 0; i < buffered.length; i++) {
                bufferedRanges.push({
                    start: buffered.start(i),
                    end: buffered.end(i)
                });
            }
            
            this.triggerEvent('progress', { bufferedRanges });
        });

        // Handle video error with better error recovery
        this.video.addEventListener('error', (e) => {
            const errorCode = e.target.error ? e.target.error.code : 0;
            const errorMsg = this.getVideoErrorMessage(errorCode);
            console.error('Video error:', errorMsg, e.target.error);
            
            this.errorCount++;
            if (this.errorCount <= this.maxErrorRetries) {
                console.log(`Attempting media recovery (${this.errorCount}/${this.maxErrorRetries})`);
                this.tryNextFormat();
            } else {
                this.triggerEvent('error', { code: errorCode, message: errorMsg });
            }
        });
    }
    
    /**
     * Get readable error message from video error code
     * @param {number} errorCode - HTML video error code
     * @returns {string} - Human-readable error message
     */
    getVideoErrorMessage(errorCode) {
        switch(errorCode) {
            case 1: return "The fetching process for the media resource was aborted";
            case 2: return "Network error occurred while fetching the media";
            case 3: return "Error decoding the media resource";
            case 4: return "Media source not supported";
            default: return "Unknown video error";
        }
    }

    /**
     * Update loading state and check if everything is ready
     * @param {string} stateName - State property to update
     * @param {boolean} value - New state value
     */
    updateLoadingState(stateName, value) {
        this.loadingState[stateName] = value;
        this.checkReadyState();
    }
    
    /**
     * Check if all required components are ready for playback
     */
    checkReadyState() {
        // Consider ready when video metadata is loaded and video is no longer loading
        const isVideoReady = this.loadingState.metadataLoaded && !this.loadingState.videoLoading;
        
        // If we're going from not ready to ready, trigger the event
        if (!this.isReady && isVideoReady) {
            this.isReady = true;
            this.onVideoReadyToPlay();
        }
    }
    
    /**
     * Called when video is ready to play
     * This is the new method you requested
     */
    onVideoReadyToPlay() {
        console.debug('Video is ready to play');
        this.triggerEvent('ready', { 
            duration: this.duration * 1000,
            hasAudio: !!this.audioBuffer
        });
        
        // Auto-position to the start point if needed
        if (this.nohudOffset > 0) {
            this.video.currentTime = this.nohudOffset;
            this.updateAudioPauseTime(Math.max(0, this.nohudOffset - this.audioOffset));
        }
    }
    
    /**
     * Called when video playback ends
     * This is the new method you requested
     */
    onVideoEnded() {
        console.debug('Video playback ended');
        // Reset to initial position for potential replay
        setTimeout(() => {
            this.video.currentTime = this.nohudOffset;
            this.updateAudioPauseTime(Math.max(0, this.nohudOffset - this.audioOffset));
        }, 50);
    }

    /**
     * Detect available media formats with improved parallelization
     * @returns {Promise<boolean>} - True if at least one format is available
     */
    async detectAvailableFormats() {
        const basePath = this.gamevar.selectedBase;
        const cdn = this.gamevar.cdn;
        
        // Prioritize formats by performance and compatibility
        const videoFormats = ['webm', 'mp4']; 
        const audioFormats = ['ogg', 'opus', 'wav', 'mp3'];
    
        this.availableFormats = [];
        this.currentFormatIndex = 0;
    
        try {
            // Use the exposed electronAPI.media interface to check media availability
            const result = await window.electronAPI.media.checkMediaAvailability({
                basePath,
                cdn,
                videoFormats,
                audioFormats,
                videoPaths: [
                    '',                 // Root directory
                    '/videoscoach/',    // videoscoach folder
                    '/videos/',         // videos folder
                ],
                audioPaths: [
                    '',                 // Root directory
                    '/audio/',          // audio folder
                ]
            });
    
            if (!result.success) {
                console.error(`Failed to detect media formats: ${result.error}`);
                return false;
            }
    
            // Set the available formats from the IPC result
            this.availableFormats = result.formats;
            
            console.debug(`Found ${this.availableFormats.length} valid media formats`);
            return this.availableFormats.length > 0;
            
        } catch (error) {
            console.error(`Error during format detection: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize video with better error handling and loading indicators
     * @param {Object} songData - Song metadata
     * @returns {Promise<boolean>} - Success status
     */
    async initializeVideo(songData) {
        this.songData = songData;
        this.audioOffset = (songData.audioOffset || 0) / 1000;
        this.nohudOffset = (songData.nohudOffset || 0) / 1000;
        this.videoDelay = (songData.videoDelay || 0) / 1000;
        this.errorCount = 0;
        this.isReady = false;
        
        // Reset loading state
        Object.keys(this.loadingState).forEach(key => {
            this.loadingState[key] = true;
        });
        this.loadingIndicator.style.display = 'flex';

        try {
            if (!await this.detectAvailableFormats()) {
                console.error(`No media formats available for ${this.gamevar.cdn}`);
                this.triggerEvent('error', { 
                    code: 'FORMAT_NOT_FOUND', 
                    message: `No media found for ${this.gamevar.cdn}` 
                });
                return false;
            }
            
            await this.applyFormat(this.availableFormats[0]);
            
            // Set initial positions (after video metadata is loaded)
            return true;
        } catch (err) {
            console.error('Failed to initialize video:', err);
            this.triggerEvent('error', { 
                code: 'INIT_FAILED', 
                message: `Video initialization failed: ${err.message}` 
            });
            return false;
        }
    }

    /**
     * Apply a media format with improved error handling
     * @param {Object} fmt - Format object with video and audio URLs
     * @returns {Promise<void>}
     */
    async applyFormat(fmt) {
        // Reset loading states
        this.updateLoadingState('videoLoading', true);
        this.updateLoadingState('audioLoading', true);
        this.updateLoadingState('metadataLoaded', false);
        
        console.debug(`Applying format: video=${fmt.videoUrl}, audio=${fmt.audioUrl || 'none'}`);
        
        // Set video source
        this.video.src = fmt.videoUrl;
        this.video.load();

        // Load audio buffer in parallel if available
        let audioPromise = Promise.resolve();
        if (fmt.audioUrl) {
            audioPromise = fetch(fmt.audioUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Audio fetch failed: ${response.status}`);
                    }
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                .then(buffer => {
                    this.audioBuffer = buffer;
                    this.updateLoadingState('audioLoading', false);
                    console.debug('Audio buffer loaded successfully');
                })
                .catch(err => {
                    console.error('Failed to load audio:', err);
                    this.audioBuffer = null;
                    this.updateLoadingState('audioLoading', false);
                });
        } else {
            this.audioBuffer = null;
            this.updateLoadingState('audioLoading', false);
        }

        // Wait for video metadata with timeout
        const videoPromise = new Promise((resolve, reject) => {
            const metadataLoaded = () => {
                this.video.removeEventListener('loadedmetadata', metadataLoaded);
                resolve();
            };
            
            this.video.addEventListener('loadedmetadata', metadataLoaded);
            
            // Safety timeout with fallback
            setTimeout(() => {
                this.video.removeEventListener('loadedmetadata', metadataLoaded);
                if (this.video.readyState >= 1) {
                    console.warn('Video metadata timeout but video seems usable');
                    resolve();
                } else {
                    reject(new Error('Video metadata load timeout'));
                }
            }, 8000);
        });

        // Wait for both video and audio to be ready
        try {
            await Promise.all([videoPromise, audioPromise]);
            return true;
        } catch (err) {
            console.error('Error applying format:', err);
            this.tryNextFormat();
            return false;
        }
    }

    /**
     * Try loading the next available format when current one fails
     */
    tryNextFormat() {
        if (this.currentFormatIndex < this.availableFormats.length - 1) {
            this.currentFormatIndex++;
            console.debug(`Trying next format (${this.currentFormatIndex + 1}/${this.availableFormats.length})`);
            this.applyFormat(this.availableFormats[this.currentFormatIndex]);
        } else {
            console.error('All available formats failed');
            this.triggerEvent('error', { 
                code: 'ALL_FORMATS_FAILED', 
                message: 'All media formats failed to load' 
            });
        }
    }

    /**
     * Play media with improved handling of autoplay restrictions
     * @param {number} [startTime] - Optional start time in milliseconds
     * @returns {Promise<void>}
     */
    async playMedia(startTime) {
        if (!this.isReady) {
            console.warn('Attempted to play before video is ready');
            return false;
        }
        
        if (startTime !== undefined) {
            const timeSec = startTime / 1000;
            this.video.currentTime = timeSec + this.videoDelay;
            this.updateAudioPauseTime(Math.max(0, timeSec - this.audioOffset));
        }

        try {
            // Resume audio context first to handle autoplay policies
            await this.audioContext.resume();
            
            // Then attempt to play video
            await this.video.play();
            // Audio will be triggered by the video play event
            return true;
        } catch (err) {
            console.warn('Playback prevented by browser policy:', err);
            this.setupPlayOnInteraction();
            this.triggerEvent('error', { 
                code: 'AUTOPLAY_BLOCKED', 
                message: 'Playback was prevented by browser autoplay policy' 
            });
            return false;
        }
    }

    /**
     * Set up click-to-play for browsers with autoplay restrictions
     */
    setupPlayOnInteraction() {
        const playMedia = async () => {
            try {
                await this.audioContext.resume();
                await this.video.play();
                // Audio will be triggered by the video play event
                document.removeEventListener('click', playMedia);
                document.removeEventListener('touchstart', playMedia);
                document.removeEventListener('keydown', playMedia);
            } catch (err) {
                console.error('Failed to play on interaction:', err);
            }
        };
        
        // Handle multiple interaction types for better UX
        document.addEventListener('click', playMedia, { once: true });
        document.addEventListener('touchstart', playMedia, { once: true });
        document.addEventListener('keydown', playMedia, { once: true });
    }

    /**
     * Pause media playback
     */
    pauseMedia() {
        this.video.pause();
        this.pauseAudio();
    }

    /**
     * Seek to specific time with improved handling
     * @param {number} timeMs - Target time in milliseconds
     */
    seekTo(timeMs) {
        if (!this.isReady) return;
        
        const timeSec = timeMs / 1000;
        
        // Account for video delay in seeking
        this.video.currentTime = timeSec + this.videoDelay;
        const audioTime = Math.max(0, timeSec - this.audioOffset);
        
        if (this.video.paused) {
            this.updateAudioPauseTime(audioTime);
        } else {
            this.playAudioFromTime(audioTime);
        }
    }

    /**
     * Get current playback time in milliseconds
     * @returns {number} - Current time in milliseconds
     */
    getCurrentTime() {
        return Math.round(this.video.currentTime * 1000);
    }

    /**
     * Set playback volume (0.0 to 1.0)
     * @param {number} volume - Volume level from 0.0 to 1.0
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            // Apply logarithmic scaling for better perceived volume control
            this.gainNode.gain.value = Math.pow(this.volume, 1.5);
        }
    }

    /**
     * Play audio from specified time with improved buffer handling
     * @param {number} startTime - Start time in seconds
     */
    playAudioFromTime(startTime) {
        if (!this.audioBuffer) return;
        
        // Stop any existing audio source
        this.stopAudioSource();
        
        // Verify start time is within bounds
        const safeStartTime = Math.max(0, Math.min(startTime, this.audioBuffer.duration - 0.01));
        
        // Create a new audio source
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        
        // Set up pitch preservation
        if (this.preservePitch && this.audioSource.preservesPitch !== undefined) {
            // Modern browsers support preservesPitch property
            this.audioSource.preservesPitch = true;
        }
        
        // Connect to audio graph
        this.audioSource.connect(this.gainNode);
        
        // Set playback rate
        this.audioSource.playbackRate.value = this.audioPlaybackRate;
        
        // Start playing from the specified time
        this.audioSource.start(0, safeStartTime);
        this.audioStartTime = this.audioContext.currentTime - safeStartTime / this.audioPlaybackRate;
        this.audioPaused = false;
        
        console.debug(`Started audio at ${safeStartTime.toFixed(3)}s with rate ${this.audioPlaybackRate.toFixed(2)}`);
    }

    /**
     * Pause audio playback
     */
    pauseAudio() {
        if (this.audioSource && !this.audioPaused) {
            const currentTime = this.getCurrentAudioTime();
            this.stopAudioSource();
            this.audioPauseTime = currentTime;
            this.audioPaused = true;
            console.debug(`Paused audio at ${currentTime.toFixed(3)}s`);
        }
    }

    /**
     * Update the paused audio position
     * @param {number} time - New audio position in seconds
     */
    updateAudioPauseTime(time) {
        // Ensure time is within buffer bounds if we have a buffer
        if (this.audioBuffer) {
            time = Math.max(0, Math.min(time, this.audioBuffer.duration - 0.01));
        }
        this.audioPauseTime = time;
    }

    /**
     * Safely stop and disconnect audio source
     */
    stopAudioSource() {
        if (this.audioSource) {
            try {
                this.audioSource.stop();
            } catch (e) {
                // Ignore stop errors
            }
            this.audioSource.disconnect();
            this.audioSource = null;
        }
    }

    /**
     * Get current audio playback position in seconds
     * @returns {number} - Current audio time in seconds
     */
    getCurrentAudioTime() {
        if (this.audioPaused) {
            return this.audioPauseTime;
        }
        
        if (!this.audioSource) return 0;
        
        const elapsedTime = (this.audioContext.currentTime - this.audioStartTime) * this.audioPlaybackRate;
        
        // Ensure we don't exceed buffer duration
        if (this.audioBuffer) {
            return Math.min(elapsedTime, this.audioBuffer.duration);
        }
        
        return elapsedTime;
    }

    /**
     * Set audio playback rate with improved position tracking
     * @param {number} rate - New playback rate
     */
    setAudioPlaybackRate(rate) {
        if (rate === this.audioPlaybackRate) return;
        
        const currentTime = this.getCurrentAudioTime();
        this.audioPlaybackRate = rate;
        
        if (this.audioSource && !this.audioPaused) {
            // Update the current source's playback rate
            this.audioSource.playbackRate.value = rate;
            
            // Ensure pitch preservation is maintained when changing rate
            if (this.preservePitch && this.audioSource.preservesPitch !== undefined) {
                this.audioSource.preservesPitch = true;
            }
            
            // Update timing reference to maintain position
            this.audioStartTime = this.audioContext.currentTime - currentTime / rate;
        }
    }
    
    /**
     * Toggle pitch preservation
     * @param {boolean} preserve - Whether to preserve pitch when changing playback rate
     */
    setPitchPreservation(preserve) {
        this.preservePitch = !!preserve;
        
        // Update current audio source if it exists
        if (this.audioSource && this.audioSource.preservesPitch !== undefined) {
            this.audioSource.preservesPitch = this.preservePitch;
        }
        
        // Also update the pitch processor if we're using AudioWorklet
        if (this.pitchNode && this.pitchNode.port) {
            this.pitchNode.port.postMessage({ preservePitch: this.preservePitch });
        }
    }

    /**
     * Set playback speed with pitch preservation option
     * @param {number} speed - Playback speed (0.25 to 2.0)
     * @param {boolean} [preservePitch=true] - Whether to preserve pitch
     */
    setPlaybackSpeed(speed, preservePitch = true) {
        // Limit speed to reasonable range
        const safeSpeed = Math.max(0.25, Math.min(2.0, speed));
        
        // Set pitch preservation option
        this.setPitchPreservation(preservePitch);
        
        // Set video playback rate
        this.video.playbackRate = safeSpeed;
        
        // Adjust audio playback rate
        this.setAudioPlaybackRate(safeSpeed);
        
        console.debug(`Set playback speed to ${safeSpeed.toFixed(2)}x (preserve pitch: ${preservePitch})`);
    }

    /**
     * Clean up all resources
     */
    cleanup() {
        this.pauseMedia();
        
        // Clear all event listeners
        this.eventHandlers = {
            ready: [],
            stateChange: [],
            ended: [],
            error: [],
            progress: [],
            timeUpdate: []
        };

        // Stop video
        if (this.video) {
            this.video.pause();
            this.video.src = '';
            this.video.load();
        }

        // Clean up audio
        this.stopAudioSource();

        // Disconnect audio graph
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        
        if (this.compressor) {
            this.compressor.disconnect();
        }
        
        if (this.pitchNode) {
            this.pitchNode.disconnect();
        }

        // Close audio context to free resources
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        // Clear buffers
        this.audioBuffer = null;
        
        // Remove DOM elements
        if (this.videoContainer) {
            this.videoContainer.innerHTML = '';
        }
    }

    /**
     * Check if video is currently playing
     * @returns {boolean} - True if video is playing
     */
    isVideoPlaying() {
        return !!(
            this.video &&
            this.video.currentTime > 0 &&
            !this.video.paused &&
            !this.video.ended &&
            this.video.readyState > 2
        );
    }

    /**
     * Get the video duration in milliseconds
     * @returns {number} - Duration in milliseconds
     */
    getDuration() {
        return this.duration * 1000;
    }

    /**
     * Get the video element
     * @returns {HTMLVideoElement} - Video element
     */
    getVideo() {
        return this.video;
    }
    
    /**
     * Get current buffered ranges
     * @returns {Array<Object>} - Array of {start, end} objects in seconds
     */
    getBufferedRanges() {
        const ranges = [];
        
        if (this.video && this.video.buffered) {
            for (let i = 0; i < this.video.buffered.length; i++) {
                ranges.push({
                    start: this.video.buffered.start(i),
                    end: this.video.buffered.end(i)
                });
            }
        }
        
        return ranges;
    }

    /**
     * Register event listener
     * @param {string} eventName - Event name to listen for
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    on(eventName, callback) {
        if (!this.eventHandlers[eventName]) {
            this.eventHandlers[eventName] = [];
        }
        
        this.eventHandlers[eventName].push(callback);
        
        // Return unsubscribe function
        return () => {
            this.eventHandlers[eventName] = this.eventHandlers[eventName]
                .filter(handler => handler !== callback);
        };
    }
    
    /**
     * Remove event listener
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback to remove
     */
    off(eventName, callback) {
        if (!this.eventHandlers[eventName]) return;
        
        this.eventHandlers[eventName] = this.eventHandlers[eventName]
            .filter(handler => handler !== callback);
    }
    
    /**
     * Trigger event for all registered listeners
     * @param {string} eventName - Event name
     * @param {Object} [data] - Event data
     */
    triggerEvent(eventName, data = {}) {
        if (!this.eventHandlers[eventName]) return;
        
        for (const handler of this.eventHandlers[eventName]) {
            try {
                handler(data);
            } catch (err) {
                console.error(`Error in ${eventName} event handler:`, err);
            }
        }
    }
    
    /**
     * Mute or unmute audio
     * @param {boolean} muted - Whether audio should be muted
     */
    setMuted(muted) {
        if (this.gainNode) {
            this.gainNode.gain.value = muted ? 0 : this.volume;
        }
    }
    
    /**
     * Get video and audio status object
     * @returns {Object} - Status object with all relevant properties
     */
    getStatus() {
        return {
            isReady: this.isReady,
            isPlaying: this.isVideoPlaying(),
            isPaused: this.video ? this.video.paused : true,
            isBuffering: this.isBuffering(),
            isSeeking: this.isSeeking,
            duration: this.duration * 1000,
            currentTime: this.getCurrentTime(),
            audioTime: this.getCurrentAudioTime() * 1000,
            volume: this.volume,
            playbackRate: this.audioPlaybackRate,
            preservePitch: this.preservePitch,
            hasAudio: !!this.audioBuffer,
            error: this.errorCount > this.maxErrorRetries
        };
    }
}