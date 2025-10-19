// src/renderer/modules/screens/homeComponents/navigation/Sidebar.js - Navigation sidebar
import { startControllerSelect } from '../../connectionScreen.js';
import { TransitionManager } from '../../../transitions/default.js';
import { actions } from '../state.js';

export function setupSidebar() {
  const sidebarContainer = document.querySelector('.nav-sidebar');
  
  sidebarContainer.innerHTML = `
    <div class="nav-item active" uinavable="" data-tab="home">
      <img src="${require('../../../../../assets/texture/home-icon.png')}">
      <span>Home</span>
    </div>
    <div class="nav-item" uinavable="" data-tab="playlists">
      <img src="${require('../../../../../assets/texture/playlist-icon.png')}">
      <span>Playlists</span>
    </div>
    <div class="nav-item" uinavable="" data-tab="settings">
      <img src="${require('../../../../../assets/texture/settings-icon.png')}">
      <span>Settings</span>
    </div>
    <div class="nav-item controller-button" uinavable="">
      <img src="${require('../../../../../assets/texture/controller-icon.png')}">
      <span>Controller</span>
    </div>
  `;
  
  // Tab navigation event listeners
  document.querySelectorAll('.nav-item[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      actions.switchTab(tab.getAttribute('data-tab'));
    });
  });
  
  // Controller button event listener
  document.querySelector('.controller-button').addEventListener('click', () => {
    TransitionManager.startTransition(1, startControllerSelect);
  });
}
