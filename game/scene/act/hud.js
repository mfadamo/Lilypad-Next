// Initialize game variables
var map = document.getElementById("gamevar");
var isWalking = false;
var selectedPause = 1;
gamevar.isPaused = false;
gamevar.isOnCoachSelection = true;
if (gamevar.selectedBase === undefined) {
    gamevar.selectedBase = `/LilypadData/maps/${map.style.getPropertyValue("--song-codename")}/`;
}
gamevar.cdn = map.style.getPropertyValue("--song-codename");


// Set background image for coach selection
var preview = document.querySelector('#coachselection .preview');
var bpath = (gamevar.selectedMaps && gamevar.selectedMaps.bkg_image) || `${gamevar.selectedBase}/assets/map_bkg.png`;
document.querySelector('#coachselection .banner-bkg').style.backgroundImage = `url(${bpath})`;

// Play sound effect
gfunc.playSfx(11424, 12046);



async function loadMoves(MovesNumber = "moves0") {
    try {
        var fetchUrl = `${gamevar.selectedBase}/${gamevar.cdn}_${MovesNumber}.json`
        if (fetchUrl.includes('justdancenow.com')) {
            fetchUrl = fetchUrl.replace('assets/web', 'data/moves')
        }
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const jsona = await response.text();
        var data = {};
        try {
            data.moves0 = JSON.parse(jsona);
        } catch (err) {
            var a = jsona.substring(gamevar.cdn.length + 2, jsona.lastIndexOf(')'));
            data = JSON.parse(a, a.length - 1);
        }
        return data || [];
    } catch (err) {
        return [];
    }
}

// Fetch song data and play the song
async function fetchDataAndPlaySong() {
    try {
        const response = await fetch(`${gamevar.selectedBase}/${gamevar.cdn}.json`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const jsona = await response.text();
        let data;
        try {
            data = JSON.parse(jsona);
        } catch (err) {
            let a = jsona.substring(gamevar.cdn.length + 1, jsona.lastIndexOf(')'));
            try {
            data = JSON.parse(a);
            } catch(err){
                console.log(`unable to load ${a}`)
            }
        }

        if (gamevar.selectedBase.includes('https://jdnow-api-contentapistoragest.justdancenow.com')) {
            gamevar.selectedBase += "/assets/web";
        }

        data.moves0 = await loadMoves("moves0");
        data.moves1 = await loadMoves("moves1");
        data.moves2 = await loadMoves("moves2");
        data.moves3 = await loadMoves("moves3");

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
            gfunc.playSong(gamevar.cdn, data, getDefaultAtlas());
        }
    } catch (err) {
        console.error('Error fetching data and playing song:', err);
        gfunc.playSong(gamevar.cdn, {}, getDefaultAtlas());
    }
}

// Get default atlas data
function getDefaultAtlas() {
    return {
        "NoSprite": true,
        "imageSize": {
            "width": 256,
            "height": 256
        },
        "images": {
            "placeholder": [0, 0]
        }
    };
}

// Call fetchDataAndPlaySong to start the process
fetchDataAndPlaySong();

gfunc.generateLineLyrics = (data) => {
    const mergedTexts = [];
    let currentText = "";
    let currentTime = 0;
    let currentDuration = 0
    var even = false

    for (let i = 0; i < data.length; i++) {
        const textObj = data[i];

        if (textObj.isLineEnding === 1) {
            if (currentTime == 0) currentTime = textObj.time
            currentDuration += textObj.duration
            currentText += `<span class="fill" offset="${i}" style="transition-duration:${textObj.duration}ms">${textObj.text}<span class="filler" style="transition-duration:${textObj.duration}ms">${textObj.text}</span></span>`;
            mergedTexts.push({ text: currentText, time: currentTime, offset: i, duration: currentDuration, even });
            currentText = "";
            currentTime = 0;
            currentDuration = 0
            even = !even
        } else {
            if (currentTime === 0) {
                currentTime = textObj.time;
            }
            currentDuration += textObj.duration
            currentText += `<span class="fill" offset="${i}" style="transition-duration:${textObj.duration}ms">${textObj.text}<span class="filler" style="transition-duration:${textObj.duration}ms">${textObj.text}</span></span>`;

        }
    }
    return mergedTexts;
}

