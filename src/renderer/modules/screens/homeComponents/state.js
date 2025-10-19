// src/renderer/modules/screens/homeComponents/state.js - State management
export const store = {
  currentTab: 'home',
  currentFilters: {
    sorting: 'by product',
    order: 'owned songs first',
    categories: []
  },
  carouselIndex: 0,
  songsList: [],
  featuredSongs: []
};

export const actions = {
  setSongsList(songData) {
    store.songsList = songData;
    console.log(`Loaded ${store.songsList.length} songs`);
  },
  
  setFeaturedSongs(count = 6) {
    store.featuredSongs = selectFeaturedSongs(store.songsList, count);
  },
  
  switchTab(tabName) {
    // Update the current tab in state
    store.currentTab = tabName;
    
    // Remove active class from all tabs
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to the selected tab
    document.querySelector(`.nav-item[data-tab="${tabName}"]`).classList.add('active');
    
    // Show/hide content based on selected tab
    document.querySelector('.home-content').style.display = tabName === 'home' ? 'flex' : 'none';
    document.querySelector('.playlist-content').style.display = tabName === 'playlists' ? 'flex' : 'none';
    document.querySelector('.settings-content').style.display = tabName === 'settings' ? 'flex' : 'none';
  },
  
  navigateCarousel(direction) {
    const maxIndex = Math.max(0, store.featuredSongs.length - 3);
    
    if (direction === 'left') {
      store.carouselIndex = Math.max(0, store.carouselIndex - 1);
    } else if (direction === 'right') {
      store.carouselIndex = Math.min(maxIndex, store.carouselIndex + 1);
    }
  },
  
  toggleCategoryFilter(category) {
    const index = store.currentFilters.categories.indexOf(category);
    
    if (index === -1) {
      // Add category to filters
      store.currentFilters.categories.push(category);
    } else {
      // Remove category from filters
      store.currentFilters.categories.splice(index, 1);
    }
  },
  
  resetFilters() {
    store.currentFilters.categories = [];
  },
  
  loadFallbackData() {
    store.songsList = [
      {
        id: "despacito",
        title: "Despacito",
        subtitle: "Luis Fonsi & Daddy Yankee",
        artist: "Luis Fonsi & Daddy Yankee",
        difficulty: 3,
        coverImage: require('../../../../assets/texture/defaultCover.png'),
        tags: ["Main", "LatinCorner", "Latin", "Romantic", "Summer"]
      },
      {
        id: "bang_bang",
        title: "Bang Bang!",
        subtitle: "My Neurodivergent Anthem",
        artist: "AJR",
        difficulty: 4,
        coverImage: require('../../../../assets/texture/defaultCover.png'),
        tags: ["Pop", "choreo", "High Energy"]
      },
      // Add more fallback songs here
    ];
    
    store.featuredSongs = store.songsList.slice(0, 3);
  }
};

// Helper functions for state management
function selectFeaturedSongs(songs, count = 3) {
  if (!songs.length) return [];
  
  // Sort songs based on some criteria (e.g., newest or most popular)
  // For this example, we'll just pick random songs
  const shuffled = [...songs].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function transformSongData(songData) {
  // Create a list of songs to use in the UI
  const allSongs = [];
  
  // Loop through song data and transform it
  for (const [songId, details] of Object.entries(songData)) {
    // Extract song details
    const song = {
      id: songId,
      mapName: details.mapName || songId,
      title: details.title || songId,
      subtitle: details.subtitle || details.artist || 'Unknown',
      artist: details.artist || 'Unknown Artist',
      difficulty: details.difficulty || Math.floor(Math.random() * 4) + 1,
      coverImage: (details.assets && details.assets.common && details.assets.common.coverImageUrl) || 
                 (details.assets && details.assets.x1 && details.assets.x1.coverImageUrl) || 
                 require('../../../../assets/texture/defaultCover.png'),
      tags: details.tags || []
    };
    
    allSongs.push(song);
  }
  
  return allSongs;
}
