// src/renderer/modules/screens/homeComponents/filters/FilterButton.js
import { store, actions } from '../state.js';
import { renderSongGrid } from '../songDisplay/SongGrid.js';

export function createFilterButton(label, category) {
  const button = document.createElement('button');
  button.className = 'filter-button';
  button.setAttribute('uinavable', '');
  button.setAttribute('data-category', category);
  
  button.textContent = label;
  
  button.addEventListener('click', () => {
    actions.toggleCategoryFilter(category);
    updateFilterButtonsState();
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