gfunc.isEven = (number) => {
    return Math.floor(number / 2) * 2 === number;
}

gfunc.playSong = (cdn, data, pictoatlas) => {
    var hud = document.querySelector(".hud")
    var ui = {
        pictos: hud.querySelector("#pictos"),
        lyrics: hud.querySelector("#lyrics"),
        pictosbeat: this.lyrics.querySelector("#beat")
    }
     ui.pictos.setAttribute("NumCoach", data.NumCoach);
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
        moves0: 0,
        moves1: 0,
        moves2: 0,
        moves3: 0,
        hideUI: 0
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
        PictosSlideDur: 2100 + Math.round((gfunc.calculateAverageBeatTime(data.beats))),
        PictosHideDur: 200 + ((gfunc.calculateAverageBeatTime(data.beats)) / 5),
        goldMoves: data.goldMoves || data.goldEffects || [],
        Moves0: data.moves0 || [],
        Moves1: data.moves1 || [],
        Moves2: data.moves2 || [],
        Moves3: data.moves3 || [],
        HideUI: data.HideUserInterface || []
    }
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
        video.src =  gamevar.selectedVideos || `${gamevar.selectedBase}/${gamevar.cdn}.mp4`
    }
    video.oncanplay = (event) => {
        setTimeout(function () {
            if (gamevar.isOnCoachSelection) {
                gfunc.playSfx(29139, 29600);
                document.querySelector('#coachselection .txt-loading').style.display = 'none'
                document.querySelector('#coachselection .button--continue').style.display = 'flex'
            }
        }, 1000)
    };

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
        setTimeout(function () { gfunc.LyricsScroll(songVar.LyricsLine[offset.lyricsLine]) }, (songVar.LyricsLine[offset.lyricsLine].time - 1000))
    } catch (err) {
        console.log(err)
    }
    hud.classList.add("show")
    hud.style.setProperty("--menu-color", data.lyricsColor);
    function running() {
        //seekable hahaha
        /*
        if (songVar.Beat[offset.beat] + songVar.nohudOffset > songVar.currentTime + 3000 && songVar.currentTime > 3000) {
            offset.beat = findClosestBelow(songVar.currentTime, songVar.Beat)
            offset.lyrics = findClosestBelowTime(songVar.currentTime, songVar.Lyrics)
            offset.lyricsLine = findClosestBelowTime(songVar.currentTime, songVar.LyricsLine)
            offset.pictos = findClosestBelowTime(songVar.currentTime, songVar.Pictos)
            offset.goldMoves = findClosestBelowTime(songVar.currentTime, songVar.goldMoves)
            offset.moves0 = findClosestBelowTime(songVar.currentTime, songVar.Moves0)
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
        */
        songVar.currentTime = Math.round(video.currentTime * 1000);
        document.querySelector(".currentTimeV").innerHTML = songVar.currentTime - songVar.nohudOffset;
        const isVideoPlaying = video => !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
        // Simple Beat Working
        if (isVideoPlaying) {
            if (songVar.Beat[offset.beat] + songVar.nohudOffset < songVar.currentTime) {
                document.querySelector(".currentBeatV").innerHTML = songVar.Beat[offset.beat];
                document.querySelector("#beat").style.animationDuration = `${Math.round(songVar.Beat[offset.beat + 1] - songVar.Beat[offset.beat])}ms`;
                document.querySelector("#beat-grad").style.animationDuration = `${Math.round(songVar.Beat[offset.beat + 1] - songVar.Beat[offset.beat])}ms`;
                hud.classList.remove("beat")

                hud.classList.remove("beat")
                hud.offsetHeight;
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
                offset.beat++;
            }
            //SelfStop
            if ((songVar.Beat[songVar.Beat.length - 1] + songVar.nohudOffset) < songVar.currentTime || video.currentTime == video.duration || video.currentTime > video.duration) {
                if (!songVar.isDone) {
                    songVar.isDone = true;
                    video.removeAttribute('src');
                    video.load();
                    gfunc.startTransition(true, 'scene/ui/home.html', 'scene/act/home.js');
                    data = {};
                    songVar = {};
                    return;
                }
            }
            // Debug Lyrics
            try {
                const isBelow = songVar.LyricsLine[offset.lyricsLine].duration < 150
                const scrollTime = isBelow ? 0 : 150
                if (songVar.LyricsLine[offset.lyricsLine] && songVar.LyricsLine[offset.lyricsLine].time - scrollTime + songVar.nohudOffset < songVar.currentTime) {
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
                    document.querySelector(".currentMoves0").innerHTML = `${songVar.Moves0[offset.moves0].time} ${songVar.Moves0[offset.moves0].name}`;
                    setTimeout(function () {
                        //BOT RACELINE
                        var el = document.querySelector(".currentMoves0");
                        el.style.animation = 'none';
                        el.offsetHeight; /* trigger reflow */
                        el.style.animation = null;
                        //BOT PLAYERS
                        var feedbackname = ".feedback-perfect"
                        if (songVar.Moves0[offset.moves0-1].goldMove) { feedbackname = ".feedback-yeah" }
                        var player = document.querySelector('#players .player1')
                        var perfect = player.querySelector(feedbackname);
                        perfect.classList.remove('animate');
                        perfect.offsetHeight; /* trigger reflow */
                        perfect.classList.add('animate');
                    }, songVar.Moves0[offset.moves0].duration)
                    offset.moves0++;
                }
                if (songVar.Moves0[offset.moves0].time + songVar.Moves0[offset.moves0].duration + songVar.nohudOffset < songVar.currentTime) {
                    document.querySelector(".currentMoves0").innerHTML = "idle";
                }
            } catch (err) { }
            ////Moves1
            try {
                if (songVar.Moves1[offset.moves1].time + songVar.nohudOffset < songVar.currentTime) {
                    document.querySelector('#racetrack .player2').style.height = gfunc.percentage(offset.moves1, songVar.Moves1.length) + '%'
                    document.querySelector(".currentMoves1").innerHTML = `${songVar.Moves0[offset.moves0].time} ${songVar.Moves0[offset.moves0].name}`;
                    setTimeout(function () {
                        //BOT RACELINE
                        var el = document.querySelector(".currentMoves1");
                        el.style.animation = 'none';
                        el.offsetHeight; /* trigger reflow */
                        el.style.animation = null;
                        //BOT PLAYERS
                        var feedbackname = ".feedback-perfect"
                        if (songVar.Moves1[offset.moves1-1].goldMove) { feedbackname = ".feedback-yeah" }
                        var player = document.querySelector('#players .player2')
                        var perfect = player.querySelector(feedbackname);
                        perfect.classList.remove('animate');
                        perfect.offsetHeight; /* trigger reflow */
                        perfect.classList.add('animate');
                    }, songVar.Moves1[offset.moves1].duration)
                    offset.moves1++;
                }
                if (songVar.Moves0[offset.moves0].time + songVar.Moves0[offset.moves0].duration + songVar.nohudOffset < songVar.currentTime) {
                    document.querySelector(".currentMoves0").innerHTML = "idle";
                }
            } catch (err) { }
            ///HideUI
            try {
                if (songVar.HideUI[offset.hideUI].time + songVar.nohudOffset < songVar.currentTime) {
                    hud.classList.remove("show")
                    setTimeout(function () { hud.classList.add("show") },
                        songVar.HideUI[offset.hideUI].duration)
                    offset.hideUI++;
                }
            } catch (err) { }
            if (!songVar.isDone) window.requestAnimationFrame(running)
        }
    }
    window.requestAnimationFrame(running)
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
        image.onerror = function () {
            image.src = `assets/texture/texturesbroken.png`;
        }
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
        hidetime: 1000
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
    } catch (err) { }
}
gfunc.LyricsFill = (dat, duration, offset, Hide = false) => {
    try {
        var current = document.querySelector("#lyrics .line.current")
        var filler = current.querySelector(`#lyrics .line.current .fill[offset="${offset}"]`)
        const textNode = document.createTextNode(dat);
        filler.classList.add("filled")
        function ended() {
            filler.classList.add("done")
            isWalking = false;
            if (Hide) {
                setTimeout(() => {
                    current.classList.add('previous')
                    current.classList.remove('current')
                }, 1000)


            }
        }
        setTimeout(ended, filler.style.transitionDuration.replace('ms', ''))
        isWalking = true;
        //Fix lyrics gone wrong on JDN Files (ex. Good4U)
        var prevFiller = current.querySelector(`#lyrics .line .fill[offset="${offset - 1}"]`)
        prevFiller.style.transitionDuration = '0ms'
        prevFiller.style.transition = 'none'
    } catch (err) {
        //Ignore error
    }
}
//Variable Area
gfunc.calculateAverageTime = (arra) => {
    if (!Array.isArray(arra) || arra.length === 0) {
        throw new Error("Input must be a non-empty array");
    }

    const sum = arra.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    const average = sum / arra.length;
    return average;
};
gfunc.calculateAverageBeatTime = (arra) => {
    if (!Array.isArray(arra) || arra.length < 2) {
        throw new Error("Input must be an array with at least two elements");
    }

    // Calculate the differences between consecutive elements
    const differences = arra.slice(1).map((currentValue, index) => currentValue - arra[index]);

    // Calculate the sum of differences
    const sumOfDifferences = differences.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

    // Calculate the average of the differences
    const averageDifference = sumOfDifferences / differences.length;
    return averageDifference;
};

