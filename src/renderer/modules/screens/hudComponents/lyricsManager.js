// modules/screen/hudComponents/lyricsManager.js

export default class LyricsManager {
    constructor() {
      this.isWalking = false;
    }
    
    convertToLetterTimeline(lyrics = []) {
      let newLyrics = [];
      
      lyrics.forEach((item) => {
        const letters = item.text.split("");
        const letterDuration = item.duration / letters.length;
        let currentTime = item.time;
    
        letters.forEach((letter, index) => {
          newLyrics.push({
            time: currentTime,
            duration: letterDuration,
            text: letter,
            isLineEnding: index === letters.length - 1 ? item.isLineEnding : 0
          });
          currentTime += letterDuration;
        });
      });
      
      if (window.gamevar.lowEnd || !window.gamevar.lyricsLetter) {
        return lyrics;
      } else {
        return newLyrics;
      }
    }
    
    generateLineLyrics(data) {
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

    convertToLetterTimeline(lyrics) {
        let newLyrics = [];
        
        lyrics.forEach((item) => {
          const letters = item.text.split(""); // Membagi kata menjadi huruf
          const letterDuration = item.duration / letters.length; // Durasi per huruf
          let currentTime = item.time;
      
          letters.forEach((letter, index) => {
            newLyrics.push({
              time: currentTime,
              duration: letterDuration,
              text: letter,
              isLineEnding: index === letters.length - 1 ? item.isLineEnding : 0
            });
            currentTime += letterDuration;
          });
        });
      
        if(gamevar.lowEnd || !gamevar.lyricsLetter){
        return lyrics
        }else{
        return newLyrics;
        }
      }

      LyricsScroll = (Next, isHide = false, timea) => {
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
                        div.classList.add("fade-anim")
                        div.classList.remove("hidden")
                    }, timeout.timeshow)
                } else div.classList.remove("hidden")
                const lyrics = document.getElementById("lyrics");
                lyrics.appendChild(div);
            }, 10)
        } catch (err) { }
    }

    LyricsFill = (dat, duration, offset, Hide = false) => {
        try {
            var current = document.querySelector("#lyrics .line.current")
            var filler = current.querySelector(`#lyrics .line.current .fill[offset="${offset}"]`)
            const textNode = document.createTextNode(dat);
            filler.classList.add("filled")
            function ended() {
                filler.classList.add("done")
                this.isWalking = false;
                if (Hide) {
                    setTimeout(() => {
                        current.classList.add('previous')
                        current.classList.remove('current')
                    }, 1000)
    
    
                }
            }
            setTimeout(ended, filler.style.transitionDuration.replace('ms', ''))
            this.isWalking = true;
            //Fix lyrics gone wrong on JDN Files (ex. Good4U)
            var prevFiller = current.querySelector(`#lyrics .line .fill[offset="${offset - 1}"]`)
            prevFiller.style.transitionDuration = '0ms'
            prevFiller.style.transition = 'none'
        } catch (err) {
            //Ignore error
        }
    }

}