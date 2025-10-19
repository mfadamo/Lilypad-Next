import { changeSceneHTML } from '../webRenderer.js';
import { TransitionManager } from '../transitions/default.js';
import { startControllerSelect } from './connectionScreen.js';
import { setupHomeTab } from './homeComponents/tabs/HomeTab.js';
import { setupPlaylistsTab } from './homeComponents/tabs/PlaylistsTab.js';
import { setupSettingsTab } from './homeComponents/tabs/SettingsTab.js';
import { setupSidebar } from './homeComponents/navigation/Sidebar.js';
import { setupHeader } from './homeComponents/Header.js';
import { store, actions } from './homeComponents/state.js';
import { fetchSongs } from './homeComponents/api.js';
import './homeComponents/homeScreen.css';

// Main function to initialize the home screen
export async function startHomeScreen() {
  console.log("Home screen started");
  
  // Set up the basic HTML structure
  changeSceneHTML('homescreen', {
    tag: "div",
    attrs: { id: "HomeScreen" },
    children: [
      // Header section with logo and profile
      {
        tag: "div",
        attrs: { class: "home-header" },
        children: [] // Will be populated by setupHeader
      },
      
      // Navigation sidebar
      {
        tag: "div",
        attrs: { class: "nav-sidebar" },
        children: [] // Will be populated by setupSidebar
      },
      
      // Main content area for Home tab
      {
        tag: "div",
        attrs: { class: "home-content" },
        children: [] // Will be populated by setupHomeTab
      },
      
      // Playlist content area (initially hidden)
      {
        tag: "div",
        attrs: { class: "playlist-content", style: "display: none;" },
        children: [] // Will be populated by setupPlaylistsTab
      },
      
      // Settings content area (initially hidden)
      {
        tag: "div",
        attrs: { class: "settings-content", style: "display: none;" },
        children: [] // Will be populated by setupSettingsTab
      }
    ]
  });
  
  // Setup components
  setupHeader();
  setupSidebar();
  
  try {
    // Fetch songs data
    const songData = await fetchSongs();
    
    // Update store with fetched songs
    actions.setSongsList(songData);
    actions.setFeaturedSongs();
    
    // Set up tabs
    setupHomeTab();
    setupPlaylistsTab();
    setupSettingsTab();
    
    // Set initial tab
    actions.switchTab('home');
    
  } catch (error) {
    console.error("Error loading songs:", error);
    
    // Load fallback data
    actions.loadFallbackData();
    
    // Set up tabs with fallback data
    setupHomeTab();
    setupPlaylistsTab();
    setupSettingsTab();
    
    // Set initial tab
    actions.switchTab('home');
  }
}