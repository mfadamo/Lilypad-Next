/** Pleo.js */
export default class VideoManager {
    constructor(gamevar, songData) {
        this.gamevar = gamevar;
        this.songData = songData;
        this.videoContainer = document.querySelector(".video-container");

        this.eventHandlers = {
            ready: [], stateChange: [], ended: [],
            error: [], progress: [], timeUpdate: []
        };

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });

        this.audioOffset = (songData.audioOffset || 0) / 1000;
        this.nohudOffset = (songData.nohudOffset || 0) / 1000;
        this.videoDelay = (songData.videoDelay || 0) / 1000;

        this.audioBuffer = null;
        this.audioSource = null;
        this.audioStartTime = 0;
        this.sourceStartOffset = 0;

        this.isReady = false;
        this.duration = 0;
        this.volume = 1.0;
        this.rafId = null;
        this._isBuffering = false;

        this.loadingState = {
            videoLoading: true,
            audioLoading: true,
            metadataLoaded: false
        };

        this.setupAudioNodes();
        this.createMediaElements();
    }

    setupAudioNodes() {
        this.gainNode = this.audioContext.createGain();
        this.compressor = this.audioContext.createDynamicsCompressor();

        this.compressor.threshold.value = -24;
        this.compressor.ratio.value = 12;

        this.gainNode.connect(this.compressor);
        this.compressor.connect(this.audioContext.destination);
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

        this.bindEvents();
    }

    bindEvents() {
        this.video.addEventListener('playing', () => {
            this._isBuffering = false;
            this.loadingIndicator.style.display = 'none';

            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            this.startAudioSynced();
            this.startTicker();
            this.triggerEvent('stateChange', { state: 'playing' });
        });

        this.video.addEventListener('pause', () => {
            if (!this._isBuffering) {
                this.stopAudio();
                this.stopTicker();
                this.triggerEvent('stateChange', { state: 'paused' });
            }
        });

        this.video.addEventListener('waiting', () => {
            this._isBuffering = true;
            this.loadingIndicator.style.display = 'flex';
            this.stopAudio();
            this.triggerEvent('stateChange', { state: 'buffering' });
        });

        this.video.addEventListener('seeking', () => {
            this.stopAudio();
            this.triggerEvent('stateChange', { state: 'seeking' });
        });

        this.video.addEventListener('seeked', () => {
            this.triggerEvent('stateChange', { state: 'seeked', time: this.video.currentTime * 1000 });
        });

        this.video.addEventListener('ended', () => {
            this.stopAudio();
            this.stopTicker();
            this.triggerEvent('ended');
            this.onVideoEnded();
        });

        this.video.addEventListener('loadedmetadata', () => {
            this.updateLoadingState('metadataLoaded', true);
            this.duration = this.video.duration;
            this.checkReadyState();
        });

        this.video.addEventListener('canplay', () => {
            this.updateLoadingState('videoLoading', false);
            this._isBuffering = false;
            this.loadingIndicator.style.display = 'none';
        });

        this.video.addEventListener('error', (e) => {
            this.triggerEvent('error', { code: e.target.error?.code });
        });
    }

    startAudioSynced() {
        if (!this.audioBuffer) return;
        this.stopAudio();

        const videoTime = this.video.currentTime;
        let targetAudioTime = Math.max(0, videoTime - this.videoDelay - this.audioOffset);

        if (targetAudioTime >= this.audioBuffer.duration) return;

        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.playbackRate.value = this.video.playbackRate;
        this.audioSource.connect(this.gainNode);

        this.audioSource.start(0, targetAudioTime);

        this.sourceStartOffset = targetAudioTime;
        this.audioStartTime = this.audioContext.currentTime;
    }

    stopAudio() {
        if (this.audioSource) {
            try { this.audioSource.stop(); } catch (e) { }
            this.audioSource.disconnect();
            this.audioSource = null;
        }
    }

    tick() {
        if (this.video.paused || this._isBuffering) return;

        let currentTime;

        if (this.audioSource) {
            const elapsed = (this.audioContext.currentTime - this.audioStartTime) * this.video.playbackRate;
            currentTime = this.sourceStartOffset + elapsed + this.audioOffset;

            // Sync correction (>150ms drift)
            const expectedVideoTime = currentTime + this.videoDelay;
            if (Math.abs(this.video.currentTime - expectedVideoTime) > 0.15) {
                this.video.currentTime = expectedVideoTime;
            }
        } else {
            currentTime = this.video.currentTime - this.videoDelay;
        }

        this.triggerEvent('timeUpdate', {
            time: currentTime * 1000,
            audioTime: currentTime * 1000
        });

        this.rafId = requestAnimationFrame(() => this.tick());
    }

    startTicker() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => this.tick());
    }

    stopTicker() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    async playMedia(startTime) {
        if (!this.isReady) return false;

        if (startTime !== undefined) {
            this.video.currentTime = (startTime / 1000) + this.videoDelay;
        }

        try {
            await this.audioContext.resume();
            await this.video.play();
            return true;
        } catch (err) {
            this.setupPlayOnInteraction();
            return false;
        }
    }

    pauseMedia() {
        this.video.pause();
    }

    seekTo(timeMs) {
        if (!this.isReady) return;
        this.video.currentTime = (timeMs / 1000) + this.videoDelay;
    }

    setupPlayOnInteraction() {
        const handler = async () => {
            await this.audioContext.resume();
            this.video.play().catch(() => { });
            ['click', 'touchstart', 'keydown'].forEach(evt =>
                document.removeEventListener(evt, handler)
            );
        };
        ['click', 'touchstart', 'keydown'].forEach(evt =>
            document.addEventListener(evt, handler, { once: true })
        );
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.gainNode) this.gainNode.gain.value = Math.pow(this.volume, 1.5);
    }

    setPlaybackSpeed(speed) {
        const safeSpeed = Math.max(0.25, Math.min(2.0, speed));
        this.video.playbackRate = safeSpeed;

        if (this.audioSource) {
            this.audioSource.playbackRate.value = safeSpeed;
        }

        if (!this.video.paused) {
            this.startAudioSynced();
        }
    }

    setMuted(muted) {
        if (this.gainNode) this.gainNode.gain.value = muted ? 0 : this.volume;
    }

    getCurrentTime() {
        if (this.audioSource && !this.video.paused) {
            const elapsed = (this.audioContext.currentTime - this.audioStartTime) * this.video.playbackRate;
            return (this.sourceStartOffset + elapsed + this.audioOffset) * 1000;
        }
        return (this.video.currentTime - this.videoDelay) * 1000;
    }

    getCurrentAudioTime() { return this.getCurrentTime() / 1000; }
    getDuration() { return this.duration * 1000; }
    getVideo() { return this.video; }
    isVideoPlaying() { return !this.video.paused && !this._isBuffering && !this.video.ended; }
    isBuffering() { return this._isBuffering; }

    updateLoadingState(key, val) {
        this.loadingState[key] = val;
        this.checkReadyState();
    }

    checkReadyState() {
        if (!this.isReady && (this.loadingState.metadataLoaded && !this.loadingState.videoLoading)) {
            this.isReady = true;
            this.triggerEvent('ready', {
                duration: this.duration * 1000,
                hasAudio: !!this.audioBuffer
            });

            if (this.nohudOffset > 0) {
                this.video.currentTime = this.nohudOffset + this.videoDelay;
            }
        }
    }

    onVideoEnded() {
        setTimeout(() => {
            if (this.video) this.video.currentTime = this.nohudOffset + this.videoDelay;
        }, 100);
    }

    cleanup() {
        this.pauseMedia();
        this.stopTicker();
        this.eventHandlers = { ready: [], stateChange: [], ended: [], error: [], progress: [], timeUpdate: [] };

        if (this.video) {
            this.video.src = '';
            this.video.load();
        }
        if (this.audioContext.state !== 'closed') this.audioContext.close();
        this.videoContainer.innerHTML = '';
    }

    async initializeVideo(songData) {
        this.songData = songData;
        this.audioOffset = (songData.audioOffset || 0) / 1000;
        this.nohudOffset = (songData.nohudOffset || 0) / 1000;
        this.videoDelay = (songData.videoDelay || 0) / 1000;

        this.loadingIndicator.style.display = 'flex';
        this.isReady = false;

        try {
            if (!await this.detectAvailableFormats()) {
                this.triggerEvent('error', { code: 'NO_FORMAT', message: 'No media found' });
                return false;
            }
            await this.applyFormat(this.availableFormats[0]);
            return true;
        } catch (e) {
            this.triggerEvent('error', { code: 'INIT_FAIL', message: e.message });
            return false;
        }
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
            if (result.success && result.formats.length > 0) {
                this.availableFormats = result.formats;
                return true;
            }
            return false;
        } catch (e) { return false; }
    }

    async applyFormat(fmt) {
        this.updateLoadingState('videoLoading', true);
        this.video.src = fmt.videoUrl;
        this.video.load();

        if (fmt.audioUrl) {
            fetch(fmt.audioUrl)
                .then(r => r.arrayBuffer())
                .then(b => this.audioContext.decodeAudioData(b))
                .then(b => {
                    this.audioBuffer = b;
                    this.updateLoadingState('audioLoading', false);
                })
                .catch(() => this.updateLoadingState('audioLoading', false));
        } else {
            this.audioBuffer = null;
            this.updateLoadingState('audioLoading', false);
        }

        return new Promise(resolve => {
            const onMeta = () => {
                this.video.removeEventListener('loadedmetadata', onMeta);
                resolve();
            };
            this.video.addEventListener('loadedmetadata', onMeta);
            setTimeout(resolve, 5000);
        });
    }

    on(n, c) { this.eventHandlers[n]?.push(c); return () => this.off(n, c); }
    off(n, c) { this.eventHandlers[n] = this.eventHandlers[n]?.filter(h => h !== c); }
    triggerEvent(n, d) { this.eventHandlers[n]?.forEach(h => h(d)); }

    getStatus() {
        return {
            isReady: this.isReady,
            isPlaying: this.isVideoPlaying(),
            isPaused: this.video.paused,
            isBuffering: this._isBuffering,
            currentTime: this.getCurrentTime(),
            duration: this.duration * 1000,
            volume: this.volume,
            playbackRate: this.video.playbackRate
        };
    }
}