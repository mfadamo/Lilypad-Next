
// src/renderer/modules/screens/homeComponents/filters/FilterDropdown.js - Filter dropdown
import { store } from '../state.js';
import { renderSongGrid } from '../songDisplay/SongGrid.js';

export function createFilterDropdown(label, filterType) {
  const dropdown = document.createElement('div');
  dropdown.className = 'filter-dropdown';
  dropdown.setAttribute('uinavable', '');
  dropdown.setAttribute('data-filter', filterType);
  
  dropdown.innerHTML = `
    <span>${label}</span>
    <span class="dropdown-arrow">▼</span>
  `;
  
  // Add click handler
  dropdown.addEventListener('click', function() {
    if (filterType === 'sorting') {
      store.currentFilters.sorting = store.currentFilters.sorting === 'by product' ? 'alphabetical' : 'by product';
      this.querySelector('span').textContent = `Sorting: ${store.currentFilters.sorting}`;
    } else if (filterType === 'order') {
      store.currentFilters.order = store.currentFilters.order === 'owned songs first' ? 'all songs' : 'owned songs first';
      this.querySelector('span').textContent = `Order: ${store.currentFilters.order}`;
    }
    renderSongGrid();
  });
  
  return dropdown;
}
