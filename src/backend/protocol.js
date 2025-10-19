// backend/protocol.js
class CustomProtocol {
    static registerPrivilegedSchemes() {
        const { protocol } = require('electron');
        protocol.registerSchemesAsPrivileged([
            { scheme: 'lilypadtemp', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } }
        ]);
    }

    static register(rootDir) {
      const { protocol, net } = require('electron');
      const { pathToFileURL } = require('node:url');
      const path = require('node:path');
      const { tempDir } = require('./modules/utils/tempFileManager'); // Import tempDir
  
      protocol.handle('ojmcs', (request) => {
        let fsPath = new URL(request.url).pathname;
        // Windows: strip leading “/D:/…” → “D:/…”
        if (process.platform==='win32' && /^\/[A-Za-z]:\//.test(fsPath)) {
          fsPath = fsPath.slice(1);
        }
        fsPath = path.normalize(decodeURIComponent(fsPath));
        return net.fetch(pathToFileURL(fsPath).toString());
      });

      protocol.handle('lilypadtemp', async (request) => {
        // Manually extract the filename from the URL, expecting the new format
        const prefix = 'lilypadtemp://temp-pictos/';
        let filename = '';
        if (request.url.startsWith(prefix)) {
          filename = request.url.substring(prefix.length);
        } else {
          // Fallback for old format or unexpected URLs, though this should ideally not happen
          filename = request.url.substring('lilypadtemp://'.length);
        }
        
        // Remove any trailing slash
        if (filename.endsWith('/')) {
          filename = filename.slice(0, -1);
        }

        const fullPath = path.join(tempDir, filename);
        const urlCompatibleFullPath = fullPath.replace(/\\/g, '/');
        const fileURL = pathToFileURL(urlCompatibleFullPath).toString();

        // Add a check to see if the file exists
        const fs = require('node:fs').promises;
        try {
          await fs.access(fullPath, fs.constants.F_OK);
        } catch (e) {
          // Return a 404 response if the file doesn't exist
          return new Response('File not found', { status: 404 });
        }

        return net.fetch(fileURL);
      });
    }
  }
  module.exports = { CustomProtocol };
