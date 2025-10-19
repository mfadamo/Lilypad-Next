
// src/renderer/modules/screens/homeComponents/filters/FilterSection.js - Filter section
import { store, actions } from '../state.js';
import { createFilterButton } from './FilterButton.js';
import { createFilterDropdown } from './FilterDropdown.js';
import { renderSongGrid } from '../songDisplay/SongGrid.js';

export function setupFilterSection(container) {
  // Create filter header
  const filterHeader = document.createElement('div');
  filterHeader.className = 'filter-header';
  filterHeader.innerHTML = `
    <h2>All Songs</h2>
    <div class="filter-controls"></div>
  `;
  
  container.appendChild(filterHeader);
  
  // Add filter dropdowns
  const filterControls = filterHeader.querySelector('.filter-controls');
  
  const sortingDropdown = createFilterDropdown('Sorting: by product', 'sorting');
  const orderDropdown = createFilterDropdown('Order: owned songs first', 'order');
  
  filterControls.appendChild(sortingDropdown);
  filterControls.appendChild(orderDropdown);
  
  // Create category filters container
  const categoryFilters = document.createElement('div');
  categoryFilters.className = 'category-filters';
  container.appendChild(categoryFilters);
  
  // Set up category filters
  const filterCategories = [
    { label: "CHOREO STYLES", category: "choreo" },
    { label: "MUSIC GENRES", category: "genre" },
    { label: "MOODS", category: "mood" },
    { label: "DECADES", category: "decade" },
    { label: "ACCESSIBILITY", category: "accessibility" }
  ];
  
  filterCategories.forEach(filter => {
    const button = createFilterButton(filter.label, filter.category);
    categoryFilters.appendChild(button);
  });
  
  // Create songs grid container
  const songsGrid = document.createElement('div');
  songsGrid.className = 'songs-grid';
  container.appendChild(songsGrid);
  
  // Create reset filters button
  const resetButton = document.createElement('button');
  resetButton.className = 'reset-filters-button';
  resetButton.setAttribute('uinavable', '');
  resetButton.textContent = 'RESET FILTERS';
  container.appendChild(resetButton);
  
  // Add reset button event listener
  resetButton.addEventListener('click', () => {
    actions.resetFilters();
    updateFilterButtonsState();
    renderSongGrid();
  });
  
  // Update filter buttons state
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
}
