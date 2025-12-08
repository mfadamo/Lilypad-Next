import { store, actions } from '../state.js';
import { createFilterButton } from './FilterButton.js';
import { createFilterDropdown } from './FilterDropdown.js';
import { renderSongGrid } from '../songDisplay/SongGrid.js';

export function setupFilterSection(container) {
  // Use simple header
  const filterHeader = document.createElement('div');
  filterHeader.className = 'filter-header';
  filterHeader.innerHTML = `<h2>All Songs</h2>`;
  container.appendChild(filterHeader);

  // Category filters
  const categoryFilters = document.createElement('div');
  categoryFilters.className = 'category-filters';
  container.appendChild(categoryFilters);
  
  const filterCategories = [
    { label: "Party", category: "party" },
    { label: "Fitness", category: "fitness" },
    { label: "Extremes", category: "extreme" },
    { label: "K-Pop", category: "kpop" },
    { label: "Classics", category: "classic" }
  ];
  
  filterCategories.forEach(filter => {
    const button = createFilterButton(filter.label, filter.category);
    categoryFilters.appendChild(button);
  });

  // Song Grid
  const songsGrid = document.createElement('div');
  songsGrid.className = 'songs-grid';
  container.appendChild(songsGrid);
  
  // "Reset" button (Small link style)
  const resetButton = document.createElement('div');
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
