
// src/renderer/modules/screens/homeComponents/filters/FilterButton.js - Filter button
import { store, actions } from '../state.js';
import { renderSongGrid } from '../songDisplay/SongGrid.js';

export function createFilterButton(label, category) {
  const button = document.createElement('button');
  button.className = 'filter-button';
  button.setAttribute('uinavable', '');
  button.setAttribute('data-category', category);
  
  button.innerHTML = `
    <span>${label}</span>
    <span class="filter-arrow">▶</span>
  `;
  
  // Add click handler
  button.addEventListener('click', () => {
    actions.toggleCategoryFilter(category);
    
    // Update filter buttons visual state
    updateFilterButtonsState();
    
    // Re-render the song grid with new filters
    renderSongGrid();
  });
  
  return button;
}

function updateFilterButtonsState() {
  document.querySelectorAll('.filter-button').forEach(button => {
    const category = button.getAttribute('data-category');
    if (store.currentFilters.categories.includes(category)) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
}
