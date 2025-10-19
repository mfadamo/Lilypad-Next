// modules/screen/hudComponents/pauseMenuManager.js
import { SFXManager } from '../../audio/sfx';

export default class PauseMenuManager {
  constructor(hudController, gamevar, currentTimer, songDataLoader) {
    this.hudController = hudController;
    this.gamevar = gamevar;
    this.currentTimer = currentTimer;
    this.songDataLoader = songDataLoader; // Store songDataLoader
    this.onPause = false;
  }
  
  setupPauseMenu() {
    document.querySelectorAll('.itempause').forEach((item, index) => {
      item.addEventListener('click', () => this.handlePauseItemClick(index));
    });

    window.navigation.setOnBack(() => {
      if(this.onPause) {
        this.continueHud()
      }
      else {
        this.pauseHud()
      }
    })
  }
  
  handlePauseItemClick(index) {
    const currentFocused = document.querySelector('.itempause.focused');
    const clickedItem = document.querySelectorAll('.itempause')[index];
    const currentIndex = Array.from(document.querySelectorAll('.itempause')).indexOf(currentFocused);

    if (currentIndex < index) {
      SFXManager.playSfx(23605, 23864);
    } else if (currentFocused && clickedItem === currentFocused) {
      SFXManager.playSfx(63559, 63757);
    } else {
      SFXManager.playSfx(23892, 24137);
    }

    if (!clickedItem.classList.contains('focused')) {
      if (currentFocused) {
        currentFocused.classList.remove('focused');
      }
      clickedItem.classList.add('focused');
      return;
    }
    
    // Handle click on focused item
    if (clickedItem.classList.contains('focused')) {
      setTimeout(() => {
        if (index === 0) {
          // Return to home
          this.songDataLoader.cleanup(); // Call cleanup before exiting
          const video = document.querySelector('.videoplayer');
          video.currentTime = video.duration;
        }
        
        if (index === 1) {
          this.continueHud()
        }
      }, 200);
    }
  }

 continueHud() {
    this.onPause = false;
    // Resume game using the HudController
    window.hudController.resume();
          
    const pauseScreen = document.querySelector('#pausescreen');
    pauseScreen.style.opacity = 0;
    pauseScreen.style.transition = 'opacity .5s';
    
    setTimeout(() => { 
      pauseScreen.style.display = 'none';
    }, 500);
    
    document.querySelector(".overlay-hi .shortcut").innerHTML = ``;
    this.gamevar.isPaused = false;
    document.querySelector('.hud').classList.remove("paused");
  }

 pauseHud() {
    // Pause game using the HudController
    this.onPause = true;
    window.hudController.pause();
    
    const pauseScreen = document.querySelector('#pausescreen');
    pauseScreen.style.display = 'block';
    pauseScreen.style.opacity = 1;
    
    this.gamevar.isPaused = true;
    document.querySelector('.hud').classList.add("paused");
  }
}
