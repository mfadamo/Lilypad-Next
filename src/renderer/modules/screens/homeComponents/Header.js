// src/renderer/modules/screens/homeComponents/Header.js - Header component
export function setupHeader() {
    const headerContainer = document.querySelector('.home-header');
    
    headerContainer.innerHTML = `
      <div class="profile-section">
        <span class="player-name">Player 1</span>
        <div class="avatar" uinavable=""></div>
      </div>
    `;
  }
  