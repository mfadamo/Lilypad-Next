// src/renderer/modules/screens/homeComponents/api.js - API functions
import { store } from './state.js';
import { TransitionManager } from '../../transitions/default.js';

export async function fetchSongs() {
  // Request songs data using the electronAPI
  const songsData = await window.electronAPI.fetchSongList('/LilypadData/maps/');
  return songsData.data;
}

export function playSong(songId) {
  console.log(`Playing song: ${songId}`);
  // Find the song in our songs list
  const song = store.songsList.find(s => s.mapName === songId);
  if (!song) {
    console.error(`Song with ID ${songId} not found`);
    return;
  }
  
  console.log(`Starting song: ${song.title} (${song.artist})`);
  
  // Transition to gameplay/HUD screen with the selected song
  TransitionManager.startTransition(1, () => {
    // Import and initialize the HUD with the song data
    try {
      window.currentMaps = song.mapName;
      window.selectedSongDesc = song;
      require("../hudScreen.js").initHud();
      const audiomenu = document.querySelector('.menu-audio');
      audiomenu.pause();
    } catch (error) {
      console.error("Error initializing HUD:", error);
    }
  });
}