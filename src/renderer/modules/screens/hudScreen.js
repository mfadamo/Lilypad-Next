// modules/screen/hud.js
import HudController from './hudComponents/hudController.js';
import SongDataLoader from './hudComponents/songDataLoader.js';
import CoachSelectionManager from './hudComponents/coachSelectionManager.js';
import PauseMenuManager from './hudComponents/pauseMenuManager.js';
import { changeSceneHTML } from '../webRenderer.js';
import { TransitionManager } from '../transitions/default.js'
import { SFXManager } from '../audio/sfx.js';
import './hudComponents/hud.css';


// Initialize game variables
const gamevar = window.gamevar || {};

// Set up initial game state
const initializeGameState = () => {
  gamevar.isPaused = false;
  gamevar.isOnCoachSelection = true;
  gamevar.isDebugged = false;
  gamevar.useSeperateAudio = true
  gamevar.cdn = window.currentMaps || "AboutDamnTime";
  gamevar.mapsReady = false;
  gamevar.isCamera = window.isCamera || false;
  gamevar.selectedBase = `/LilypadData/maps/${gamevar.cdn}/`;

  return {
    isWalking: false,
    selectedPause: 1,
    currentTimer: 0
  };
};

// Main entry point
export const initHud = () => {
  window.starfield.pause()

  window.connectedPlayers = [];
  window.playerColors = ["blue", "red", "green", "pink", "orange", "purple"];
  console.log('initHud: Initializing window.connectedPlayers:', window.connectedPlayers);

  const GameUI = {
    tag: "div",
    attrs: { id: "GameUI" },
    children: [
      {
        tag: "div",
        attrs: { id: "coachselection" },
        children: [
          { tag: "audio", attrs: { class: "preview", loop: true } },
          { tag: "div", attrs: { class: "banner-bkg" } },
          {
            tag: "div",
            attrs: { id: "coach-container" },
            children: Array.from({ length: 6 }, (_, i) => ({
              tag: "div",
              attrs: { class: `coach-${i + 1}` },
              children: [
                {
                  tag: "div",
                  attrs: { class: "coach-image" }
                },
                {
                  tag: "div",
                  attrs: { class: "players-slot" },
                  children: Array.from({ length: 6 }, (_, j) => ({
                    tag: "div",
                    attrs: { class: "player-slot hidden", "data-player-index": j },
                    children: [
                      {
                        tag: "span",
                        attrs: { class: "player-name" },
                        children: [` `]
                      }
                    ]
                  }))
                }
              ]
            }))
          },
          {
            tag: "div",
            attrs: { class: "button--continue", onclick: "startSong()", uinavable: "", style: "display: none;" },
            children: [{ tag: "span", attrs: { class: "txt-dance" }, children: ["DANCE!"] }]
          },
          { tag: "span", attrs: { class: "txt-loading" }, children: ["Hold on, We're loading the data..."] }
        ]
      },
      {
        tag: "div",
        attrs: { id: "pausescreen" },
        children: [
          { tag: "span", attrs: { class: "txt-pause" }, children: ["PAUSED"] },
          {
            tag: "div",
            attrs: { class: "list-wrapper" },
            children: [
              {
                tag: "div",
                attrs: { class: "songlist-container" },
                children: [
                  {
                    tag: "div",
                    attrs: { class: "itempause Exit", uinavable: "" },
                    children: [
                      {
                        tag: "div",
                        attrs: { class: "song--decoration" },
                        children: [{ tag: "img", attrs: { loading: "lazy", src: require("../../../assets/texture/ui/pause_exit.webp") } }]
                      },
                      { tag: "span", attrs: { class: "song-title" }, children: ["Exit"] }
                    ]
                  },
                  {
                    tag: "div",
                    attrs: { class: "itempause Continue", uinavable: "" },
                    children: [
                      {
                        tag: "div",
                        attrs: { class: "song--decoration" },
                        children: [{ tag: "img", attrs: { loading: "lazy", src: require("../../../assets/texture/ui/pause_continue.webp") } }]
                      },
                      { tag: "span", attrs: { class: "song-title" }, children: ["Continue"] }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        tag: "div",
        attrs: { class: "hud", style: "display: none;" },
        children: [
          {
            tag: "div",
            attrs: { id: "debugger", style: "opacity: 0;" },
            children: [
              { tag: "span", attrs: { class: "currentTime" }, children: ["Current: ", { tag: "span", attrs: { class: "currentTimeV" } }] },
              { tag: "span", attrs: { class: "currentBeat" }, children: ["Current Beat: ", { tag: "span", attrs: { class: "currentBeatV" } }, " + ", { tag: "span", attrs: { class: "OffsetNohud" } }] },
              { tag: "span", attrs: { class: "currentLyrics" }, children: ["Current Lyrics Position: ", { tag: "span", attrs: { class: "currentLyricsV" } }] },
              { tag: "span", attrs: { class: "currentLyricsLine" }, children: ["Current Lyrics Line: ", { tag: "span", attrs: { class: "currentLyricsLineV" } }] },
              { tag: "span", attrs: { class: "currentMoves" }, children: ["Current Moves0: ", { tag: "span", attrs: { class: "currentMoves0" } }, ".msm"] },
              { tag: "span", attrs: { class: "currentMoves" }, children: ["Current Moves1: ", { tag: "span", attrs: { class: "currentMoves1" } }, ".msm"] }
            ]
          },
          { tag: "span", attrs: { class: "msp-debug"}, children: [] },
          {
            tag: "div",
            attrs: { id: "players", class: `${gamevar.isCamera ? 'camera' : ''}` },
            children: window.playerColors.map((color, i) => ({
              tag: "div",
              attrs: { id: "player-container", class: `player-container player${i + 1} ${color} hidden`, "data-player-index": i },
              children: [
                { tag: "div", attrs: { class: "player-color" } },
                {
                  tag: "div", attrs: {
                    class: "hud-stars",
                  },
                  children: [
                    { tag: "div", attrs: { class: "star star1" } },
                    { tag: "div", attrs: { class: "star star2" } },
                    { tag: "div", attrs: { class: "star star3" } },
                    { tag: "div", attrs: { class: "star star4" } },
                    { tag: "div", attrs: { class: "star star5" } },
                  ]
                },
                { tag: "span", attrs: { class: "player-name" }, children: [` `] },
                { tag: "canvas", attrs: { class: "particle-canvas", width: "200", height: "200" } },
                {
                  tag: "div",
                  attrs: { class: "feedback-container" },
                  children: ["badgold", "bad", "ok", "good", "super", "perfect", "yeah"].map(feedback => ({
                    tag: "div",
                    attrs: { class: `feedback-${feedback}` },
                    children: [
                      { tag: "div", attrs: { class: `feedlabel ${feedback}-text` } },
                      { tag: "div", attrs: { class: `feedback-bkg ${feedback}-bkg` } }
                    ]
                  }))
                }
              ]
            }))
          },
          {
            tag: "div",
            attrs: { id: "racetrack" },
            children: [
              { tag: "div", attrs: { class: "raceline-bkg" } },
              {
                tag: "div",
                attrs: { class: "raceline-bar-container" },
                children: window.playerColors.map((color, i) => ({
                  tag: "div",
                  attrs: { class: `raceline-bar player${i + 1} ${color} hidden`, "data-player-index": i }
                }))
              },
              {
                tag: "div", attrs: {
                  class: "hud-stars",
                }, children: [
                  { tag: "div", attrs: { class: "star star1" } },
                  { tag: "div", attrs: { class: "star star2" } },
                  { tag: "div", attrs: { class: "star star3" } },
                  { tag: "div", attrs: { class: "star star4" } },
                  { tag: "div", attrs: { class: "star star5" } },
                ]
              },
            ]
          },
          {
            tag: "div",
            attrs: { id: "pictos" },
            children: [
              { tag: "div", attrs: { id: "beat" } },
              { tag: "div", attrs: { id: "beat-grad" } }
            ]
          },
          {
            tag: "div",
            attrs: { id: "goldmove" },
            children: [
              { tag: "div", attrs: { class: "layer layer-1" } },
              { tag: "div", attrs: { class: "layer layer-2" } },
              { tag: "div", attrs: { class: "layer layer-3" } }
            ]
          },
          { tag: "div", attrs: { id: "lyrics" } }
        ]
      }
    ]
  };


  changeSceneHTML('hud', GameUI);

  const updatePlayerUI = () => {
    console.log('updatePlayerUI: Called. Current connectedPlayers:', window.connectedPlayers);
    const coachPlayerSlots = document.querySelectorAll('#coachselection .player-slot');
    const hudPlayerContainers = document.querySelectorAll('#players .player-container');
    const racetrackBars = document.querySelectorAll('#racetrack .raceline-bar');

    // Hide all player elements initially
    coachPlayerSlots.forEach(slot => {
      slot.classList.add('hidden');
      slot.querySelector('.player-name').textContent = ' ';
    });
    hudPlayerContainers.forEach(container => {
      container.classList.add('hidden');
      container.querySelector('.player-name').textContent = ' ';
    });
    racetrackBars.forEach(bar => bar.classList.add('hidden'));

    window.connectedPlayers.forEach((player, index) => {
      console.log(`updatePlayerUI: Processing player ${player.name} at index ${index}`);
      if (index < window.playerColors.length) {
        if (coachPlayerSlots[index]) {
          coachPlayerSlots[index].classList.remove('hidden');
          coachPlayerSlots[index].querySelector('.player-name').textContent = player.name;
          console.log(`updatePlayerUI: Coach slot ${index} updated for ${player.name}`);
        }

        if (hudPlayerContainers[index]) {
          hudPlayerContainers[index].classList.remove('hidden');
          hudPlayerContainers[index].querySelector('.player-name').textContent = player.name;
        }

        if (racetrackBars[index]) {
          racetrackBars[index].classList.remove('hidden');
        }
      }
    });
  };

  // Initial UI update
  updatePlayerUI();

  // Listen for player connection/disconnection events
  if (window.phoneController) {
    console.log('initHud: window.phoneController is available. Setting up event listeners.');

    window.phoneController.on('playerConnected', (player) => {
      console.log('playerConnected event received:', player);
      const playerIndex = window.connectedPlayers.length;
      if (playerIndex < window.playerColors.length) {
        window.connectedPlayers.push({ ...player, index: playerIndex, color: window.playerColors[playerIndex] });
        console.log('playerConnected: New connectedPlayers array:', window.connectedPlayers);
        updatePlayerUI();
      } else {
        console.warn('Maximum number of players reached. Cannot add more.');
      }
    });

    window.phoneController.on('playerDisconnected', (playerId) => {
      console.log('playerDisconnected event received for playerId:', playerId);
      window.connectedPlayers = window.connectedPlayers.filter(p => p.id !== playerId);
      window.connectedPlayers.forEach((player, i) => {
        player.index = i;
        player.color = window.playerColors[i];
      });
      console.log('playerDisconnected: New connectedPlayers array:', window.connectedPlayers);
      updatePlayerUI();
    });

    console.log('initHud: Populating initial connected players from window.phoneController.players and activePhones.');
    for (let i = 0; i < window.playerColors.length; i++) {
      if (window.phoneController.activePhones.has(i)) {
        const playerKey = `player${i + 1}`;
        const player = window.phoneController.players[playerKey];
        if (player) {
          window.connectedPlayers.push({ ...player, id: playerKey, index: i, color: window.playerColors[i] });
          console.log(`initHud: Added initial player ${player.name} (index ${i}).`);
        }
      }
    }
    console.log('initHud: connectedPlayers after initial population:', window.connectedPlayers);
    updatePlayerUI();

  } else {
    console.warn('initHud: window.phoneController is not available. Player connection/disconnection will not be dynamic.');
  }


  const state = initializeGameState();

  // Initialize coach selection
  const coachSelectionManager = new CoachSelectionManager(gamevar);
  coachSelectionManager.setupCoachSelection();

  // Play initial sound effect
  SFXManager.playSfx(11424, 12046);

  // Initialize song data loader
  const songDataLoader = new SongDataLoader(gamevar);

  // Load and play song
  songDataLoader.fetchDataAndPlaySong((data, pictosAtlas, msm, gesture) => {
    const hudController = new HudController(gamevar, data, pictosAtlas, msm, gesture);
    window.hudController = hudController;
    state.currentTimer = hudController.initializeHudLoop();

    const pauseMenuManager = new PauseMenuManager(
      hudController,
      gamevar,
      state.currentTimer,
      songDataLoader
    );
    pauseMenuManager.setupPauseMenu();

    hudController.mediaReadyPromise.then(() => {
      window.showContinue();
    }).catch(error => {
      console.error("Error waiting for media to be ready:", error);
      songDataLoader.cleanup();
      alert("Failed to prepare media. Returning to home screen.");
      changeSceneHTML('home', null);
    });
  }, (error) => {
    console.error("Failed to load song data:", error);
    songDataLoader.cleanup();
    // If maps fail to load, automatically throw error and back to homescreen
    alert("Failed to load map data. Returning to home screen.");
    changeSceneHTML('home', null);
  });

  // Function to show the continue button
  window.showContinue = () => {
    document.querySelector('#coachselection .txt-loading').style.display = 'none';
    gamevar.mapsReady = true;
    SFXManager.playSfx(29139, 29600);
    document.querySelector('#coachselection .button--continue').style.display = 'flex';
  };

  window.startSong = (force=false) => {
    if (!gamevar.mapsReady && !force) {
      console.warn("Attempted to start song before maps were ready. Ignoring.");
      return;
    }

    SFXManager.playSfx(11424, 12046);

    const loadingText = document.querySelector('#coachselection .txt-loading');
    loadingText.innerHTML = 'Loading. Please Wait...';
    loadingText.style.display = 'block';

    document.querySelector('#coachselection .button--continue').style.display = 'none';
    gamevar.isOnCoachSelection = false;

    setTimeout(() => {
      const videoPlayer = document.querySelector('.video--preview');
      videoPlayer.pause();
      videoPlayer.src = "";

      SFXManager.playSfx(0, 3000);

      TransitionManager.startTransition(1, () => {
        document.querySelector("#coachselection").style.display = "none";
        setTimeout(() => {
          if(window.phoneController)window.phoneController.broadcast({
            type: 'enableMotion',
            enabled: true
          });

          window.hudController.playMedia();
        }, 500);
      })
    }, 1500);
  };
};
