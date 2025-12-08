// src/renderer/modules/screens/homeComponents/songDisplay/SongTile.js
import { playSong } from '../api.js';

export function renderSongTile(song) {
  const songGridItem = document.createElement('div');
  songGridItem.className = 'song-grid-item';
  songGridItem.setAttribute('uinavable', '');
  songGridItem.setAttribute('data-song-id', song.id);
  
  songGridItem.innerHTML = `
    <img class="song-cover" src="${song.assets.coverImageUrl || require('../../../../../assets/texture/defaultCover.png')}" alt="${song.title}" onerror="this.src='${require('../../../../../assets/texture/defaultCover.png')}'">
    
    <div class="song-grid-info">
      <h3 class="song-title">${song.title}</h3>
      <p class="song-subtitle">${song.artist}</p>
      
      <div class="difficulty-bars">
        ${Array(4).fill().map((_, i) => `<div class="bar ${i < song.difficulty ? 'filled' : ''}"></div>`).join('')}
      </div>
    </div>
  `;
  
  songGridItem.addEventListener('click', () => {
    playSong(song.mapName);
  });
  
  return songGridItem;
}
