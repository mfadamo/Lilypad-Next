const everpolate = require('everpolate')

class UAF2BlueStar {
  constructor() {
    this.song = { data: {}, moves0: [], moves1: [], moves2: [], moves3: [], moves4: [], moves5: [], 'moves0-kinect': [], 'moves1-kinect': [], 'moves2-kinect': [], 'moves3-kinect': [], 'moves4-kinect': [], 'moves5-kinect': [] };
    this.beats = [];
    this.beatsMap24 = [];
  }

  parseJsonData(jsonString) {
    try {
      return JSON.parse(jsonString.replace("\x00", ""));
    } catch (e) {
      throw new Error(`Failed to parse JSON data: ${e.message}`);
    }
  }

  getTime(time) {
    return Math.round(everpolate.linear(time, this.beatsMap24, this.beats));
  }

  processSongInfo(songInfo) {
    this.song.data = {
      MapName: songInfo.MapName,
      JDVersion: songInfo.JDVersion,
      OriginalJDVersion: songInfo.OriginalJDVersion,
      Artist: songInfo.Artist,
      Title: songInfo.Title,
      Credits: songInfo.Credits,
      NumCoach: songInfo.NumCoach,
      CountInProgression: songInfo.CountInProgression,
      DancerName: songInfo.DancerName,
      LocaleID: songInfo.LocaleID,
      MojoValue: songInfo.MojoValue,
      Mode: songInfo.Mode,
      Status: songInfo.Status,
      LyricsType: songInfo.LyricsType,
      BackgroundType: songInfo.backgroundType,
      Difficulty: songInfo.Difficulty,
      ubiartConverted: true,
      DefaultColors: {
        lyrics: `0xFF${this.rbg2hex(songInfo.DefaultColors.lyrics)}`,
        theme: `0xFF${this.rbg2hex(songInfo.DefaultColors.theme)}`,
        songColor_1A: `0xFF${this.rbg2hex(songInfo.DefaultColors.songcolor_1a)}`,
        songColor_1B: `0xFF${this.rbg2hex(songInfo.DefaultColors.songcolor_1b)}`,
        songColor_2A: `0xFF${this.rbg2hex(songInfo.DefaultColors.songcolor_2a)}`,
        songColor_2B: `0xFF${this.rbg2hex(songInfo.DefaultColors.songcolor_2b)}`,
      },
      lyricsColor: `#${this.rbg2hex(songInfo.DefaultColors.lyrics)}`,
    };

    return this.song.data;
  }

  processBeats(trackData) {
    const { startBeat, markers, endBeat, previewEntry, previewLoopStart, videoStartTime } = trackData.structure;

    this.beats = markers.map((a) => Math.round(a / 48));
    this.beatsMap24 = this.beats.map((a, i) => i * 24);


    // Calculate timelineOffset (what was incorrectly called videoOffset before)
    this.song.data["timelineOffset"] = Math.round(this.beats[Math.abs(startBeat)]);

    // Fix videoOffset calculation - use the actual videoStartTime if available
    if (videoStartTime !== undefined) {
      this.song.data["videoOffset"] = (Math.abs(videoStartTime) * 1000) - this.song.data["timelineOffset"];
    } else {
      // Fallback to the previous calculation
      this.song.data["videoOffset"] = startBeat < 0 ?
        this.beats[Math.abs(startBeat)] :
        -this.beats[startBeat];
    }

    if (this.beats.length - 1 < endBeat) {
      let lastBeatDiff = this.beats[this.beats.length - 1] - this.beats[this.beats.length - 2];
      for (let i = 0; i < endBeat - (this.beats.length - 1); i++) {
        this.beats.push(this.beats[this.beats.length - 1] + lastBeatDiff);
      }
    } else if (this.beats.length - 1 > endBeat) {
      this.beats = this.beats.slice(0, endBeat + 1);
    }

    if (startBeat < 0) {
      this.song.data["beats"] = [].concat(
        this.beats.slice(0, Math.abs(startBeat)),
        this.beats.map((a) => a + this.song.data["timelineOffset"])
      );

      this.song.data.AudioPreview = {
        coverflow: { startBeat: previewEntry + Math.abs(startBeat) },
        prelobby: { startBeat: previewLoopStart + Math.abs(startBeat) },
      };
    } else {
      this.song.data["beats"] = this.beats
        .slice(startBeat, this.beats.length)
        .map((a) => a - this.song.data["timelineOffset"]);

      this.song.data.AudioPreview = {
        coverflow: { startBeat: previewEntry - startBeat },
        prelobby: { startBeat: previewLoopStart - startBeat },
      };
    }

    return this.song.data.beats;
  }

