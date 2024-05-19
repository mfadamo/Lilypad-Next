gamevar.gamevar = document.getElementById("gamevar")
var isWalking = false
if (gamevar.selectedBase == undefined) gamevar.selectedBase = `/LilypadData/maps/${gamevar.gamevar.style.getPropertyValue("--song-codename")}/`

gamevar.cdn = gamevar.gamevar.style.getPropertyValue("--song-codename");
console.log(`${gamevar.selectedBase}/${gamevar.cdn}.json`)
function loadSong() {

}
async function loadMoves(MovesNumber = "Moves0") {
    try {
        const response = await fetch(`${gamevar.selectedBase}/${gamevar.cdn}_${MovesNumber}.json`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const jsona = await response.text();
        var data = {};
        try {
            data.moves0 = JSON.parse(jsona);
        } catch (err) {
            var a = jsona.substring(gamevar.cdn.length + 2, jsona.length - 1);
            console.log(a);
            data = JSON.parse(a, a.length - 1);
        }
        return data || [];
    } catch (err) {
        console.error('Error loading moves:', err);
        return [];
    }
}

async function fetchDataAndPlaySong() {
    try {
        const response = await fetch(`${gamevar.selectedBase}/${gamevar.cdn}.json`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const jsona = await response.text();
        var data;
        try {
            data = JSON.parse(jsona);
        } catch (err) {
            var a = jsona.substring(gamevar.cdn.length + 1, jsona.length - 1);
            a = a.slice(0, a.length - 2);
            console.log(a);
            data = JSON.parse(a, a.length - 1);
        }
        data.moves0 = await loadMoves("Moves0");
        try {
            const pictosatlasResponse = await fetch(`${gamevar.selectedBase}/pictos-atlas.json`);
            if (!pictosatlasResponse.ok) {
                throw new Error('Failed to load pictos atlas');
            }
            const pictosatlas = await pictosatlasResponse.json();
            gfunc.playSong(gamevar.cdn, data, pictosatlas);
        } catch (err) {
            console.error('Error loading pictos atlas:', err);
            // Use default atlas or placeholder data
            gfunc.playSong(gamevar.cdn, data, {
                "NoSprite": true,
                "imageSize": {
                    "width": 256,
                    "height": 256
                },
                "images": {
                    "placeholder": [
                        0,
                        0
                    ]
                }
            });
        }
    } catch (err) {
        console.error('Error fetching data and playing song:', err);
        gfunc.playSong(gamevar.cdn, {}, {
            "NoSprite": true,
            "imageSize": {
                "width": 256,
                "height": 256
            },
            "images": {
                "placeholder": [
                    0,
                    0
                ]
            }
        });
    }
}

// Call fetchDataAndPlaySong to start the process
fetchDataAndPlaySong();

gfunc.generateLineLyrics = (data) => {
    const mergedTexts = [];
    let currentText = "";
    let currentTime = 0;
    var even = false

    for (let i = 0; i < data.length; i++) {
        const textObj = data[i];

        if (textObj.isLineEnding === 1) {
            if (currentTime == 0) currentTime = textObj.time
            currentText += `<span class="fill" offset="${i}">${textObj.text}<span class="filler" style="transition-duration:${textObj.duration}ms">${textObj.text}</span></span>`;
            mergedTexts.push({ text: currentText, time: currentTime, offset: i, even });
            currentText = "";
            currentTime = 0;
            even = !even
        } else {
            if (currentTime === 0) {
                currentTime = textObj.time;
            }
            currentText += `<span class="fill" offset="${i}">${textObj.text}<span class="filler" style="transition-duration:${textObj.duration}ms">${textObj.text}</span></span>`;
        }
    }
    console.log(mergedTexts)
    return mergedTexts;
}

gfunc.isEven = (number) => {
    console.log(number)
    return Math.floor(number / 2) * 2 === number;
}

gfunc.playSong = (cdn, data, pictoatlas) => {
    var hud = document.querySelector(".hud")
    var ui = {
        pictos: hud.querySelector("#pictos"),
        lyrics: hud.querySelector("#lyrics"),
        pictosbeat: this.lyrics.querySelector("#beat")
    }
    if (data.NumCoach > 1) {
        ui.pictos.classList.add('multi-coach')
    }
    if (!gamevar.nohudList) {
        //ui.pictos.style.display = "none"
    }
    let offset = {
        beat: 0,
        lyrics: 0,
        lyricsLine: 0,
        pictos: 0,
        goldMoves: 0,
        moves0: 0
    };
    const songVar = {
        Beat: data.beats,
        nohudOffset: data.nohudOffset || 0,
        Odieven: gfunc.isEven(Math.round(data.beats[0] / ((data.beats[1] - data.beats[0])))),
        Lyrics: data.lyrics,
        LyricsLine: gfunc.generateLineLyrics(data.lyrics),
        Pictos: data.pictos,
        currentTime: 0,
        isDone: false,
        PictosSlideDur: 2100 + Math.round((data.beats[1] - data.beats[0])),
        PictosHideDur: 200 + ((data.beats[1] - data.beats[0]) / 5),
        goldMoves: data.goldMoves || data.goldEffects || [],
        Moves0: data.moves0,
    }
    console.log(songVar)
    songVar.Lyrics.push({ time: songVar.Beat[songVar.Beat.length - 1] + 2000, duration: "0", text: "", isLineEnding: 0 })
    var video = document.querySelector(".videoplayer")
    if (false) {
        const hls = new Hls();
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(
                `/LilypadData/maps/${cdn}/${cdn}.m3u8`
            );
        });
    }
    else {
        video.src = gamevar.selectedVideos || `${gamevar.selectedBase}/${gamevar.cdn}.mp4`
    }
    console.log(gamevar.SelectedVideos)
    video.play()

    function findClosestBelow(value, array) {
        let closest = 0;
        for (let i = 0; i < array.length; i++) {
            if (array[i] < value && array[i] > closest) {
                closest = i;
            }
        }
        return closest;
    }
    function findClosestBelowTime(value, array) {
        let closestIndex = 0;
        let closestTime = 0;

        for (let i = 0; i < array.length; i++) {
            if (array[i].time < value && array[i].time > closestTime) {
                closestIndex = i;
                closestTime = array[i].time;
            }
        }

        return closestIndex;
    }



    document.querySelector(".OffsetNohud").innerHTML = songVar.nohudOffset;
    document.querySelector(".videoplayer").currentTime = songVar.nohudOffset / 1000;
    try {
        setTimeout(function () { gfunc.LyricsScroll(songVar.LyricsLine[offset.lyricsLine]) }, (songVar.LyricsLine[offset.lyricsLine].time - 9000))
    } catch (err) {
        console.log(err)
    }
    var loopUI = setInterval(function () {
        //seekable hahaha
        if (songVar.Beat[offset.beat] + songVar.nohudOffset > songVar.currentTime + 3000 && songVar.currentTime > 3000) {
            offset.beat = findClosestBelow(songVar.currentTime, songVar.Beat)
            offset.lyrics = findClosestBelowTime(songVar.currentTime, songVar.Lyrics)
            offset.lyricsLine = findClosestBelowTime(songVar.currentTime, songVar.LyricsLine)
            offset.pictos = findClosestBelow(songVar.currentTime, songVar.Pictos)
            offset.goldMoves = findClosestBelow(songVar.currentTime, songVar.goldMoves)
            offset.moves0 = findClosestBelow(songVar.currentTime, songVar.Moves0)
            console.log('Skipped rewind at ' + songVar.currentTime)
            console.log(offset)
        }
        if ((songVar.Beat[offset.beat] + songVar.nohudOffset - 3000) > songVar.currentTime && songVar.currentTime > 3000) {
            offset.beat = findClosestBelow(songVar.currentTime, songVar.Beat)
            offset.lyrics = findClosestBelowTime(songVar.currentTime, songVar.Lyrics)
            offset.lyricsLine = findClosestBelowTime(songVar.currentTime, songVar.LyricsLine)
            offset.pictos = findClosestBelowTime(songVar.currentTime, songVar.Pictos)
            console.log('Skipped foward at ' + songVar.currentTime)
            console.log(offset)
        }
        songVar.currentTime = Math.round(video.currentTime * 1000);
        document.querySelector(".currentTimeV").innerHTML = songVar.currentTime - songVar.nohudOffset;
        // Simple Beat Working
        if (songVar.Beat[offset.beat] + songVar.nohudOffset < songVar.currentTime) {
            hud.classList.add("show")
            document.querySelector(".currentBeatV").innerHTML = songVar.Beat[offset.beat];
            document.querySelector("#beat").style.animationDuration = `${Math.round(songVar.Beat[offset.beat + 1] - songVar.Beat[offset.beat])}ms`;
            hud.style.setProperty("--menu-color", data.lyricsColor);
            hud.classList.remove("beat")
            setTimeout(function () {
                
                hud.classList.remove("beat")
                hud.classList.add("beat")
                if (songVar.Odieven == true) {
                    hud.classList.remove("even")
                    hud.classList.add("odd")
                    songVar.Odieven = false;
                } else {
                    hud.classList.remove("odd")
                    hud.classList.add("even")
                    songVar.Odieven = true
                }
            }, 15)
            offset.beat++;
        }
        //SelfStop
        if (video.currentTime == video.duration) {
            if (!songVar.isDone) {
                songVar.isDone = true
                gfunc.startTransition(true, 'scene/ui/home.html', 'scene/act/home.js', 0)
                clearInterval(loopUI)
                return
            }
        }
        // Debug Lyrics
        try {
            if (songVar.LyricsLine[offset.lyricsLine] && songVar.LyricsLine[offset.lyricsLine].time - 150 + songVar.nohudOffset < songVar.currentTime) {
                document.querySelector(".currentLyricsLineV").innerHTML = songVar.LyricsLine[offset.lyricsLine].text;
                gfunc.LyricsScroll(songVar.LyricsLine[offset.lyricsLine + 1] ? songVar.LyricsLine[offset.lyricsLine + 1] : { text: "" }, 0, songVar.Lyrics[songVar.LyricsLine[offset.lyricsLine].offset + 1].time - (songVar.Lyrics[songVar.LyricsLine[offset.lyricsLine].offset].time + songVar.Lyrics[songVar.LyricsLine[offset.lyricsLine].offset].duration))
                offset.lyricsLine++;
            }
        } catch (err) { }

        try {
            if (songVar.Lyrics[offset.lyrics].time + songVar.nohudOffset < songVar.currentTime) {

                var isLineEnding = false
                if (songVar.Lyrics[offset.lyrics].isLineEnding == 1) isLineEnding = true
                const isMore = songVar.Lyrics[offset.lyrics].isLineEnding == 1 && songVar.Lyrics[offset.lyrics + 1] && songVar.Lyrics[offset.lyrics].time >= songVar.Lyrics[offset.lyrics + 1].time;
                document.querySelector(".currentLyricsV").innerHTML = songVar.Lyrics[offset.lyrics].text;
                if (!isMore) gfunc.LyricsFill(songVar.Lyrics[offset.lyrics].text, songVar.Lyrics[offset.lyrics].duration, offset.lyrics, isLineEnding, true)
                offset.lyrics++;

            }
        } catch (err) { }
        //Pictos
        try {
            if (songVar.Pictos[offset.pictos].time + songVar.nohudOffset - songVar.PictosSlideDur < songVar.currentTime) {
                if (!pictoatlas.images[songVar.Pictos[offset.pictos].name]) {
                    gfunc.ShowPictos(`pictos/${songVar.Pictos[offset.pictos].name}`, [0, 0], songVar.PictosSlideDur, songVar.PictosHideDur, `${pictoatlas.imageSize.width}x${pictoatlas.imageSize.height}`)
                } else {
                    gfunc.ShowPictos('a', pictoatlas.images[songVar.Pictos[offset.pictos].name], songVar.PictosSlideDur, songVar.PictosHideDur, `${pictoatlas.imageSize.width}x${pictoatlas.imageSize.height}`)
                }
                offset.pictos++;
            }
        } catch (err) { }
        //GoldMoves
        try {
            if (songVar.goldMoves[offset.goldMoves].time + songVar.nohudOffset - 2100 < songVar.currentTime) {
                gfunc.GoldExplode(false)
                document.querySelector('#goldmove').classList.remove('Explode')
                document.querySelector('#goldmove').classList.add('getReady')
                offset.goldMoves++;
                setTimeout(() => {
                    document.querySelector('#goldmove').classList.remove('getReady')
                    document.querySelector('#goldmove').classList.add('Explode')
                    gfunc.GoldExplode(true)
                    setTimeout(() => {
                        document.querySelector('#goldmove').classList.remove('Explode')
                    }, 1300)
                }, 2100)

            }
        } catch (err) { }
        ////Moves0
        try {
            if (songVar.Moves0[offset.moves0].time + songVar.nohudOffset < songVar.currentTime) {
                document.querySelector('#racetrack .player1').style.height = gfunc.percentage(offset.moves0, songVar.Moves0.length) + '%'
                document.querySelector('#racetrack .raceline-bkg').style.height = (gfunc.percentage(offset.moves0, songVar.Moves0.length) / 1.3) + 15 + '%'
                console.log(songVar.Moves0[offset.moves0].name)
                offset.moves0++;
                document.querySelector(".currentMoves0").innerHTML = `${songVar.Moves0[offset.moves0].time} ${songVar.Moves0[offset.moves0].name}`;
                var el = document.querySelector(".currentMoves0");
                el.style.animation = 'none';
                el.offsetHeight; /* trigger reflow */
                el.style.animation = null;
            }
            if (songVar.Moves0[offset.moves0].time + songVar.Moves0[offset.moves0].duration + songVar.nohudOffset < songVar.currentTime) {
                document.querySelector(".currentMoves0").innerHTML = "idle";
            }
        } catch (err) { console.log(err) }
    }, 5)

}