document.querySelectorAll('.itempause').forEach((item, index) => {
    item.addEventListener('click', function () {
        if (selectedPause < index) {
            gfunc.playSfx(23605, 23864);
        } else if (selectedPause == index) { gfunc.playSfx(63559, 63757) }
        else {
            gfunc.playSfx(23892, 24137);
        }

        if (selectedPause != index) {
            document.querySelector('.itempause.selected') && document.querySelector('.itempause.selected').classList.remove('selected')
            document.querySelectorAll(`.itempause`)[index].classList.add('selected')
            selectedPause = index
            return
        }
        if (selectedPause == index) {
            setTimeout(() => {
                if (index == 0) {
                    var video = document.querySelector('.videoplayer')
                    video.removeAttribute('src');
                    video.load();
                    gfunc.startTransition(true, 'scene/ui/home.html', 'scene/act/home.js');
                }
                if (index == 1) {
                    document.querySelector('.videoplayer').play()
                    document.querySelector('#pausescreen').style.opacity = 0;
                    document.querySelector('#pausescreen').style.transition = 'opacity .5s'
                    setTimeout(function () { document.querySelector('#pausescreen').style.display = 'none' }, 500)
                    document.querySelector(".overlay-hi .shortcut").innerHTML = ``;
                    gamevar.isPaused = false
                }
            }, 200)
        }
    })
})


function startSong() {
    gfunc.playSfx(11424, 12046);
    document.querySelector('#coachselection .txt-loading').innerHTML = 'Loading. Please Wait...';
    document.querySelector('#coachselection .txt-loading').style.display = 'block';
    document.querySelector('#coachselection .button--continue').style.display = 'none';
    gamevar.isOnCoachSelection = false;

    setTimeout(() => {
        const videoPlayer = document.querySelector('.video--preview');
        videoPlayer.pause();
        videoPlayer.src = "";
        gfunc.playSfx(0, 3000);
        gfunc.startTransition(false, 'scene/ui/hud.html', 'scene/act/hud.js');
        setTimeout(() => {
            document.querySelector("#coachselection").style.display = "none";
            setTimeout(() => {
                const video = document.querySelector(".videoplayer");
                video.play();
                document.querySelector("#coachselection").style.display = "none";
            }, 600);
        }, 1500);
    }, 1000);
}