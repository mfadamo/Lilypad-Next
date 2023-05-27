fetch(`${gamevar.server.api}/v1/songs/published`).then(response => response.json()).then(data => {
    let list = document.querySelector(".songlist-container");
     
    data.forEach((item) => {
      let li = document.createElement("div");
      li.classList.add('itemsong')
      li.classList.add(item.id)
      li.innerHTML = `<div class="song--decoration"><img src="${item.base}/assets/web/${item.id.toLowerCase()}_small.jpg"></img></div>
      <span class="song-title">${item.name}</span>`;
      li.addEventListener('click', function(){
        gfunc.playSfx(23700, 24000);
        document.querySelector('.itemsong.selected') && document.querySelector('.itemsong.selected').classList.remove('selected')
        setSelectedItem(item.id, item)
        document.querySelector('#gamevar').style.setProperty('--song-codename', item.id)
      })
      list.appendChild(li);
    })
    setSelectedItem(data[0].id)
})

function setSelectedItem(cdn, list) {
    gamevar.selectedBase = list.base
    document.querySelector(`.itemsong[class*="${cdn}"]`).classList.add('selected')
    const preview = document.querySelector("#preview")
    const videoplayer = preview.querySelector('.video--preview')
    fetch(`${gamevar.server.jdns}/getPreviewVideo?song=${cdn}`, {
        headers: {
            'x-platform': 'web',
        }
    }).then(response => response.json()).then(data => {
        if(!gamevar.nohudList)gamevar.selectedVideos = `https://mp4.justdancenow.com/${data.cookie.split('acl=/')[1].split('~hmac=')[0]}?hlscookie=${data.cookie}`
        videoplayer.src = data.url
        videoplayer.play()
    })
    
}
function startsWithNumber(str) {
    return /^\d/.test(str);
  }
function dance() {
    gfunc.playSfx(0, 3000);
    gfunc.startTransition(true, 'scene/ui/hud.html', 'scene/act/hud.js')
}