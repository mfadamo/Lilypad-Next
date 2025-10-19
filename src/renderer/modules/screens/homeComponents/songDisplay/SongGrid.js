// src/renderer/modules/screens/homeComponents/songDisplay/SongGrid.js
import { store } from '../state.js';
import { renderSongTile } from './SongTile.js';

// Function to initially set up the songs grid
export function setupSongGrid(container) {
  if (!container) {
    container = document.createElement('div');
    container.className = 'songs-grid';
  }
  
  // Initial rendering of the grid
  renderSongGrid();
  
  return container;
}

// Function to render the song grid with applied filters
export function renderSongGrid() {
  const gridContainer = document.querySelector('.songs-grid');
  if (!gridContainer) return;
  
  gridContainer.innerHTML = '';
  
  // Apply filters if necessary
  let filteredSongs = [...store.songsList];
  
  // Sort songs based on current filters
  if (store.currentFilters.sorting === 'by product') {
    // Sort logic here
  } else if (store.currentFilters.sorting === 'alphabetical') {
    filteredSongs.sort((a, b) => a.title.localeCompare(b.title));
  }
  
  // Apply order filter
  if (store.currentFilters.order === 'owned songs first') {
    // Assuming we have an "owned" property in the song object
    filteredSongs.sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0));
  }
  
  // Apply category filters if any are selected
  if (store.currentFilters.categories.length > 0) {
    filteredSongs = filteredSongs.filter(song => 
      store.currentFilters.categories.some(category => 
        song.tags && song.tags.includes(category)
      )
    );
  }
  
  // Create and append song grid items
  filteredSongs.forEach(song => {
    const songGridItem = renderSongTile(song);
    gridContainer.appendChild(songGridItem);
  });
}