const { BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        useContentSize: true,
        backgroundThrottling: false,
        backgroundColor: '#2e2c29',
        minWidth: 600,
        minHeight: 400,
        center: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, '../preload.js'),
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            enableRemoteModule: false,
            spellcheck: false,
            experimentalFeatures: false
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    mainWindow.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

    if ((process.env.NODE_ENV || "").toLowerCase() === 'development') {
        mainWindow.webContents.openDevTools();
    }

    return mainWindow;
}

module.exports = createWindow;
