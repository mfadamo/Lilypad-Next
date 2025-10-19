// src/renderer/modules/screens/homeComponents/carousel/CarouselItem.js - Carousel item
export function renderCarouselItem(song) {
  const songTile = document.createElement('div');
  songTile.className = 'song-tile';
  songTile.setAttribute('uinavable', '');
  songTile.setAttribute('data-song-id', song.id);
  
  songTile.innerHTML = `
    <img class="song-cover" src="${song.assets.coverImageUrl || require('../../../../../assets/texture/defaultCover.png')}" alt="${song.title}" onerror="this.src='${require('../../../../../assets/texture/defaultCover.png')}'">
    <div class="song-info">
      <h3 class="song-title">${song.title}</h3>
      <p class="song-subtitle">${song.artist}</p>
      <div class="difficulty-bars">
        ${Array(4).fill().map((_, i) => `<span class="bar ${i < song.difficulty ? 'filled' : ''}"></span>`).join('')}
      </div>
    </div>
  `;
  
  return songTile;
}