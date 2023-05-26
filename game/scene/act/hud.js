gamevar.gamevar = document.getElementById("gamevar")
var isWalking = false

gamevar.cdn = gamevar.gamevar.style.getPropertyValue("--song-codename");
fetch(`/LilypadData/assets/maps/${gamevar.cdn}/${gamevar.cdn}.json`)
    .then(response => response.json()).then(data => {
        var pictosatlas;
        fetch(`/LilypadData/assets/maps/${gamevar.cdn}/data/assets/pictos-atlas.json`)
            .then(response => response.json()).then(pictosatlas => {
                gfunc.playSong(gamevar.cdn, data, pictosatlas)
            })
    })

gfunc.generateLineLyrics = (data) => {
    const mergedTexts = [];
    let currentText = "";
    let currentTime = 0;

    for (let i = 0; i < data.length; i++) {
        const textObj = data[i];

        if (textObj.isLineEnding === 1) {
            if (currentTime == 0) currentTime = textObj.time
            currentText += textObj.text;
            mergedTexts.push({ text: currentText, time: currentTime });
            currentText = "";
            currentTime = 0;
        } else {
            if (currentTime === 0) {
                currentTime = textObj.time;
            }
            currentText += textObj.text;
        }
    }
    console.log(mergedTexts)
    return mergedTexts;
}

gfunc.playSong = (cdn, data, pictoatlas) => {
    var hud = document.querySelector(".hud")
    let offset = {
        beat: 0,
        lyrics: 0,
        lyricsLine: 0,
        pictos: 0
    };
    const songVar = {
        Beat: data.beats,
        Odieven: false,
        Lyrics: data.lyrics,
        LyricsLine: gfunc.generateLineLyrics(data.lyrics),
        Pictos: data.pictos,
        currentTime: 0
    }
    var video = document.querySelector(".videoplayer")
    if (false) {
        const hls = new Hls();
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(
                `/LilypadData/assets/maps/${cdn}/${cdn}.m3u8`
            );
        });
    }
    else {
        video.src = `/LilypadData/assets/maps/${cdn}/${cdn}.mp4`
    }
    video.play()

    gfunc.LyricsScroll(songVar.LyricsLine[offset.lyricsLine].text)
    var loopUI = setInterval(function () {
        songVar.currentTime = Math.round(video.currentTime * 1000);
        document.querySelector(".currentTimeV").innerHTML = songVar.currentTime;
        // Simple Beat Working
        if (songVar.Beat[offset.beat] < songVar.currentTime) {
            hud.classList.add("show")
            document.querySelector(".currentBeatV").innerHTML = songVar.Beat[offset.beat];
            document.querySelector("#beat").style.animationDuration = `${songVar.Beat[offset.beat + 1] - songVar.Beat[offset.beat]}ms`;
            hud.style.setProperty("--menu-color", data.lyricsColor);
            hud.classList.remove("beat")
            setTimeout(function () {
                hud.classList.remove("beat")
                hud.classList.add("beat")
                if (songVar.Odieven == true) {
                    hud.classList.remove("even")
                    hud.classList.add("odd")
                    songVar.Odieven = false
                } else {
                    hud.classList.remove("odd")
                    hud.classList.add("even")
                    songVar.Odieven = true
                }
            }, 15)
            offset.beat++;
        }
        // Debug Lyrics
        if (songVar.LyricsLine[offset.lyricsLine] && songVar.LyricsLine[offset.lyricsLine].time < songVar.currentTime) {
            document.querySelector(".currentLyricsLineV").innerHTML = songVar.LyricsLine[offset.lyricsLine].text;
            gfunc.LyricsScroll(songVar.LyricsLine[offset.lyricsLine + 1] ? songVar.LyricsLine[offset.lyricsLine + 1].text : "")
            offset.lyricsLine++;
        }
        if (songVar.Lyrics[offset.lyrics].time < songVar.currentTime) {
            document.querySelector(".currentLyricsV").innerHTML = songVar.Lyrics[offset.lyrics].text;
            gfunc.LyricsFill(songVar.Lyrics[offset.lyrics].text, songVar.Lyrics[offset.lyrics].duration)
            offset.lyrics++;
        }
        //Pictos
        if (songVar.Pictos[offset.pictos].time - 2000 < songVar.currentTime) {
            gfunc.ShowPictos(cdn, pictoatlas.images[songVar.Pictos[offset.pictos].name], 2000, 200)
            offset.pictos++;
        }
    }, 10)
}

//Pictos Area
gfunc.ShowPictos = (cdn, atlas, SlideDuration, DisappearDuration) => {
    const pictos = document.createElement('div');
    pictos.className = "picto"
    pictos.innerHTML = '<canvas class="texture"></canvas>';
    const texture = pictos.querySelector('.texture')
    texture.width = 256;
    texture.height = 256;
    const context = texture.getContext('2d');
    var image = new Image();
    image.src = `/LilypadData/assets/maps/${cdn}/data/assets/pictos-atlas.png`;
    image.onload = function () {
        context.drawImage(image, atlas[0] * -1, atlas[1] * -1, this.height, this.width);
    }
    pictos.style.animation = `PictosScroll ${SlideDuration}ms linear`

    document.querySelector('#pictos').appendChild(pictos);
    setTimeout(function () {
        //Start Hide
        pictos.style.animation = `PictosHide ${DisappearDuration}ms`

        setTimeout(function () {
            //Remove
            pictos.remove()
        }, DisappearDuration)
    }, SlideDuration)
}

//Lyrics Area
gfunc.LyricsScroll = (Next, isHide = false) => {
    var lyrics = document.querySelector("#lyrics")

    try {
        var previous = document.querySelector("#lyrics .line.previous")
        previous.remove()
    } catch (err) { }
    try {
        var current = document.querySelector("#lyrics .line.current")
        current.classList.remove("current")
        current.classList.add("previous")
    } catch (err) { }
    try {
        var next = document.querySelector("#lyrics .line.next")
        next.classList.remove("next")
        next.classList.add("current")
    } catch (err) { }

    try {
        setTimeout(function () {
            const div = document.createElement("div");
            const txt = document.createTextNode(Next);
            const top = document.createElement("span");
            const bottom = document.createElement("span");
            bottom.appendChild(txt);
            top.classList.add("layer-top");
            bottom.classList.add("layer-bottom");
            div.appendChild(top);
            div.appendChild(bottom);
            div.classList.add("line");
            div.classList.add("next");
            const lyrics = document.getElementById("lyrics");
            lyrics.appendChild(div);
        }, 10)
    } catch (err) { }
}
gfunc.LyricsFill = (dat, duration, offset) => {
    try {
        var current = document.querySelector("#lyrics .line.current")
        var filler = current.querySelector("#lyrics .line.current .layer-top")
        filler.style.width = filler.scrollWidth + "px"
        if (isWalking) {
            filler.style.transitionDuration = 20 + "ms"
            filler.offsetHeight;
            isWalking = false;
        }
        isWalking = true
        const textNode = document.createTextNode(dat);
        filler.appendChild(textNode);
        filler.style.width = filler.scrollWidth + "px"
        filler.style.transitionDuration = duration + "ms"
        filler.addEventListener('transitionend', function () {
            filler.style.width = '';
            filler.classList.add("filled")
            isWalking = false;
        });
    } catch (err) {
        console.log(dat + err)
    }
}

console.log('')