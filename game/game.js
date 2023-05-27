const { app, BrowserWindow, Menu, session } = require('electron');
const path = require('path');
const url = require('url');
const { ipcMain } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      sandbox: false,
    }
  });
   const emptyMenu = Menu.buildFromTemplate([]);
   mainWindow.setMenu(emptyMenu);

  const mainSession = mainWindow.webContents.session;
  mainSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    details.requestHeaders['Referer'] = 'https://justdancenow.com';

    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'base.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
