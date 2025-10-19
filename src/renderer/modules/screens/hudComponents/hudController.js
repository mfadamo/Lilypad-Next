//src/renderer/modules/screens/hudComponents/hudController.js
import LyricsManager from './lyricsManager';
import PictosManager from './pictosManager';
import PlayerScoreManager from './playerScoreManager.js';
import { SFXManager } from '../../audio/sfx';
import VideoManager from '../../video/pleo';
import { openSceneScreen } from '../global';
import { TransitionManager } from '../../transitions/default';

export default class HudController {
    constructor(gamevar, songData, pictosAtlas, msm, gesture) {
        this.gamevar = gamevar;
        this.songData = songData;
        this.msm = msm;
        this.gesture = gesture;
        this.pictosAtlas = pictosAtlas;
        this.hud = document.querySelector(".hud");

        this.lyricsManager = new LyricsManager();
        this.pictosManager = new PictosManager(gamevar);
        this.videoManager = new VideoManager(gamevar, songData);

        // --- Hybrid Master Clock State ---
        this._masterClockTime = 0; 
        this._lastVideoTime = 0;
        this._lastSyncTime = 0;
        this._isClockRunning = false;
        this._isUserPaused = false;

        // Promise that resolves when the media is ready to play
        this.mediaReadyPromise = new Promise(resolve => {
            this._resolveMediaReady = resolve;
        });

        this.setupSongVariables();
        this.setupUIElements();

        this.pictosManager.setAtlas(pictosAtlas);
        this.initPhoneControllers();
        this.loopUI = this.initializeHudLoop();
    }

    // --- Master Clock Management ---
    _synchronizeClocks() {
        const videoTimeMs = this.videoManager.getCurrentTime();
        this._lastVideoTime = videoTimeMs;
        this._lastSyncTime = performance.now();
        this._masterClockTime = videoTimeMs; // Set the master clock directly to this ground truth
    }

    _updateMasterClock() {
        if (this._isClockRunning) {
            const elapsedSinceSync = performance.now() - this._lastSyncTime;
            const videoPlaybackRate = this.videoManager.getVideo().playbackRate || 1;
            this._masterClockTime = this._lastVideoTime + (elapsedSinceSync * videoPlaybackRate);
        }
    }

    // --- Public Control Methods ---
    resume() {
        if (!this._isUserPaused) return;
        this._isUserPaused = false;
        this.videoManager.playMedia();
        }

    pause() {
        if (this._isUserPaused) return;
        this._isUserPaused = true;
        this.videoManager.pauseMedia();
          }

    playMedia() {
        console.log("Starting song playback via external call.");
        this.videoManager.playMedia(this.songVar.nohudOffset);
    }

    calculateAverageBeatTime(arra) {
        if (!Array.isArray(arra) || arra.length < 2) {
            return 500;
        }
        const differences = arra.slice(1).map((currentValue, index) => currentValue - arra[index]);
        const sumOfDifferences = differences.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        const averageDifference = sumOfDifferences / differences.length;
        return averageDifference;
    }

    isEven(num) {
        return num % 2 === 0;
    }

