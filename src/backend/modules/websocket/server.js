// server.js - Enhanced WebSocket server for phone controllers with SSL support
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { key, cert } = require('./ssl')

/**
 * Enhanced Phone Controller Server
 * - Direct connection between phone and renderer
 * - Automatic phoneID assignment
 * - Efficient message handling and routing
 * - Dual support for SSL and non-SSL connections
 */
class PhoneControllerServer {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.sslPort = options.sslPort || 8443;
    this.sslKeyPath = options.sslKeyPath || '../../assets/ssl/key.pem';
    this.sslCertPath = options.sslCertPath || '../../assets/ssl/cert.pem';

    this.httpServer = null;
    this.httpsServer = null;
    this.wsServer = null;
    this.wssServer = null;
    this.MAX_PHONES = 6;

    this.phoneClients = new Map(); // clientId -> websocket
    this.rendererClients = new Set();

    this.phoneIdCounter = 0;
    this.phoneIdMap = new Map(); // clientId -> phoneId
    this.originalPhoneNames = new Map(); // phoneId -> originalName
  }

  start() {
    if (this.httpServer || this.httpsServer) {
      console.log('WebSocket servers already running');
      return;
    }

    const httpHandler = (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      // Set CORS headers for all HTTP responses
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (parsedUrl.pathname === '/lilypad-controller') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 'JD-LILYPAD': true }));
      } else if (parsedUrl.pathname === '/controller') {
        try {
          const htmlContent = fs.readFileSync('src/phone/index.html', 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlContent);
        } catch (err) {
          console.error('Error serving phone controller HTML:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error loading phone controller interface');
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Phone Controller WebSocket server running');
      }
    };

    this.httpServer = http.createServer(httpHandler);

    try {
      this.httpsServer = https.createServer({ key, cert }, httpHandler);
    } catch (err) {
      console.error('Failed to load SSL certificates:', err);
      console.log('HTTP server will start, but HTTPS server will not be available');
    }

    this.wsServer = new WebSocket.Server({
      server: this.httpServer,
      host: '0.0.0.0' // Listen on all interfaces
    });

    if (this.httpsServer) {
      this.wssServer = new WebSocket.Server({
        server: this.httpsServer,
        host: '0.0.0.0' // Listen on all interfaces
      });
    }

    this.wsServer.on('connection', (ws, req) => this.handleConnection(ws, req, false));

    if (this.wssServer) {
      this.wssServer.on('connection', (ws, req) => this.handleConnection(ws, req, true));
    }

    this.httpServer.listen(this.port, '0.0.0.0', () => {
      console.log(`Phone Controller HTTP server listening on port ${this.port}`);
    });

    if (this.httpsServer) {
      this.httpsServer.listen(this.sslPort, '0.0.0.0', () => {
        console.log(`Phone Controller HTTPS server listening on port ${this.sslPort}`);
      });
    }

    console.log(`Paths: /phone for controllers, /game for renderers`);
    return this;
  }

  stop() {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    if (this.httpsServer) {
      this.httpsServer.close();
      this.httpsServer = null;
    }

    if (this.wsServer) {
      for (let ws of this.wsServer.clients) {
        try { ws.close(); }
        catch (err) { console.error('Error closing non-SSL connection:', err); }
      }
      this.wsServer = null;
    }

    if (this.wssServer) {
      for (let ws of this.wssServer.clients) {
        try { ws.close(); }
        catch (err) { console.error('Error closing SSL connection:', err); }
      }
      this.wssServer = null;
    }

    this.phoneClients.clear();
    this.rendererClients.clear();
    this.phoneIdMap.clear();
    console.log('Phone Controller server stopped');
  }

  handleConnection(ws, req, isSecure) {
    const pathname = url.parse(req.url).pathname;
    const protocol = isSecure ? 'WSS' : 'WS';
    console.log(`New ${protocol} connection on path: ${pathname}`);

    if (pathname === '/phone') {
      this.handlePhoneConnection(ws);
    }
    else if (pathname === '/game') {
      this.handleGameConnection(ws);
    } else if (pathname === '/check') {
      // Connection check endpoint
      ws.send(JSON.stringify({ status: 'ok', secure: isSecure }));
      ws.close();
    }
    else {
      console.warn(`Unknown connection type: ${pathname}`);
      ws.close(1003, 'Invalid endpoint - use /phone or /game');
    }
  }

  handlePhoneConnection(ws) {
    if (this.rendererClients.size === 0) {
      console.log('Phone connection rejected - no game renderer connected');
      ws.close(1013, 'No game renderer connected - please try again when the game is active');
      return;
    }

    if (this.phoneClients.size >= this.MAX_PHONES) {
      console.log('Phone connection rejected - maximum number of phones connected');
      ws.close(1013, 'Maximum number of phones connected');
      return;
    }

    const clientId = `phone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    ws.clientId = clientId;

    const phoneId = this.getNextAvailablePhoneId();
    this.phoneIdMap.set(clientId, phoneId);
    ws.phoneId = phoneId;

    this.phoneClients.set(clientId, ws);
    this.originalPhoneNames.set(phoneId, `Player ${phoneId + 1}`);
    console.log(`Phone connected: clientId=${clientId}, phoneId=${phoneId}`);

    ws.send(JSON.stringify({
      type: 'phoneAssignment',
      phoneId: phoneId,
      playerNumber: phoneId // 0-based internally, 1-based for display
    }));

    ws.on('message', (data) => {
      this.handlePhoneMessage(clientId, phoneId, data);
    });

    ws.on('close', () => {
      console.log(`Phone disconnected: clientId=${clientId}, phoneId=${phoneId}`);
      this.phoneClients.delete(clientId);
      this.phoneIdMap.delete(clientId);

      // Revert player name to original on disconnect
      if (this.originalPhoneNames.has(phoneId)) {
        const originalName = this.originalPhoneNames.get(phoneId);
        this.notifyRenderersOfProfileUpdate(phoneId, { name: originalName });
        this.originalPhoneNames.delete(phoneId);
      }

      this.notifyRenderersOfDisconnect(phoneId);
    });

    ws.on('error', (err) => {
      console.error(`Phone ${clientId} error:`, err);
    });

    this.notifyRenderersOfConnect(phoneId);
  }

  handleGameConnection(ws) {
    const firstRenderer = this.rendererClients.size === 0;
    this.rendererClients.add(ws);
    console.log('Game renderer connected');

    const connectedPhones = [];
    for (const [clientId, phoneId] of this.phoneIdMap.entries()) {
      connectedPhones.push({ phoneId, clientId });
    }

    ws.send(JSON.stringify({
      type: 'phoneStatus',
      connectedPhones: connectedPhones
    }));

    ws.on('message', (data) => {
      this.handleGameMessage(ws, data);
    });

    ws.on('close', () => {
      console.log('Game renderer disconnected');
      this.rendererClients.delete(ws);

      // If this was the last renderer, disconnect all phones
      if (this.rendererClients.size === 0) {
        console.log('Last renderer disconnected - disconnecting all phones');
        this.disconnectAllPhones('No game renderer connected');
      }
    });

    ws.on('error', (err) => {
      console.error('Game renderer error:', err);
    });
  }

  handlePhoneMessage(clientId, phoneId, data) {
    let message;
    try {
      message = JSON.parse(data);
      message.phoneId = phoneId;
    } catch (e) {
      console.log(`Phone ${phoneId} (${clientId}) sent unparseable data`);
      return;
    }

    if (message.type === 'updateProfileData' && message.profile && message.profile.name) {
      const newName = message.profile.name;
      this.notifyRenderersOfProfileUpdate(phoneId, { name: newName });
    }

    for (const renderer of this.rendererClients) {
      if (renderer.readyState === WebSocket.OPEN) {
        try {
          renderer.send(JSON.stringify(message));
        } catch (err) {
          console.error('Error forwarding phone message to renderer:', err);
        }
      }
    }
  }

  notifyRenderersOfProfileUpdate(phoneId, profileData) {
    const notification = {
      type: 'updatePlayerProfile',
      phoneId: phoneId,
      profile: profileData
    };

    for (const renderer of this.rendererClients) {
      if (renderer.readyState === WebSocket.OPEN) {
        try {
          renderer.send(JSON.stringify(notification));
        } catch (err) {
          console.error('Error notifying renderer of profile update:', err);
        }
      }
    }
  }

  handleGameMessage(ws, data) {
    let message;
    try {
      message = JSON.parse(data);
    } catch (e) {
      console.error('Error parsing game message:', e);
      return;
    }

    if (message.targetPhoneId !== undefined) {
      let targetPhone = null;
      for (const [clientId, client] of this.phoneClients.entries()) {
        if (this.phoneIdMap.get(clientId) === message.targetPhoneId) {
          targetPhone = client;
          break;
        }
      }

      if (targetPhone && targetPhone.readyState === WebSocket.OPEN) {
        try {
          targetPhone.send(JSON.stringify(message.payload || message));
        } catch (err) {
          console.error(`Error forwarding to phone ${message.targetPhoneId}:`, err);
        }
      } else {
        console.warn(`Target phone ${message.targetPhoneId} not found or not connected`);
      }
    }
    else if (message.broadcast === true) {
      console.log('Broadcasting message to all phones');
      for (const phone of this.phoneClients.values()) {
        if (phone.readyState === WebSocket.OPEN) {
          try {
            phone.send(JSON.stringify(message.payload || message));
          } catch (err) {
            console.error('Error broadcasting to phone:', err);
          }
        }
      }
    }
    else {
      console.warn('Game message has no target or broadcast flag:', message);
    }
  }

  notifyRenderersOfConnect(phoneId) {
    const notification = {
      type: 'phoneConnected',
      phoneId: phoneId
    };

    for (const renderer of this.rendererClients) {
      if (renderer.readyState === WebSocket.OPEN) {
        try {
          renderer.send(JSON.stringify(notification));
        } catch (err) {
          console.error('Error notifying renderer of phone connection:', err);
        }
      }
    }
  }

  notifyRenderersOfDisconnect(phoneId) {
    const notification = {
      type: 'phoneDisconnected',
      phoneId: phoneId
    };

    for (const renderer of this.rendererClients) {
      if (renderer.readyState === WebSocket.OPEN) {
        try {
          renderer.send(JSON.stringify(notification));
        } catch (err) {
          console.error('Error notifying renderer of phone disconnection:', err);
        }
      }
    }
  }

  disconnectAllPhones(reason = 'Server disconnecting phones') {
    console.log(`Disconnecting all phones: ${reason}`);

    for (const [clientId, ws] of this.phoneClients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Send a notification to phone before disconnecting
          ws.send(JSON.stringify({
            type: 'forceDisconnect',
            reason: reason
          }));

          ws.close(1001, reason);

          console.log(`Disconnected phone: clientId=${clientId}, phoneId=${ws.phoneId}`);
        } catch (err) {
          console.error(`Error disconnecting phone ${clientId}:`, err);
        }
      }
    }

    this.phoneClients.clear();
    this.phoneIdMap.clear();
  }

  getNextAvailablePhoneId() {
    // Find first available phoneId (0-based)
    const usedIds = new Set(this.phoneIdMap.values());
    let nextId = 0;

    while (usedIds.has(nextId) && nextId < this.MAX_PHONES) {
      nextId++;
    }

    if (nextId >= this.MAX_PHONES) {
      // This shouldn't happen due to size check, but just in case
      throw new Error('No available phone IDs');
    }

    return nextId;
  }
}

module.exports = {
  PhoneControllerServer
};