  processDTape(dtape) {
    this.song.data["pictos"] = [];
    this.song.data["goldMoves"] = [];

    dtape.Clips.forEach((clip) => {
      const { __class } = clip;

      switch (__class) {
        case "PictogramClip": {
          const { StartTime, Duration, PictoPath } = clip;

          this.song.data["pictos"].push({
            time: this.getTime(StartTime) + this.song.data["timelineOffset"],
            duration: this.getTime(StartTime + Duration) - this.getTime(StartTime),
            name: PictoPath.split("/").pop().split(".")[0],
          });

          break;
        }

        case "GoldEffectClip": {
          const { StartTime, Duration, EffectType } = clip;

          this.song.data["goldMoves"].push({
            time: this.getTime(StartTime) + this.song.data["timelineOffset"],
            duration: this.getTime(StartTime + Duration) - this.getTime(StartTime),
            effectType: EffectType,
          });

          break;
        }

        case "MotionClip": {
          const { StartTime, Duration, ClassifierPath, GoldMove, CoachId, MoveType } = clip;
          if(this.song[`moves${CoachId}${MoveType == 1 ? '-kinect' : ''}`] === undefined) {
            console.log('missing moves', CoachId, MoveType);
            this.song[`moves${CoachId}${MoveType == 1 ? '-kinect' : ''}`] = [];
          }
          this.song[`moves${CoachId}${MoveType == 1 ? '-kinect' : ''}`].push({
            time: this.getTime(StartTime) + this.song.data["timelineOffset"],
            duration: this.getTime(StartTime + Duration) - this.getTime(StartTime),
            name: ClassifierPath.split("/").pop().split(".")[0],
            goldMove: GoldMove,
          });

          break;
        }
      }
    });

    // Sort pictos
    this.song.data["pictos"] = this.song.data["pictos"].sort((a, b) => {
      if (a.time < b.time) {
        return -1;
      }
      return 1;
    });

    this.song.data["goldMoves"] = this.song.data["goldMoves"].sort((a, b) => {
      if (a.time < b.time) {
        return -1;
      }
      return 1;
    });

    return {
      pictos: this.song.data.pictos,
      goldMoves: this.song.data.goldMoves
    };
  }

  processMainSequence(mainsequence) {
    this.song.data["hideUserInterface"] = [];
    this.song.data["ambientSounds"] = [];
    if (mainsequence && mainsequence.Clips !== undefined) {
      mainsequence.Clips.forEach((clip) => {
        const { __class, StartTime, Duration, EventType, CustomParam, SoundSetPath, StopsOnEnd } = clip;
        const time = this.getTime(StartTime) + this.song.data["timelineOffset"];
        const duration = this.getTime(StartTime + Duration) - this.getTime(StartTime);

        if (__class === "HideUserInterfaceClip") {
          this.song.data["hideUserInterface"].push({
            time,
            duration,
            eventType: EventType,
            customParam: CustomParam || ""
          });
        } else if (__class === "SoundSetClip") {
          const name = SoundSetPath.split('/').pop().split('.')[0];
          this.song.data["ambientSounds"].push({
            time,
            duration,
            name,
            StopsOnEnd: StopsOnEnd || false
          });
        }
      });
    }

    // Sort arrays by time
    this.song.data["hideUserInterface"].sort((a, b) => a.time - b.time);
    this.song.data["ambientSounds"].sort((a, b) => a.time - b.time);


    return {
      hideUserInterface: this.song.data["hideUserInterface"],
      ambientSounds: this.song.data["ambientSounds"]
    };
  }

  processKTape(ktape) {
    this.song.data["lyrics"] = [];

    if (ktape && ktape.Clips !== undefined) {
      ktape.Clips.forEach((clip) => {
        const { __class } = clip;

        switch (__class) {
          case "KaraokeClip": {
            const { StartTime, Duration, Lyrics, IsEndOfLine } = clip;

            this.song.data["lyrics"].push({
              time: this.getTime(StartTime) + this.song.data["timelineOffset"],
              duration: this.getTime(StartTime + Duration) - this.getTime(StartTime),
              text: Lyrics,
              isLineEnding: IsEndOfLine,
            });

            break;
          }
        }
      });
    }

    // Sort lyrics
    this.song.data["lyrics"] = this.song.data["lyrics"].sort((a, b) => {
      if (a.time < b.time) {
        return -1;
      }
      return 1;
    });

    return this.song.data.lyrics;
  }

