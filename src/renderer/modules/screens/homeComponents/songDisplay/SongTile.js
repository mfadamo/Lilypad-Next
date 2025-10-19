
// src/renderer/modules/screens/homeComponents/songDisplay/SongTile.js - Song tile
import { playSong } from '../api.js';

export function renderSongTile(song) {
  
  console.log(song)
  const songGridItem = document.createElement('div');
  songGridItem.className = 'song-grid-item';
  songGridItem.setAttribute('uinavable', '');
  songGridItem.setAttribute('data-song-id', song.id);
  
  songGridItem.innerHTML = `
    <img class="song-cover" src="${song.assets.coverImageUrl || require('../../../../../assets/texture/defaultCover.png')}" alt="${song.title}" onerror="this.src='${require('../../../../../assets/texture/defaultCover.png')}'">
    <div class="song-grid-info">
      <h3 class="song-title">${song.title}</h3>
      <p class="song-subtitle">${song.artist}</p>
    </div>
    <div class="difficulty-bars">
      ${Array(4).fill().map((_, i) => `<span class="bar ${i < song.difficulty ? 'filled' : ''}"></span>`).join('')}
    </div>
  `;
  
  // Add click handler
  songGridItem.addEventListener('click', () => {
    playSong(song.mapName);
  });
  
  return songGridItem;
}