//Pictos Area
gfunc.ShowPictos = (cdn, atlas, SlideDuration, DisappearDuration, size) => {
    const pictos = document.createElement('div');
    pictos.className = "picto"
    pictos.innerHTML = '<canvas class="texture"></canvas>';
    const texture = pictos.querySelector('.texture')
    const width = size.split('x')
    texture.width = width[0];
    texture.height = width[1];
    const context = texture.getContext('2d');
    var image = new Image();
    if (cdn == 'a') {
        image.src = `${gamevar.selectedBase}/pictos-atlas.png`;
        image.onload = function () {
            context.drawImage(image, atlas[0] * -1, atlas[1] * -1, this.width, this.height);
        }
    } else {
        image.src = `${gamevar.selectedBase}/${cdn}.png`;
        image.onload = function () {
            texture.width = this.width;
            texture.height = this.height;
            context.drawImage(image, 0, 0);
        }
    }
    if (width[0] == width[1]) pictos.style.animation = `PictosScrollSolo ${SlideDuration}ms linear`
    else pictos.style.animation = `PictosScroll ${SlideDuration}ms linear`


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
gfunc.percentage = (partialValue, totalValue) => {
    return (100 * partialValue) / totalValue;
}
gfunc.GoldExplode = (isReady = false) => {
    if (isReady) {
        gfunc.playSfx(6752, 8309);
    } else {
        gfunc.playSfx(4949, 6752);
    }
}

//Lyrics Area
gfunc.LyricsScroll = (Next, isHide = false, timea) => {
    var timeout = {
        state: timea > 6000,
        timeshow: timea - 1000,
        hidetime: 2500
    }
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
        if (timeout.state) {
            next.classList.remove("next")
            next.classList.add("current")
            next.classList.add("show")
            setTimeout(function () {
                next.classList.remove("show")
            }, timeout.hidetime)
        } else {
            next.classList.remove("next")
            next.classList.add("current")
        }
    } catch (err) { }

    try {
        setTimeout(function () {
            try {
                //AVOID LYRIC BROKEN
                var next = document.querySelector("#lyrics .line.next")
                next.remove()
            }
            catch (err) { }
            const div = document.createElement("div");
            div.innerHTML = Next.text;
            div.classList.add("line");
            div.classList.add("next");
            div.classList.add("hidden")
            div.setAttribute("even", Next.even);
            if (timeout.state) {
                setTimeout(() => {
                    div.classList.remove("hidden")
                }, timeout.timeshow)
            } else div.classList.remove("hidden")
            const lyrics = document.getElementById("lyrics");
            lyrics.appendChild(div);
        }, 10)
    } catch (err) { console.log(err) }
}
gfunc.LyricsFill = (dat, duration, offset, Hide = true) => {
    try {
        var current = document.querySelector("#lyrics .line.current")
        var filler = current.querySelector(`#lyrics .line.current .fill[offset="${offset}"] .filler`)
        const textNode = document.createTextNode(dat);
        filler.parentNode.classList.add("filled")
        function ended(event) {
            if (event.propertyName == 'width') {
                filler.parentNode.classList.add("done")
                isWalking = false;
                if (Hide) {
                    setTimeout(function () {
                        current.classList.add('previous')
                        current.classList.remove('current')
                    }, 2000)
                }
            }
        }
        filler.addEventListener('transitionend', ended);
        isWalking = true;
    } catch (err) {

    }
}
//Variable Area
gfunc.calculateAverageTime = (array, key) => {
    // Extract the values for the specified key from the array
    const values = array.map(obj => obj[key]);

    // Calculate the sum of the values
    const sum = values.reduce((total, value) => total + value, 0);

    // Calculate the average
    const average = sum / array.length;

    return average;
}

//Keymapping Area
gamevar.ispaused = false
function pause(event) {
    if (event.key === 'Escape') {
        if (!gamevar.ispaused) {
            setAudiobkgVol(1)
            gamevar.ispaused = true
            document.querySelector(".videoplayer").pause()
        } else {
            setAudiobkgVol(0)
            gamevar.ispaused = false
            document.querySelector(".videoplayer").play()
        }
    }
}
document.addEventListener('keydown', pause);