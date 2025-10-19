// modules/screen/hudComponents/songDataLoader.js

export default class SongDataLoader {
  constructor(gamevar) {
    this.gamevar = gamevar;
  }
  
  async fetchDataAndPlaySong(callback) {
    try {
      const result = await window.electronAPI.fetchSongData(this.gamevar);
      
      if (result.success) {
        const { data, pictos, modelsBuffer, gesturesBuffer } = result.data;
        console.log(result.data)
        callback(data, pictos, modelsBuffer, gesturesBuffer);
      } else {
        console.error('Failed to load song data:', result.error);
        callback({}, this.getDefaultAtlas(), [], []);
      }
    } catch (err) {
      console.error('Error fetching data and playing song:', err);
      callback({}, this.getDefaultAtlas(), [], []);
    }
  }

  getDefaultAtlas() {
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

  async cleanup() {
    try {
      await window.electronAPI.cleanupTempFiles();
      console.log('Temporary files cleaned up successfully.');
    } catch (error) {
      console.error('Failed to clean up temporary files:', error);
    }
  }
}