    async setupSongVariables() {
        this.offset = {
            beat: 0, lyrics: 0, lyricsLine: 0, pictos: 0, goldMoves: 0, goldMovesExplode: 0,
            moves0: 0, moves1: 0, moves2: 0, moves3: 0, moves4: 0, moves5: 0,
            hideUI: 0
        };

        const beats = this.songData.beats || [];
        const lyrics = this.songData.lyrics.filter((block) => block.isLineEnding === 1 || block.text !== "") || [];

        this.songVar = {
            Beat: beats,
            nohudOffset: this.songData.ubiartConverted ? this.songData.videoOffset + 100 : this.songData.nohudOffset || 0,
            audioOffset: this.songData.audioOffset || this.songData.ubiartConverted ? this.songData.videoOffset : this.songData.nohudOffset || 0,
            Odieven: this.isEven(Math.round(beats[0] / ((beats[1] - beats[0])))),
            Lyrics: lyrics,
            LyricsLine: this.lyricsManager.generateLineLyrics(lyrics),
            Pictos: this.songData.pictos || [],
            currentTime: 0,
            isDone: false,
            PictosSlideDur: 2100 + Math.round(this.calculateAverageBeatTime(beats)),
            PictosHideDur: 200 + (this.calculateAverageBeatTime(beats) / 5),
            goldMoves: this.songData.goldMoves || this.songData.goldEffects || [],
            Moves0: this.gamevar.isCamera ? (this.songData['moves0-kinect'] || this.songData.moves0) || [] : this.songData.moves0 || [],
            Moves1: this.gamevar.isCamera ? (this.songData['moves1-kinect'] || this.songData.moves1) || [] : this.songData.moves1 || [],
            Moves2: this.gamevar.isCamera ? (this.songData['moves2-kinect'] || this.songData.moves2) || [] : this.songData.moves2 || [],
            Moves3: this.gamevar.isCamera ? (this.songData['moves3-kinect'] || this.songData.moves3) || [] : this.songData.moves3 || [],
            Moves4: this.gamevar.isCamera ? (this.songData['moves4-kinect'] || this.songData.moves4) || [] : this.songData.moves4 || [],
            Moves5: this.gamevar.isCamera ? (this.songData['moves5-kinect'] || this.songData.moves5) || [] : this.songData.moves5 || [],
            HideUI: this.songData.HideUserInterface || this.songData.HideUI || [],
            isUbiartConverted: this.songData.ubiartConverted,
            playerScore: { player1: 0, player2: 0, player3: 0, player4: 0, player5: 0, player6: 0 },
            modelsBuffer: this.gamevar.isCamera ? this.gesture || this.msm || [] : this.msm || []
        };

        // Initialize clock time to the starting offset
        this._masterClockTime = this.songVar.nohudOffset;

        console.log(this.songVar);

        this.songVar.Lyrics.push({ time: this.songVar.Beat[this.songVar.Beat.length - 1] + 2000, duration: "0", text: "", isLineEnding: 1 });
        window.getSongVar = () => this.songVar;
        this.scoreMgr = new PlayerScoreManager(this.songVar);

        // Initialize video and set up event listeners. DO NOT PLAY YET.
        this.videoManager.on('ready', () => {
            console.log("VideoManager 'ready' event fired. Media is ready.");
            this._resolveMediaReady();
        });

        this.videoManager.on('stateChange', ({ state }) => {
            if (state === 'playing' && !this._isUserPaused) {
                this._synchronizeClocks();
                this._isClockRunning = true;
            } else if (state === 'paused' || state === 'buffering') {
                if (this._isClockRunning) {
                    this._updateMasterClock(); 
                    this._isClockRunning = false;
                }
            }
        });

        await this.videoManager.initializeVideo(this.songVar);
    }

    setupUIElements() {
        const ui = { pictos: this.hud.querySelector("#pictos"), lyrics: this.hud.querySelector("#lyrics"), pictosbeat: this.hud.querySelector("#beat") };
        ui.pictos.setAttribute("NumCoach", this.songData.NumCoach);
        if (this.songData.NumCoach > 1) {
            ui.pictos.classList.add('multi-coach');
        }
        if (this.gamevar.isDebugged) {
            document.querySelector(".OffsetNohud").innerHTML = this.songVar.nohudOffset;
            document.querySelector(".OffsetAudio").innerHTML = this.songVar.audioOffset;
        }
        this.hud.classList.add("show");
        this.hud.style.setProperty("--menu-color", this.songData.lyricsColor);
    }

    initializeHudLoop() {
        if (this.loopUI) return this.loopUI;

        console.log("Initializing HUD loop");
        let isInitLine = true;
        let lastPeriodicSync = 0;
        const SYNC_INTERVAL_MS = 100; 

        const loopUI = setInterval(() => {
            this._updateMasterClock();
            this.updateGameState();
            this.checkSongEnd();

            if (!this._isClockRunning) {
                return; // Don't run game logic if paused, buffering, or ended
            }

            // --- Periodic Self-Correction ---
            const now = performance.now();
            if (now - lastPeriodicSync > SYNC_INTERVAL_MS) {
                this._synchronizeClocks();
                lastPeriodicSync = now;
            }

            // --- Game Logic ---
            this.updateBeat();

            if (isInitLine && this.songVar.LyricsLine.length > 0) {
                try {
                    if (this.songVar.currentTime >= this.songVar.LyricsLine[0].time - 1000 + this.songVar.nohudOffset) {
                        this.lyricsManager.LyricsScroll(this.songVar.LyricsLine[this.offset.lyricsLine]);
                        isInitLine = false;
                    }
                } catch (err) {
                    console.log('Failed to init lyrics: ' + err);
                    isInitLine = false;
                }
            }

            this.updateLyrics();
            this.updatePictos();
            this.updateGoldMoves();
            this.updatePlayerMoves();
            this.updateHideUI();
        }, 4); // Run the loop at ~250fps for high-resolution updates

        return loopUI;
    }

    updateGameState() {
        this.songVar.currentTime = this._masterClockTime;
        if (this.gamevar.isDebugged) {
            document.querySelector(".currentTimeV").innerHTML = this.songVar.currentTime - this.songVar.nohudOffset;
        }
    }

