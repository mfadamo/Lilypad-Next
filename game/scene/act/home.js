
var selectedSong = 0;
dynamicbkg.drawAnimation()

fetch(`${gamevar.server.api}/v1/songs/published`).then(response => response.json()).then(data => {
    let list = document.querySelector(".songlist-container");

    data.forEach((item, index) => {
        let li = document.createElement("div");
        li.classList.add('itemsong')
        li.classList.add(item.id)
        li.innerHTML = `<div class="song--decoration"><img loading="lazy" src="${item.base}/assets/web/${item.id.toLowerCase()}_small.jpg"></img></div>
      <span class="song-title">${item.name}</span>`;
        li.addEventListener('click', function () {
            if (selectedSong < index) {
                gfunc.playSfx(23605, 23864);
            } else {
                gfunc.playSfx(23892, 24137);
            }

            document.querySelector('.itemsong.selected') && document.querySelector('.itemsong.selected').classList.remove('selected')
            setSelectedItem(item.id, item, index)
            document.querySelector('#gamevar').style.setProperty('--song-codename', item.id)
        })
        list.appendChild(li);
    })
    document.querySelectorAll('.itemsong')[gamevar.selectedSong || 0].click()
})

function setSelectedItem(cdn, list, offset) {
    renderPreview()
    gamevar.selectedSong = offset
    gamevar.selectedMaps = list
    selectedSong = offset
    gamevar.selectedBase = list.base
    document.querySelectorAll(`.itemsong`)[offset].classList.add('selected')
    const preview = document.querySelector("#preview")
    const videoplayer = document.querySelector('.video--preview')
    if (!gamevar.preview) gamevar.preview = {}
    if (gamevar.preview[cdn]) {
        const data = gamevar.preview[cdn]
        if (!gamevar.SelectedNoHud) gamevar.selectedVideos = `https://mp4.justdancenow.com/${data.cookie.split('acl=/')[1].split('~hmac=')[0]}?hlscookie=${data.cookie}`
        videoplayer.src = data.url
        setTimeout(() => {
            videoplayer.src = data.url
            videoplayer.play()
        }, 200)
    } else {
        fetch(`${gamevar.server.jdns}/getPreviewVideo?song=${cdn}`, {
            headers: {
                'x-platform': 'web',
            }
        }).then(response => response.json()).then(data => {
            if (!gamevar.SelectedNoHud) gamevar.selectedVideos = `https://mp4.justdancenow.com/${data.cookie.split('acl=/')[1].split('~hmac=')[0]}?hlscookie=${data.cookie}`
            setTimeout(() => {
                videoplayer.src = data.url
                videoplayer.play()
            }, 200)
            gamevar.preview[cdn] = data
        })
    }
}
function startsWithNumber(str) {
    return /^\d/.test(str);
}
function dance() {
    if (!document.querySelector('.button--dance').classList.contains('clicked')) {
        gfunc.playSfx(63559, 63757)
        document.querySelector('.button--dance').classList.add('clicked')
        document.querySelector('.itemsong.selected').classList.add('choosed')
        setTimeout(function () {
            const videoplayer = document.querySelector('.video--preview')
            loadAnotherHTML('scene/ui/hud.html', 'scene/act/hud.js')
        }, 1000)
    }

}

function renderPreview(timestamp) {
    const videoplayer = document.querySelector('.video--preview')
    const canvas = document.querySelector(".preview--renderer");
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoplayer, 0, 0, 640, 360);
    if (getState() == "home") window.requestAnimationFrame(renderPreview)
}