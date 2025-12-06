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
        this.eventHandlers = {
            ready: [],
            stateChange: [],
            ended: [],
            error: [],
            progress: [],
            timeUpdate: []
        };
        this.clock = {
            currentTime: 0,
            lastFrameTime: 0,
            isPlaying: false,
            playbackRate: 1.0,
            rafId: null
        };
        this.SYNC_THRESHOLD = 0.04;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });
        this.audioOffset = (songData.audioOffset || 0) / 1000;
        this.nohudOffset = (songData.nohudOffset || 0) / 1000;
        this.videoDelay = (songData.videoDelay || 0) / 1000;
        this.audioBuffer = null;
        this.audioSource = null;
        this.setupAudioNodes();
        this.preservePitch = true;
        this.createMediaElements();
        this._isBuffering = false;
        this.isReady = false;
        this.isSeeking = false;
        this.duration = 0;
        this.volume = 1.0;
        this.errorCount = 0;
        this.maxErrorRetries = 3;
        this.audioAnchorTime = 0;
        this.audioSeekOffset = 0;
        this.loadingState = {
            videoLoading: true,
            audioLoading: true,
            metadataLoaded: false
        };
    }
    setupAudioNodes() {
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        if (window.AudioWorkletNode && this.audioContext.audioWorklet) {
            this.setupPitchCorrection();
        } else {
            this.setupFallbackPitchCorrection();
        }
    }
    async setupPitchCorrection() {
        try {
            await this.audioContext.audioWorklet.addModule(
                'data:application/javascript;base64,' +
                btoa(`
                    class PitchProcessor extends AudioWorkletProcessor {
                        constructor() {
                            super();
                            this.preservePitch = true;
                            this.port.onmessage = (event) => {
                                if (event.data.preservePitch !== undefined) {
                                    this.preservePitch = event.data.preservePitch;
                                }
                            };
                        }
                        process(inputs, outputs) {
                            const input = inputs[0];
                            const output = outputs[0];
                            if (!input || !output) return true;
                            for (let i = 0; i < input.length; i++) {
                                if (output[i]) output[i].set(input[i]);
                            }
                            return true;
                        }
                    }
                    registerProcessor('pitch-processor', PitchProcessor);
                `)
            );
            this.pitchNode = new AudioWorkletNode(this.audioContext, 'pitch-processor');
            this.gainNode.connect(this.compressor);
            this.compressor.connect(this.pitchNode);
            this.pitchNode.connect(this.audioContext.destination);
        } catch (err) {
            this.setupFallbackPitchCorrection();
        }
    }
    setupFallbackPitchCorrection() {
        this.gainNode.connect(this.compressor);
        this.compressor.connect(this.audioContext.destination);
    }
    isBuffering() {
        return this._isBuffering;
    }
    createMediaElements() {
        this.videoContainer.innerHTML = '';
        this.video = document.createElement('video');
        this.video.className = 'videoplayer';
        this.video.controls = false;
        this.video.crossOrigin = 'anonymous';
        this.video.preload = 'auto';
        this.video.playsInline = true;
        this.video.muted = true; 
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'video-loading-indicator';
        this.loadingIndicator.innerHTML = '<div class="spinner"></div>';
        this.videoContainer.appendChild(this.loadingIndicator);
        this.videoContainer.appendChild(this.video);
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.video.addEventListener('pause', () => {
            if (this.clock.isPlaying) {
                console.debug('Browser enforced pause detected');
                this.internalPause();
            }
        });
        this.video.addEventListener('playing', () => {
            if (!this.clock.isPlaying && this.isReady) {
                console.debug('Browser enforced play detected');
                this.internalPlay();
            }
            this._isBuffering = false;
            this.loadingIndicator.style.display = 'none';
        });
        this.video.addEventListener('waiting', () => {
            this._isBuffering = true;
            this.loadingIndicator.style.display = 'flex';
            if (this.audioContext.state === 'running') {
                this.audioContext.suspend();
            }
            this.triggerEvent('stateChange', { state: 'buffering' });
        });
        this.video.addEventListener('canplay', () => {
            this.loadingIndicator.style.display = 'none';
            this.updateLoadingState('videoLoading', false);
            this.checkReadyState();
            this._isBuffering = false;
        });
        this.video.addEventListener('loadedmetadata', () => {
            this.updateLoadingState('metadataLoaded', true);
            this.duration = this.video.duration;
            this.checkReadyState();
        });
        this.video.addEventListener('ended', () => {
            this.internalPause();
            this.triggerEvent('ended');
            this.onVideoEnded();
        });
        this.video.addEventListener('error', (e) => {
            this.errorCount++;
            if (this.errorCount <= this.maxErrorRetries) {
                this.tryNextFormat();
            } else {
                this.triggerEvent('error', { code: e.target.error?.code, message: 'Video Error' });
            }
        });
    }
    internalPlay() {
        this.clock.isPlaying = true;
        this.clock.lastFrameTime = performance.now();
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        if (!this.clock.rafId) {
            this.clock.rafId = requestAnimationFrame(() => this.tick());
        }
        this.triggerEvent('stateChange', { state: 'playing' });
    }
    internalPause() {
        this.clock.isPlaying = false;
        if (this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
        if (this.clock.rafId) {
            cancelAnimationFrame(this.clock.rafId);
            this.clock.rafId = null;
        }
        this.triggerEvent('stateChange', { state: 'paused' });
    }
    tick() {
        if (this.video.paused && !this._isBuffering) {
            if (this.clock.isPlaying) {
                this.internalPause();
            }
            return;
        }
        if (!this.clock.isPlaying) return;
        const now = performance.now();
        const delta = (now - this.clock.lastFrameTime) / 1000;
        this.clock.lastFrameTime = now;
        if (this._isBuffering) {
            this.clock.rafId = requestAnimationFrame(() => this.tick());
            return;
        }
        if (this.audioSource && this.audioContext.state === 'running') {
            const audioElapsedTime = (this.audioContext.currentTime - this.audioAnchorTime) * this.clock.playbackRate;
            this.clock.currentTime = this.audioSeekOffset + audioElapsedTime + this.audioOffset;
        } else {
            this.clock.currentTime += delta * this.clock.playbackRate;
        }
        if (this.clock.currentTime >= this.duration && this.duration > 0) {
        }
        this.syncVideo();
        this.triggerEvent('timeUpdate', {
            time: this.clock.currentTime * 1000,
            audioTime: this.clock.currentTime * 1000
        });
        this.clock.rafId = requestAnimationFrame(() => this.tick());
    }
    syncVideo() {
        if (this.video && this.video.readyState >= 1 && !this.video.paused && !this._isBuffering) {
            const videoTarget = Math.max(0, this.clock.currentTime + this.videoDelay);
            const drift = Math.abs(this.video.currentTime - videoTarget);
            if (drift > this.SYNC_THRESHOLD) {
                this.video.currentTime = videoTarget;
            }
        }
    }
    async playMedia(startTime) {
        if (!this.isReady) return false;
        if (startTime !== undefined) {
            this.clock.currentTime = startTime / 1000;
        }
        try {
            await this.audioContext.resume();
            const targetAudioPos = Math.max(0, this.clock.currentTime - this.audioOffset);
            this.playAudioFromTime(targetAudioPos);
            this.video.currentTime = Math.max(0, this.clock.currentTime + this.videoDelay);
            await this.video.play();
            return true;
        } catch (err) {
            console.warn('Autoplay blocked:', err);
            this.setupPlayOnInteraction();
            return false;
        }
    }
    pauseMedia() {
        this.video.pause();
    }
    setupPlayOnInteraction() {
        const playMedia = async () => {
            try {
                await this.audioContext.resume();
                this.playMedia(this.clock.currentTime * 1000);
                document.removeEventListener('click', playMedia);
                document.removeEventListener('touchstart', playMedia);
                document.removeEventListener('keydown', playMedia);
            } catch (err) { }
        };
        document.addEventListener('click', playMedia, { once: true });
        document.addEventListener('touchstart', playMedia, { once: true });
        document.addEventListener('keydown', playMedia, { once: true });
    }
    seekTo(timeMs) {
        if (!this.isReady) return;
        const timeSec = timeMs / 1000;
        this.clock.currentTime = timeSec;
        this.isSeeking = true;
        this.video.currentTime = Math.max(0, timeSec + this.videoDelay);
        const targetAudioPos = Math.max(0, timeSec - this.audioOffset);
        if (this.clock.isPlaying) {
            this.playAudioFromTime(targetAudioPos);
        } else {
            this.audioSeekOffset = targetAudioPos;
        }
        this.triggerEvent('stateChange', { state: 'seeked', time: timeMs });
        setTimeout(() => { this.isSeeking = false; }, 100);
    }
    getCurrentTime() {
        return Math.round(this.clock.currentTime * 1000);
    }
    playAudioFromTime(startTime) {
        if (!this.audioBuffer) return;
        this.stopAudioSource();
        const safeStartTime = Math.max(0, Math.min(startTime, this.audioBuffer.duration - 0.01));
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        if (this.preservePitch && this.audioSource.preservesPitch !== undefined) {
            this.audioSource.preservesPitch = true;
        }
        this.audioSource.connect(this.gainNode);
        this.audioSource.playbackRate.value = this.clock.playbackRate;
        this.audioSource.start(0, safeStartTime);
        this.audioAnchorTime = this.audioContext.currentTime;
        this.audioSeekOffset = safeStartTime;
    }
    stopAudioSource() {
        if (this.audioSource) {
            try { this.audioSource.stop(); } catch (e) { }
            this.audioSource.disconnect();
            this.audioSource = null;
        }
    }
    getCurrentAudioTime() {
        return this.clock.currentTime;
    }
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) this.gainNode.gain.value = Math.pow(this.volume, 1.5);
    }
    setPlaybackSpeed(speed, preservePitch = true) {
        const safeSpeed = Math.max(0.25, Math.min(2.0, speed));
        this.clock.playbackRate = safeSpeed;
        this.setPitchPreservation(preservePitch);
        this.video.playbackRate = safeSpeed;
        if (this.audioSource) {
            this.audioSource.playbackRate.value = safeSpeed;
            const currentAudioPos = (this.audioContext.currentTime - this.audioAnchorTime) * this.clock.playbackRate + this.audioSeekOffset;
            this.playAudioFromTime(currentAudioPos);
        }
    }
    setPitchPreservation(preserve) {
        this.preservePitch = !!preserve;
        if (this.audioSource && this.audioSource.preservesPitch !== undefined) {
            this.audioSource.preservesPitch = this.preservePitch;
        }
        if (this.pitchNode && this.pitchNode.port) {
            this.pitchNode.port.postMessage({ preservePitch: this.preservePitch });
        }
    }
    setMuted(muted) {
        if (this.gainNode) this.gainNode.gain.value = muted ? 0 : this.volume;
    }
    updateLoadingState(stateName, value) {
        this.loadingState[stateName] = value;
        this.checkReadyState();
    }
    checkReadyState() {
        const isVideoReady = this.loadingState.metadataLoaded && !this.loadingState.videoLoading;
        if (!this.isReady && isVideoReady) {
            this.isReady = true;
            this.onVideoReadyToPlay();
        }
    }
    onVideoReadyToPlay() {
        this.triggerEvent('ready', {
            duration: this.duration * 1000,
            hasAudio: !!this.audioBuffer
        });
        if (this.nohudOffset > 0) {
            this.clock.currentTime = this.nohudOffset;
            this.video.currentTime = this.nohudOffset + this.videoDelay;
        }
    }
    onVideoEnded() {
        setTimeout(() => {
            this.clock.currentTime = this.nohudOffset;
            this.video.currentTime = this.nohudOffset + this.videoDelay;
        }, 50);
    }
    async detectAvailableFormats() {
        try {
            const result = await window.electronAPI.media.checkMediaAvailability({
                basePath: this.gamevar.selectedBase,
                cdn: this.gamevar.cdn,
                videoFormats: ['webm', 'mp4'],
                audioFormats: ['ogg', 'opus', 'wav', 'mp3'],
                videoPaths: ['', '/videoscoach/', '/videos/'],
                audioPaths: ['', '/audio/']
            });
            if (!result.success) return false;
            this.availableFormats = result.formats;
            return this.availableFormats.length > 0;
        } catch (error) { return false; }
    }
    async initializeVideo(songData) {
        this.songData = songData;
        this.audioOffset = (songData.audioOffset || 0) / 1000;
        this.nohudOffset = (songData.nohudOffset || 0) / 1000;
        this.videoDelay = (songData.videoDelay || 0) / 1000;
        this.errorCount = 0;
        this.isReady = false;
        this.clock.currentTime = 0;
        Object.keys(this.loadingState).forEach(key => this.loadingState[key] = true);
        this.loadingIndicator.style.display = 'flex';
        try {
            if (!await this.detectAvailableFormats()) {
                this.triggerEvent('error', { code: 'FORMAT_NOT_FOUND', message: `No media found` });
                return false;
            }
            await this.applyFormat(this.availableFormats[0]);
            return true;
        } catch (err) {
            this.triggerEvent('error', { code: 'INIT_FAILED', message: err.message });
            return false;
        }
    }
    async applyFormat(fmt) {
        this.updateLoadingState('videoLoading', true);
        this.updateLoadingState('audioLoading', true);
        this.video.src = fmt.videoUrl;
        this.video.load();
        let audioPromise = Promise.resolve();
        if (fmt.audioUrl) {
            audioPromise = fetch(fmt.audioUrl)
                .then(r => r.arrayBuffer())
                .then(b => this.audioContext.decodeAudioData(b))
                .then(buffer => {
                    this.audioBuffer = buffer;
                    this.updateLoadingState('audioLoading', false);
                })
                .catch(err => {
                    this.audioBuffer = null;
                    this.updateLoadingState('audioLoading', false);
                });
        } else {
            this.audioBuffer = null;
            this.updateLoadingState('audioLoading', false);
        }
        const videoPromise = new Promise((resolve) => {
            const metadataLoaded = () => {
                this.video.removeEventListener('loadedmetadata', metadataLoaded);
                resolve();
            };
            this.video.addEventListener('loadedmetadata', metadataLoaded);
            setTimeout(() => { if (this.video.readyState >= 1) resolve(); }, 8000);
        });
        try {
            await Promise.all([videoPromise, audioPromise]);
            return true;
        } catch (err) {
            this.tryNextFormat();
            return false;
        }
    }
    tryNextFormat() {
        if (this.currentFormatIndex < this.availableFormats.length - 1) {
            this.currentFormatIndex++;
            this.applyFormat(this.availableFormats[this.currentFormatIndex]);
        } else {
            this.triggerEvent('error', { code: 'ALL_FORMATS_FAILED', message: 'All media formats failed' });
        }
    }
    cleanup() {
        this.pauseMedia();
        this.eventHandlers = { ready: [], stateChange: [], ended: [], error: [], progress: [], timeUpdate: [] };
        if (this.video) {
            this.video.src = '';
            this.video.load();
        }
        this.stopAudioSource();
        if (this.gainNode) this.gainNode.disconnect();
        if (this.compressor) this.compressor.disconnect();
        if (this.pitchNode) this.pitchNode.disconnect();
        if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close();
        if (this.videoContainer) this.videoContainer.innerHTML = '';
    }
    isVideoPlaying() { return this.clock.isPlaying; }
    getDuration() { return this.duration * 1000; }
    getVideo() { return this.video; }
    setAudioPlaybackRate(rate) { this.setPlaybackSpeed(rate); }
    on(n, c) { this.eventHandlers[n]?.push(c); return () => this.off(n, c); }
    off(n, c) { this.eventHandlers[n] = this.eventHandlers[n]?.filter(h => h !== c); }
    triggerEvent(n, d) { this.eventHandlers[n]?.forEach(h => h(d)); }
    getStatus() {
        return {
            isReady: this.isReady,
            isPlaying: this.clock.isPlaying,
            isPaused: !this.clock.isPlaying,
            isBuffering: this.isBuffering(),
            isSeeking: this.isSeeking,
            duration: this.duration * 1000,
            currentTime: this.getCurrentTime(),
            audioTime: this.getCurrentAudioTime() * 1000,
            volume: this.volume,
            playbackRate: this.clock.playbackRate,
            preservePitch: this.preservePitch,
            hasAudio: !!this.audioBuffer,
            error: this.errorCount > this.maxErrorRetries
        };
    }
}