// src/renderer/modules/screens/homeComponents/carousel/Carousel.js - Carousel component
import { store, actions } from '../state.js';
import { renderCarouselItem } from './CarouselItem.js';
import { playSong } from '../api.js';

export function setupCarousel(container) {
  // Create carousel structure
  container.innerHTML = `
    <div class="carousel-header">
      <h2>Featured Songs</h2>
      <div class="carousel-controls">
        <button class="carousel-arrow left" uinavable=""><</button>
        <button class="carousel-arrow right" uinavable="">></button>
      </div>
    </div>
    <div class="carousel-items"></div>
  `;
  
  // Add event listeners for carousel controls
  container.querySelector('.carousel-arrow.left').addEventListener('click', () => {
    actions.navigateCarousel('left');
    renderCarousel();
  });
  
  container.querySelector('.carousel-arrow.right').addEventListener('click', () => {
    actions.navigateCarousel('right');
    renderCarousel();
  });
  
  // Initial render
  renderCarousel();
  
  // Function to render the carousel items
  function renderCarousel() {
    const carouselContainer = container.querySelector('.carousel-items');
    carouselContainer.innerHTML = '';
    
    // Calculate visible items based on carousel index
    const visibleSongs = store.featuredSongs.slice(store.carouselIndex, store.carouselIndex + 3);
    
    // Create and append song tiles
    visibleSongs.forEach(song => {
      const songTile = renderCarouselItem(song);
      carouselContainer.appendChild(songTile);
      
      // Add click handler
      songTile.addEventListener('click', () => {
        playSong(song.mapName);
      });
    });
  }
}