    updateBeat() {
        if (this.songVar.Beat[this.offset.beat] + this.songVar.nohudOffset < this.songVar.currentTime) {
            if (this.gamevar.isDebugged) document.querySelector(".currentBeatV").innerHTML = this.songVar.Beat[this.offset.beat];
            const beatDuration = this.songVar.Beat[this.offset.beat + 1] - this.songVar.Beat[this.offset.beat];
            document.querySelector("#beat").style.animationDuration = `${Math.round(beatDuration)}ms`;
            document.querySelector("#beat-grad").style.animationDuration = `${Math.round(beatDuration)}ms`;
            this.hud.classList.remove("beat");
            void this.hud.offsetHeight; // Force reflow
            this.hud.classList.add("beat");
            this.songVar.Odieven = !this.songVar.Odieven;
            this.hud.classList.toggle("odd", this.songVar.Odieven);
            this.hud.classList.toggle("even", !this.songVar.Odieven);
            this.offset.beat++;
        }
    }

    checkSongEnd() {
        const video = this.videoManager.getVideo();
        if ((this.songVar.Beat[this.songVar.Beat.length - 1] + this.songVar.nohudOffset) < this.songVar.currentTime ||
            (video.duration > 0 && video.currentTime >= video.duration - 0.1)) {
            if (!this.songVar.isDone) {
                this._isClockRunning = false;
                clearInterval(this.loopUI);
                this.loopUI = null;
                this.songVar.isDone = true;
                const finalScores = this.songVar.playerScore;
                const songData = this.songData;

                TransitionManager.startTransition(1, () => {
                    if (window.players) Object.values(window.players).forEach(p => { if (p.moveMotionData) p.moveMotionData = {}; });
                    if (window.phoneController) window.phoneController.off('motion');
                    this.scoreMgr.destroy();
                    this.videoManager.cleanup();
                    require("../scoreRecapScreen.js").startScoreRecapScreen(finalScores, songData);
                });
                // --- END MODIFICATION ---
            }
        }
    }

    updateLyrics() {
        try {
            const currentLine = this.songVar.LyricsLine[this.offset.lyricsLine];
            if (currentLine && currentLine.time - (currentLine.duration < 150 ? 0 : 150) + this.songVar.nohudOffset < this.songVar.currentTime) {
                if (this.gamevar.isDebugged) document.querySelector(".currentLyricsLineV").innerHTML = currentLine.text;
                const nextLine = this.songVar.LyricsLine[this.offset.lyricsLine + 1] || { text: "" };
                const timeDiff = (this.songVar.Lyrics[currentLine.offset + 1]?.time || 0) - (currentLine.time + currentLine.duration);
                this.lyricsManager.LyricsScroll(nextLine, 0, timeDiff);
                this.offset.lyricsLine++;
            }
        } catch (err) { }

        try {
            const currentLyric = this.songVar.Lyrics[this.offset.lyrics];
            if (currentLyric && currentLyric.time + this.songVar.nohudOffset < this.songVar.currentTime) {
                const nextLyric = this.songVar.Lyrics[this.offset.lyrics + 1];
                const isLineEnding = currentLyric.isLineEnding === 1;
                const isOverlapping = isLineEnding && nextLyric && currentLyric.time >= nextLyric.time;
                if (!isOverlapping) {
                    this.lyricsManager.LyricsFill(currentLyric.text, currentLyric.duration, this.offset.lyrics, isLineEnding, true);
                }
                this.offset.lyrics++;
            }
        } catch (err) { }
    }

    updatePictos() {
        try {
            const currentPicto = this.songVar.Pictos[this.offset.pictos];
            if (currentPicto && currentPicto.time + this.songVar.nohudOffset - this.songVar.PictosSlideDur < this.songVar.currentTime) {
                const atlasImage = this.pictosAtlas.images[currentPicto.name];
                const pictoInfo = this.pictosManager.ShowPictos(
                    atlasImage ? (this.pictosAtlas.isUbiArt ? currentPicto.name : 'a') : `pictos/${currentPicto.name}`,
                    atlasImage || [0, 0],
                    this.songVar.PictosSlideDur, this.songVar.PictosHideDur,
                    `${this.pictosAtlas.imageSize.width}x${this.pictosAtlas.imageSize.height}`
                );
                if (pictoInfo) pictoInfo.startVideoTime = this.songVar.currentTime;
                this.offset.pictos++;
            }
            this.pictosManager.updatePictosAnimations(this.songVar.currentTime);
        } catch (err) { console.error("Error in updatePictos:", err); }
    }

