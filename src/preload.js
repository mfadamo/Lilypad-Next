const { ipcRenderer } = require('electron');

const songAPI = {
  fetchSongData: (gamevar)    => ipcRenderer.invoke('fetch-song-data', gamevar),
  fetchSongList: (gamevar)    => ipcRenderer.invoke('fetch-song-list', gamevar),
  cleanupTempFiles: ()        => ipcRenderer.invoke('cleanup-temp-files'),
};

const controllerAPI = {
  // commands
  connectController:     (slot, ip)       => ipcRenderer.send('connect-controller',    { slot, ip }),
  disconnectController:  (slot)            => ipcRenderer.send('disconnect-controller', { slot }),
  requestControllerData: (slot)            => ipcRenderer.invoke('request-controller-data', { slot }),
  togglePolling:         (slot, enabled)   => ipcRenderer.send('toggle-controller-polling', { slot, enabled }),
  setPollingRate:        (rate)            => ipcRenderer.send('set-polling-rate', { rate }),

  // events
  onControllerHandshake:   cb => ipcRenderer.on('controller-handshake',        (e,d) => cb(e,d)),
  onControllerData:        cb => ipcRenderer.on('controller-data',             (e,d) => cb(e,d)),
  onControllerInfo:        cb => ipcRenderer.on('controller-info',             (e,d) => cb(e,d)),
  onControllerError:       cb => ipcRenderer.on('controller-error',            (e,d) => cb(e,d)),
  onControllerDisconnected:cb => ipcRenderer.on('controller-disconnected',     (e,d) => cb(e,d)),
};

// New media format detection API
const mediaAPI = {
  checkMediaAvailability: (options) => ipcRenderer.invoke('check-media-availability', options),
};

// New general API for system information
const systemAPI = {
  getLocalIp: () => ipcRenderer.invoke('get-local-ip'),
};

// ❗ No contextBridge — directly expose
globalThis.electronAPI = {
  ...songAPI,
  controller: controllerAPI,
  media: mediaAPI,
  system: systemAPI // Expose the new system API
};
