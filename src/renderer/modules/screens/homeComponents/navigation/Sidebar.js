// src/renderer/modules/screens/homeComponents/navigation/Sidebar.js
import { startControllerSelect } from '../../connectionScreen.js';
import { TransitionManager } from '../../../transitions/default.js';
import { actions } from '../state.js';

export function setupSidebar() {
  const sidebarContainer = document.querySelector('.nav-sidebar');
  
  sidebarContainer.innerHTML = `

  <div style="flex-grow: 1"></div>

    <div class="nav-item active" uinavable="" data-tab="home">
      <img src="${require('../../../../../assets/texture/home-icon.png')}">
    </div>
    <div class="nav-item" uinavable="" data-tab="playlists">
      <img src="${require('../../../../../assets/texture/playlist-icon.png')}">
    </div>
    <div class="nav-item" uinavable="" data-tab="settings">
      <img src="${require('../../../../../assets/texture/settings-icon.png')}">
    </div>
    
    <div style="flex-grow: 1"></div>
    
    <div class="nav-item controller-button" uinavable="">
      <img src="${require('../../../../../assets/texture/controller-icon.png')}">
    </div>
  `;
  
  document.querySelectorAll('.nav-item[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      actions.switchTab(tab.getAttribute('data-tab'));
      
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      tab.classList.add('active');
    });
  });
  
  document.querySelector('.controller-button').addEventListener('click', () => {
    TransitionManager.startTransition(1, startControllerSelect);
  });
}