  sortMoves(numCoach) {
    for (let coach = 0; coach < numCoach; coach++) {
      // Sort regular moves
      if (this.song[`moves${coach}`] && this.song[`moves${coach}`].length > 0) {
        this.song[`moves${coach}`] = this.song[`moves${coach}`].sort((a, b) => {
          if (a.time < b.time) {
            return -1;
          }
          return 1;
        });
      }

      // Sort kinect moves
      if (this.song[`moves${coach}-kinect`] && this.song[`moves${coach}-kinect`].length > 0) {
        this.song[`moves${coach}-kinect`] = this.song[`moves${coach}-kinect`].sort((a, b) => {
          if (a.time < b.time) {
            return -1;
          }
          return 1;
        });
      }
    }

    return this.song;
  }

  // RGB to Hex conversion
  rbg2hex(colors = []) {
    const a = (red, green, blue, alpha) => {
      const isPercent = (red + (alpha || "")).toString().includes("%");
      if (typeof red === "string") {
        [red, green, blue, alpha] = red
          .match(/(0?\.?\d{1,3})%?\b/g)
          .map((component) => Number(component));
      } else if (alpha !== undefined) {
        alpha = Number.parseFloat(alpha);
      }
      if (
        typeof red !== "number" ||
        typeof green !== "number" ||
        typeof blue !== "number" ||
        red > 255 ||
        green > 255 ||
        blue > 255
      ) {
        throw new TypeError("Expected three numbers below 255");
      }
      if (typeof alpha === "number") {
        if (!isPercent && alpha >= 0 && alpha <= 1) {
          alpha = Math.round(255 * alpha);
        } else if (isPercent && alpha >= 0 && alpha <= 100) {
          alpha = Math.round((255 * alpha) / 100);
        } else {
          throw new TypeError(
            `Expected alpha value (${alpha}) as a fraction or percentage`
          );
        }
        alpha = (alpha | (1 << 8)).toString(16).slice(1);
      } else {
        alpha = "";
      }
      return (
        (blue | (green << 8) | (red << 16) | (1 << 24)).toString(16).slice(1) +
        alpha
      );
    };
    return a(colors[1] * 255, colors[2] * 255, colors[3] * 255).toUpperCase();
  }

  // Get formatted JSON output (instead of writing to files)
  getSongData() {
    const result = this.song.data;

    // Add moves data for each coach (both regular and kinect)
    for (let coach = 0; coach < this.song.data.NumCoach; coach++) {
      if (this.song[`moves${coach}`] && this.song[`moves${coach}`].length > 0) {
        result[`moves${coach}`] = this.song[`moves${coach}`];
      }
      if (this.song[`moves${coach}-kinect`] && this.song[`moves${coach}-kinect`].length > 0) {
        result[`moves${coach}-kinect`] = this.song[`moves${coach}-kinect`];
      }
    }

    return result;
  }

  // Main processing method
  processJsonData(dtapeJson, ktapeJson, musictrackJson, songdescJson, mainsequenceJson = null) {
    try {
      const dtape = typeof dtapeJson === 'string' ? this.parseJsonData(dtapeJson) : dtapeJson;
      const ktape = typeof ktapeJson === 'string' ? this.parseJsonData(ktapeJson) : ktapeJson;
      const musictrack = typeof musictrackJson === 'string' ? this.parseJsonData(musictrackJson) : musictrackJson;
      const songdesc = typeof songdescJson === 'string' ? this.parseJsonData(songdescJson) : songdescJson;
      const mainsequence = typeof mainsequenceJson === 'string' ? this.parseJsonData(mainsequenceJson) : mainsequenceJson;

      // Process song info
      const songInfo = songdesc.COMPONENTS[0];
      this.processSongInfo(songInfo);

      // Process beats
      const trackData = musictrack.COMPONENTS[0].trackData;
      this.processBeats(trackData);

      // Process DTape
      this.processDTape(dtape);

      // Process KTape
      this.processKTape(ktape);

      // Process MainSequence
      this.processMainSequence(mainsequence)

      // Sort moves
      this.sortMoves(songInfo.NumCoach);

      return this.song;
    } catch (error) {
      console.error(`Error processing song: ${error.message}`);
      throw error;
    }
  }
}

module.exports = UAF2BlueStar;