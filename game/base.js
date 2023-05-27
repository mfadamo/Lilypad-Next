var bkg_audio = document.getElementById("bkg_audio");
const gamevar = {
    server: {
        storage: 'https://jdnow-api-contentapistoragest.justdancenow.com',
        hls: 'https://hls.justdancenow.com',
        jdns: 'https://sin-prod-jdns.justdancenow.com',
        api: 'https://sin-prod-api.justdancenow.com'
    }
}
const gfunc = {}

// Function to load the 'load.html' file and apply it dynamically
function loadAnotherHTML(path, jspath) {
  fetch(path)
    .then(response => response.text())
    .then(html => {
      document.getElementById('sceneDraw').innerHTML = html;
    })
    .then(() => {

      if (jspath) loadJS(jspath)
    })
    .catch(error => {
      console.log('Error loading HTML:', error);
    });
}
function loadJS(path) {
  const oldScene = document.querySelector(".CurrentScene");
  if (oldScene) oldScene.remove()
  const scripts = document.createElement("script");
  scripts.classList.add("CurrentScene")
  scripts.src = path;
  document.body.appendChild(scripts);
}
loadAnotherHTML('scene/ui/bootscreen.html', 'scene/act/bootscreen.js')
function setAudiobkgVol(po) {
  var vid = document.getElementById("bkg_audio");
  vid.volume = po;
}


let initialWidth = 690;
let initialHeight = 690;

function adjustGameDimensions() {
  const gameElement = document.getElementById("Game");
  const aspectRatio = 16 / 9;
  const { clientWidth, clientHeight } = document.documentElement;

  if (clientWidth / clientHeight > aspectRatio) {
    const newHeight = clientHeight;
    const newWidth = newHeight * aspectRatio;
    adjustElementSize(newWidth, newHeight, gameElement);
  } else {
    const newWidth = clientWidth;
    const newHeight = newWidth / aspectRatio;
    adjustElementSize(newWidth, newHeight, gameElement);
  }
}

function adjustElementSize(newWidth, newHeight, element) {
  element.style.width = `${newWidth}px`;
  element.style.height = `${newHeight}px`;

  const baseFontSize = 120; // Base font size in pixels
  const scaleFactor = Math.min(newWidth / initialWidth, newHeight / initialHeight);
  const fontSizeInPixels = baseFontSize * scaleFactor;
  element.style.fontSize = `${fontSizeInPixels}px`;
}

gfunc.playSfx = (start, end, volume = 1) => {
  var audio = new Audio('assets/audio/ui/sfx-sprite.mp3');
  audio.currentTime = start / 1000;
  audio.volume = volume
  audio.play();

  setTimeout(() => {
    audio.pause();
    audio.currentTime = end / 1000;
    audio.remove();
  }, (end - start));
};

 gfunc.startTransition = (changeScene = false, htmlPath, jsPath, scrollTime = 1) => {
const transitionScene = document.querySelector('.sceneTransition');
transitionScene.classList.add('fadeIn');
transitionScene.style.visibility = "visible"
if(scrollTime == 0)gfunc.playSfx(3200, 4900, 1)
setTimeout(function(){
    transitionScene.classList.remove('fadeIn');
    transitionScene.classList.add('fadeOut');
    if(changeScene)loadAnotherHTML(htmlPath, jsPath);
    if(scrollTime == 1)gfunc.playSfx(3200, 4900, 1)
    setTimeout(function(){
        transitionScene.classList.remove('fadeOut');
        transitionScene.style.visibility = "hidden"
        if(scrollTime == 3)gfunc.playSfx(3200, 4900, 1)
    }, 1000)
}, 2000)
}

gfunc.getFileText = (url) => {
  return fetch(url)
    .then(response => response.json())

}

window.addEventListener("resize", adjustGameDimensions);
adjustGameDimensions()
