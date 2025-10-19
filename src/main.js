const { app, BrowserWindow } = require('electron'); // Removed protocol from destructuring
const path = require('path');
const createWindow = require('./backend/createWindow');
const registerIpcHandlers = require('./backend/ipcHandlers');
const { PhoneControllerServer } = require('./backend/modules/websocket/server');
const { CustomProtocol } = require('./backend/protocol.js')

let mainWindow;
let server;

app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,RawDraw,D3D12');

// Register lilypadtemp as a privileged scheme before app is ready
CustomProtocol.registerPrivilegedSchemes();

app.whenReady().then(() => {
  CustomProtocol.register('');
  mainWindow = createWindow();
  registerIpcHandlers();
 server = new PhoneControllerServer({
  port: 8080,        // Non-SSL port
  sslPort: 8443,     // SSL port
  sslKeyPath: './assets/ssl/key.pem',
  sslCertPath: './assets/ssl/cert.pem'
}).start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    server.stop();
    app.quit();
  }
});