    updateGoldMoves() {
        try {
            const currentGoldMove = this.songVar.goldMoves[this.offset.goldMoves];
            if (currentGoldMove && currentGoldMove.time + this.songVar.nohudOffset - 2100 < this.songVar.currentTime) {
                this.triggerGoldEffect(false);
                document.querySelector('#goldmove').classList.remove('Explode');
                document.querySelector('#goldmove').classList.add('getReady');
                this.offset.goldMoves++;
            }
        } catch (err) { }

        try {
            const currentExplode = this.songVar.goldMoves[this.offset.goldMovesExplode];
            if (currentExplode && currentExplode.time + this.songVar.nohudOffset < this.songVar.currentTime) {
                document.querySelector('#goldmove').classList.remove('getReady');
                document.querySelector('#goldmove').classList.add('Explode');
                this.triggerGoldEffect(true);
                this.offset.goldMovesExplode++;
                setTimeout(() => document.querySelector('#goldmove').classList.remove('Explode'), 1300);
            }
        } catch (err) { }
    }

    updatePlayerMoves() {
        const now = this.songVar.currentTime;
        const nohud = this.songVar.nohudOffset;
        const mgr = this.scoreMgr;

        for (let coachIdx = 0; coachIdx < 6; coachIdx++) {
            const movesArr = this.songVar[`Moves${coachIdx}`] || [];
            const offsetKey = `moves${coachIdx}`;
            let idx = this.offset[offsetKey];

            while (idx < movesArr.length) {
                const move = movesArr[idx];
                if ((move.time + nohud + move.duration + 50) > now) break;
                //add 50ms end delay incase the wireless sending data delayed
                for (const player of Object.values(window.players)) {
                    if (player.isActive && player.currentSelectedCoach === coachIdx) {
                        const playerIndex = player.id - 1;
                        const moveMotionData = player.moveMotionData?.[`${move.time}`];
                        if (moveMotionData && moveMotionData.length > 0 && move.name) {
                            mgr.scoreMove(playerIndex, `${move.name}.msm`, moveMotionData, !!move.goldMove, coachIdx, move.duration)
                                .catch(err => console.error(`Scoring error for player ${playerIndex + 1}: ${err}`));
                        } else {
                            mgr.postPlayerFeedback(playerIndex, move.goldMove ? 'badgold' : 'bad', !!move.goldMove, 0, coachIdx);
                        }
                    }
                }
                idx++;
            }
            this.offset[offsetKey] = idx;
        }
    }

    initPhoneControllers() {
        if (!window.phoneController) return;
        console.log("Initializing phone motion tracking");

        if (!window.players) window.players = {};
        Object.values(window.players).forEach(p => { if (!p.moveMotionData) p.moveMotionData = {}; });

        window.phoneController.on('motion', ({ phoneId, data, timestamp }) => {
            try {
                const player = window.players[`player${phoneId + 1}`];
                if (!player || !player.isActive) return;

                const coachIdx = player.currentSelectedCoach || 0;
                const moves = this.songVar[`Moves${coachIdx}`] || [];
                const activeMove = moves.find(move => {
                    const start = move.time + this.songVar.nohudOffset;
                    const end = start + move.duration;
                    return this.songVar.currentTime >= start && this.songVar.currentTime <= end;
                });

                if (activeMove) {
                    const motionSample = { timestamp, accel: [data.x, data.y, data.z] };
                    const moveKey = `${activeMove.time}`;
                    if (!player.moveMotionData[moveKey]) player.moveMotionData[moveKey] = [];
                    player.moveMotionData[moveKey].push(motionSample);
                }
            } catch (err) { console.error("Error processing motion data:", err); }
        });
    }

    updateHideUI() {
        try {
            const currentHideUI = this.songVar.HideUI[this.offset.hideUI];
            if (currentHideUI) {
                const hideStart = currentHideUI.time + this.songVar.nohudOffset;
                const hideEnd = hideStart + currentHideUI.duration;
                if (this.songVar.currentTime >= hideStart && this.songVar.currentTime < hideEnd) {
                    this.hud.classList.remove("show");
                } else if (this.songVar.currentTime >= hideEnd) {
                    this.hud.classList.add("show");
                    this.offset.hideUI++;
                }
            }
        } catch (err) { }
    }

    triggerGoldEffect(isReady) {
        SFXManager.play(isReady ? 'aspirationGM' : 'explodeGM');
    }

    cleanup() {
        if (this.loopUI) {
            clearInterval(this.loopUI);
            this.loopUI = null;
        }
        this.videoManager.cleanup();
        this.songData = {};
        this.songVar = {};
    }
}