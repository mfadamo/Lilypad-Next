gamevar.gamevar = document.getElementById("gamevar")
var isWalking = false

gamevar.cdn = gamevar.gamevar.style.getPropertyValue("--song-codename");
fetch(`/LilypadData/assets/maps/${gamevar.cdn}/${gamevar.cdn}.json`)
    .then(response => response.json()).then(data => {
        gfunc.playSong(gamevar.cdn, data)
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

gfunc.playSong = (cdn, data) => {
    var hud = document.querySelector(".hud")
        let offset = {
            beat: 0,
            lyrics: 0,
            lyricsLine: 0
        };
        var Beat = data.beats;
        var Lyrics = data.lyrics;
        var LyricsLine = gfunc.generateLineLyrics(Lyrics)
        var video = document.querySelector(".videoplayer")
        if(false){
        const hls = new Hls();
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(
                `/LilypadData/assets/maps/${cdn}/${cdn}.m3u8`
            );
        });}
        else {
            video.src = `/LilypadData/assets/maps/${cdn}/${cdn}.mp4`
        }
        video.play()

        gfunc.LyricsScroll(LyricsLine[offset.lyricsLine].text)
        var loopUI = setInterval(function () {
            var currentTime = Math.round(video.currentTime * 1000);
            document.querySelector(".currentTimeV").innerHTML = currentTime;
            // Simple Beat Working
            if (Beat[offset.beat] < currentTime) {
                hud.classList.add("show")
                document.querySelector(".currentBeatV").innerHTML = Beat[offset.beat];
                document.querySelector("#beat").style.animationDuration = `${Beat[offset.beat + 1] - Beat[offset.beat]}ms`;
                hud.style.setProperty("--menu-color", data.lyricsColor);
                hud.classList.remove("beat")
                setTimeout(function () {
                    hud.classList.remove("beat")
                    hud.classList.add("beat")
                }, 15)
                offset.beat++;
            }
            // Debug Lyrics
            if (LyricsLine[offset.lyricsLine] && LyricsLine[offset.lyricsLine].time < currentTime) {
                document.querySelector(".currentLyricsLineV").innerHTML = LyricsLine[offset.lyricsLine].text;
                gfunc.LyricsScroll(LyricsLine[offset.lyricsLine + 1] ? LyricsLine[offset.lyricsLine + 1].text : "")
                offset.lyricsLine++;
            }
            if (Lyrics[offset.lyrics].time < currentTime) {
                document.querySelector(".currentLyricsV").innerHTML = Lyrics[offset.lyrics].text;
                gfunc.LyricsFill(Lyrics[offset.lyrics].text, Lyrics[offset.lyrics].duration)
                offset.lyrics++;
            }
        }, 10)
}


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
        setTimeout(function(){
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
    try{
    var current = document.querySelector("#lyrics .line.current")
    var filler = current.querySelector("#lyrics .line.current .layer-top")
    filler.style.width = filler.scrollWidth + "px"
    if(isWalking){
        filler.style.transitionDuration = 20 + "ms"
        filler.offsetHeight;
        isWalking = false;
    }
    isWalking = true
    const textNode = document.createTextNode(dat);
    filler.appendChild(textNode);
    filler.style.width = filler.scrollWidth + "px"
    filler.style.transitionDuration = duration + "ms"
    filler.addEventListener('transitionend', function() {
        filler.style.width = '';
        filler.classList.add("filled")
        isWalking = false;
      });
    } catch(err) {
        console.log(dat + err)
    }
}

console.log('')