// src/renderer/modules/screens/homeComponents/tabs/HomeTab.js - Home tab
import { store, actions } from '../state.js';
import { setupCarousel } from '../carousel/Carousel.js';
import { setupSongGrid } from '../songDisplay/SongGrid.js';
import { setupFilterSection } from '../filters/FilterSection.js';
import { playSong } from '../api.js';

export function setupHomeTab() {
  const homeContent = document.querySelector('.home-content');
  
  // Set up spinner section
  const spinnerSection = document.createElement('div');
  spinnerSection.className = 'song-spinner';
  spinnerSection.innerHTML = `
    <div class="spinner-content">
      <img src="${require('../../../../../assets/texture/spin-icon.png')}" class="spin-icon">
      <div class="spinner-text">
        <h3>Spin the wheel to play a random song!</h3>
        <p>Based on your library filters and owned songs.</p>
      </div>
    </div>
    <button class="surprise-button" uinavable="">Surprise me!</button>
  `;
  
  // Add surprise button event listener
  spinnerSection.querySelector('.surprise-button').addEventListener('click', () => {
    // Pick random song and start game
    if (store.songsList.length > 0) {
      const randomIndex = Math.floor(Math.random() * store.songsList.length);
      playSong(store.songsList[randomIndex].id);
    }
  });
  
  homeContent.appendChild(spinnerSection);
  
  // Set up carousel section
  const carouselSection = document.createElement('div');
  carouselSection.className = 'songs-carousel';
  homeContent.appendChild(carouselSection);
  
  setupCarousel(carouselSection);
  
  // Set up filter and songs grid section
  const filterSection = document.createElement('div');
  filterSection.className = 'filter-section';
  homeContent.appendChild(filterSection);
  
  setupFilterSection(filterSection);
  setupSongGrid(filterSection.querySelector('.songs-grid'));
}
