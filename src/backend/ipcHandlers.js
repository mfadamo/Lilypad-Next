const { ipcMain } = require('electron');
const SongDataLoader = require('./modules/songHandler/songData');
const SongListFiller = require('./modules/songHandler/songListFiller');
const { CemuhookClient } = require('./modules/cemuhook/client');
const Media = require('./modules/media/check');
const os = require('os');
const { cleanupTempFiles } = require('./modules/utils/tempFileManager');

const clients = {};
const pollingIntervals = {};
// Configure polling rate in ms (e.g., 60fps ≈ 16.67ms)
const POLLING_RATE = 16;

function registerIpcHandlers() {
  ipcMain.handle('fetch-song-data', async (event, gamevar) => {
    try {
      const loader = new SongDataLoader(gamevar);
      const result = await loader.fetchDataAndPlaySong();
      return { success: true, data: result };
    } catch (error) {
      console.error('Error in fetch-song-data:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fetch-song-list', async (event, gameDir) => {
    try {
      const filler = new SongListFiller(gameDir);
      const result = await filler.fetchDataAndPlaySong();
      return { success: true, data: result };
    } catch (error) {
      console.error('Error in fetch-song-list:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('connect-controller', (event, { slot, ip }) => {
    if (clients[slot] && clients[slot].host === ip) return;

    if (clients[slot]) {
      stopControllerPolling(slot);
      clients[slot].disconnect();
      delete clients[slot];
    }

    const client = new CemuhookClient(ip, {
      autoReconnect: true,
      logger: {
        info: (msg) => console.log(`[Cemuhook][${slot}] ${msg}`),
        warn: (msg) => console.warn(`[Cemuhook][${slot}] ${msg}`),
        error: (msg) => console.error(`[Cemuhook][${slot}] ${msg}`),
        debug: (msg) => console.debug(`[Cemuhook][${slot}] ${msg}`)
      }
    });
    clients[slot] = client;

    client.once('protocolInfo', () => {
      event.sender.send('controller-handshake', { slot });
      startControllerPolling(event, slot);
    });

    client.on('controllerInfo', (info) => {
      event.sender.send('controller-info', { slot, info });
    });

    client.on('controllerData', (data) => {
      event.sender.send('controller-data', { slot, data });
    });

    client.on('disconnected', () => {
      stopControllerPolling(slot);
      event.sender.send('controller-disconnected', { slot });
    });

    client.connect().catch((err) => {
      console.error(`Connection error for slot ${slot}:`, err);
      event.sender.send('controller-error', { slot, error: err.message });
      stopControllerPolling(slot);
      delete clients[slot];
      event.sender.send('controller-disconnected', { slot });
    });
  });

  ipcMain.on('disconnect-controller', (event, { slot }) => {
    if (clients[slot]) {
      stopControllerPolling(slot);
      clients[slot].disconnect();
      delete clients[slot];
      event.sender.send('controller-disconnected', { slot });
    }
  });

  ipcMain.handle('request-controller-data', async (event, { slot }) => {
    if (clients[slot] && clients[slot]._connected) {
      clients[slot].requestControllerData(slot);
      return { success: true };
    }
    return { success: false, error: 'Client not connected' };
  });

  ipcMain.handle('get-controller-data', async (event, { slot }) => {
    if (clients[slot]) {
      const controller = clients[slot].getControllerBySlot(slot);
      if (controller) {
        return { success: true, data: controller };
      } else {
        return { success: false, error: 'Controller not found' };
      }
    }
    return { success: false, error: 'No client for this slot' };
  });

  ipcMain.handle('get-all-controller-data', async (event) => {
    const allData = Object.keys(clients).reduce((acc, slot) => {
      const controller = clients[slot].getControllerBySlot(slot);
      if (controller) {
        acc[slot] = controller;
      }
      return acc;
    }, {});
    return { success: true, data: allData };
  });

  ipcMain.on('toggle-controller-polling', (event, { slot, enabled }) => {
    if (enabled) {
      startControllerPolling(event, slot);
    } else {
      stopControllerPolling(slot);
    }
  });

  ipcMain.on('set-polling-rate', (event, { rate }) => {
    if (rate >= 10 && rate <= 100) { // Enforce reasonable limits
      POLLING_RATE = rate;
      Object.keys(clients).forEach(slot => {
        if (pollingIntervals[slot]) {
          stopControllerPolling(slot);
          startControllerPolling(event, slot);
        }
      });
    }
  });

  ipcMain.handle('check-media-availability', Media.CheckMediaAvailability);

  ipcMain.handle('get-local-ip', async () => {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        // Filter out non-IPv4, internal (127.0.0.1) addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1'; // Fallback if no suitable IP is found
  });

  ipcMain.handle('cleanup-temp-files', async () => {
    try {
      await cleanupTempFiles();
      return { success: true };
    } catch (error) {
      console.error('Error cleaning up temporary files:', error);
      return { success: false, error: error.message };
    }
  });
}

function startControllerPolling(event, slot) {
  if (pollingIntervals[slot]) return;

  const client = clients[slot];
  if (!client || !client._connected) return;

  console.log(`Starting controller polling for slot ${slot} at ${POLLING_RATE}ms intervals`);

  pollingIntervals[slot] = setInterval(() => {
    if (client && client._connected) {
      client.requestControllerData(slot);
    } else {
      stopControllerPolling(slot);
      event.sender.send('controller-error', {
        slot,
        error: 'Polling stopped due to disconnection'
      });
    }
  }, POLLING_RATE);
}

function stopControllerPolling(slot) {
  if (pollingIntervals[slot]) {
    console.log(`Stopping controller polling for slot ${slot}`);
    clearInterval(pollingIntervals[slot]);
    delete pollingIntervals[slot];
  }
}

module.exports = registerIpcHandlers;
