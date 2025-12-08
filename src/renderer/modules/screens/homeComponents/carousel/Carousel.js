// src/renderer/modules/screens/homeComponents/carousel/Carousel.js
import { store, actions } from '../state.js';
import { renderCarouselItem } from './CarouselItem.js';
import { playSong } from '../api.js';

export function setupCarousel(container) {
  container.innerHTML = `
    <div class="carousel-header">
      <h2>Featured Songs</h2>
      <div class="carousel-controls">
        <!-- Chevron Left -->
        <div class="carousel-arrow left" uinavable="">&#10094;</div>
        <!-- Chevron Right -->
        <div class="carousel-arrow right" uinavable="">&#10095;</div>
      </div>
    </div>
    <div class="carousel-items"></div>
  `;
  
  container.querySelector('.carousel-arrow.left').addEventListener('click', () => {
    actions.navigateCarousel('left');
    renderCarousel();
  });
  
  container.querySelector('.carousel-arrow.right').addEventListener('click', () => {
    actions.navigateCarousel('right');
    renderCarousel();
  });

  renderCarousel();

  function renderCarousel() {
    const carouselContainer = container.querySelector('.carousel-items');
    carouselContainer.innerHTML = '';
    const visibleSongs = store.featuredSongs.slice(store.carouselIndex, store.carouselIndex + 3);
    
    visibleSongs.forEach(song => {
      const songTile = renderCarouselItem(song);
      carouselContainer.appendChild(songTile);
      songTile.addEventListener('click', () => playSong(song.mapName));
    });
  }
}