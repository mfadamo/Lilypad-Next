//src/backend/modules/cemuhook/client.js
const dgram = require('dgram');
const EventEmitter = require('events');
const { crc32 } = require('crc');

const PROTOCOL = 1001;
const TYPE_PROTOCOL_INFO = 0x100000;
const TYPE_INFO = 0x100001;
const TYPE_DATA = 0x100002;
const TYPE_MOTOR_INFO = 0x110001;
const TYPE_RUMBLE = 0x110002;
const DEFAULT_PORT = 26760;
const HANDSHAKE_TIMEOUT_MS = 5000;

const BATTERY = {
  NOT_APPLICABLE: 0x00,
  DYING: 0x01,
  LOW: 0x02,
  MEDIUM: 0x03,
  HIGH: 0x04,
  FULL: 0x05,
  CHARGING: 0xEE,
  CHARGED: 0xEF
};

const CONNECTION_TYPE = {
  NOT_APPLICABLE: 0,
  USB: 1,
  BLUETOOTH: 2
};

const DEVICE_MODEL = {
  NOT_APPLICABLE: 0,
  PARTIAL_GYRO: 1,
  FULL_GYRO: 2
};

const SLOT_STATE = {
  NOT_CONNECTED: 0,
  RESERVED: 1,
  CONNECTED: 2
};

/**
 * CemuhookClient - Connects to a server implementing the Cemuhook DSU protocol
 * to receive controller data
 */
class CemuhookClient extends EventEmitter {
  /**
   * @param {string} host - Host to connect to (usually 'localhost')
   * @param {object} [options] - Configuration options
   * @param {number} [options.port] - Server port (default: 26760)
   * @param {object} [options.logger] - Logger instance (default: console)
   * @param {boolean} [options.autoReconnect] - Whether to auto-reconnect on disconnect (default: false)
   */
  constructor(host, options = {}) {
    super();
    this.host = host;
    this.port = options.port || DEFAULT_PORT;
    this.logger = options.logger || console;
    this.autoReconnect = options.autoReconnect || false;
    
    this.clientId = Math.floor(Math.random() * 0xffffffff);
    this.socket = null;
    
    this._handshakeTimer = null;
    this._connected = false;
    this._controllers = new Map();
    
    this.logger.info(`[INIT] CemuhookClient initialized (clientId=${this.clientId})`);
  }

  /**
   * Connect to the Cemuhook server
   * @returns {Promise<void>} Resolves when connected and handshake completes
   */
  async connect() {
    if (this._connected) {
      this.logger.warn('[CONNECT] Already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      this._cleanupSocket();
      
      this.socket = dgram.createSocket('udp4');
      
      this.socket.on('message', this._onMessage.bind(this));
      this.socket.on('error', (err) => {
        this.logger.error('[SOCKET ERROR]', err);
        this.disconnect();
        reject(err);
      });
      this.socket.on('close', () => {
        this.logger.info('[SOCKET] Closed');
        this._connected = false;
        this.emit('disconnected');
      });

      this.once('protocolInfo', () => {
        clearTimeout(this._handshakeTimer);
        this._handshakeTimer = null;
        this._connected = true;
        this.logger.info('[HANDSHAKE] Success');
        resolve();
      });

      this._handshakeTimer = setTimeout(() => {
        const err = new Error('Handshake timeout');
        this.logger.error('[TIMEOUT]', err);
        this.disconnect();
        reject(err);
      }, HANDSHAKE_TIMEOUT_MS);

      this.socket.bind(() => {
        this._sendProtocolInfoRequest();
      });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    this.logger.info('[DISCONNECT]');
    
    if (this._handshakeTimer) {
      clearTimeout(this._handshakeTimer);
      this._handshakeTimer = null;
    }
    
    this._cleanupSocket();
    this._connected = false;
    this.emit('disconnected');
  }

  /**
   * Clean up the socket
   * @private
   */
  _cleanupSocket() {
    if (this.socket) {
      this.socket.removeAllListeners();
      try {
        this.socket.close();
      } catch (e) {
      }
      this.socket = null;
    }
  }

  /**
   * Send a packet to the server
   * @private
   * @param {string} magic - Magic string (4 chars)
   * @param {number} type - Message type
   * @param {Buffer} payload - Message payload
   * @returns {boolean} Whether the send was successful
   */
  _send(magic, type, payload) {
    if (!this.socket) {
      this.logger.warn('[SEND] No socket');
      return false;
    }
    
    try {
      const header = Buffer.alloc(20);
      
      header.write(magic, 0, 4, 'ascii');
      header.writeUInt16LE(PROTOCOL, 4);
      header.writeUInt16LE(payload.length + 4, 6);
      header.writeUInt32LE(0, 8);
      header.writeUInt32LE(this.clientId, 12);
      header.writeUInt32LE(type, 16);
      
      const packet = Buffer.concat([header, payload]);
      
      const crcBuffer = Buffer.from(packet);
      crcBuffer.writeUInt32LE(0, 8);
      const crc = crc32(crcBuffer);
      
      packet.writeUInt32LE(crc, 8);
      
      this.socket.send(packet, 0, packet.length, this.port, this.host, (err) => {
        if (err) {
          this.logger.error('[SEND ERROR]', err);
          return false;
        }
      });
      
      return true;
    } catch (err) {
      this.logger.error('[SEND] Failed', err);
      return false;
    }
  }

  /**
   * Send a protocol info request
   * @private
   */
  _sendProtocolInfoRequest() {
    this.logger.debug('[SEND] Protocol info request');
    return this._send('DSUC', TYPE_PROTOCOL_INFO, Buffer.alloc(0));
  }

  /**
   * Request information about all controllers
   */
  requestControllerInfo() {
    if (!this._connected) {
      this.logger.warn('[INFO] Not connected');
      return false;
    }
    
    this.logger.debug('[SEND] Controller info request for all slots');
    
    const payload = Buffer.alloc(8);
    payload.writeInt32LE(4, 0);
    payload.writeUInt8(0, 4);
    payload.writeUInt8(1, 5);
    payload.writeUInt8(2, 6);
    payload.writeUInt8(3, 7);
    
    return this._send('DSUC', TYPE_INFO, payload);
  }

  /**
   * Request controller data for a specific slot
   * @param {number} slot - Controller slot (0-3)
   * @returns {boolean} Whether the request was sent successfully
   */
  requestControllerData(slot) {
    if (!this._connected) {
      this.logger.warn('[DATA] Not connected');
      return false;
    }

    if (slot < 0 || slot > 3) {
      this.logger.warn('[DATA] Invalid slot', { slot });
      return false;
    }
    
    this.logger.debug(`[SEND] Controller data request for slot ${slot}`);
    
    const payload = Buffer.alloc(8);
    payload.writeUInt8(1, 0);
    payload.writeUInt8(slot, 1);
    
    return this._send('DSUC', TYPE_DATA, payload);
  }

  /**
   * Request controller data for all slots
   * @returns {boolean} Whether the request was sent successfully
   */
  requestAllControllerData() {
    if (!this._connected) {
      this.logger.warn('[DATA] Not connected');
      return false;
    }
    
    this.logger.debug('[SEND] Controller data request for all controllers');
    
    const payload = Buffer.alloc(8);
    payload.writeUInt8(0, 0);
    
    return this._send('DSUC', TYPE_DATA, payload);
  }

  /**
   * Request controller data for a specific MAC address
   * @param {Buffer|Array} mac - MAC address (6 bytes)
   * @returns {boolean} Whether the request was sent successfully
   */
  requestControllerDataByMac(mac) {
    if (!this._connected) {
      this.logger.warn('[DATA] Not connected');
      return false;
    }

    if (!mac || (mac.length !== 6)) {
      this.logger.warn('[DATA] Invalid MAC address', { mac });
      return false;
    }
    
    const macStr = Array.from(mac).map(b => b.toString(16).padStart(2, '0')).join(':');
    this.logger.debug(`[SEND] Controller data request for MAC ${macStr}`);
    
    const payload = Buffer.alloc(8);
    payload.writeUInt8(2, 0);
    
    if (Buffer.isBuffer(mac)) {
      mac.copy(payload, 2, 0, 6);
    } else {
      for (let i = 0; i < 6; i++) {
        payload.writeUInt8(mac[i], 2 + i);
      }
    }
    
    return this._send('DSUC', TYPE_DATA, payload);
  }

  /**
   * Request motor information for a specific slot
   * @param {number} slot - Controller slot (0-3)
   * @returns {boolean} Whether the request was sent successfully
   */
  requestMotorInfo(slot) {
    if (!this._connected) {
      this.logger.warn('[MOTOR] Not connected');
      return false;
    }

    if (slot < 0 || slot > 3) {
      this.logger.warn('[MOTOR] Invalid slot', { slot });
      return false;
    }
    
    this.logger.debug(`[SEND] Motor info request for slot ${slot}`);
    
    const payload = Buffer.alloc(8);
    payload.writeUInt8(1, 0);
    payload.writeUInt8(slot, 1);
    
    return this._send('DSUC', TYPE_MOTOR_INFO, payload);
  }

  /**
   * Send rumble command to a specific controller
   * @param {number} slot - Controller slot (0-3)
   * @param {number} motorId - Motor ID (0 for left/small, 1 for right/large)
   * @param {number} intensity - Rumble intensity (0-255)
   * @returns {boolean} Whether the command was sent successfully
   */
  sendRumble(slot, motorId, intensity) {
    if (!this._connected) {
      this.logger.warn('[RUMBLE] Not connected');
      return false;
    }

    if (slot < 0 || slot > 3) {
      this.logger.warn('[RUMBLE] Invalid slot', { slot });
      return false;
    }

    if (motorId < 0 || motorId > 1) {
      this.logger.warn('[RUMBLE] Invalid motor ID', { motorId });
      return false;
    }

    if (intensity < 0 || intensity > 255) {
      this.logger.warn('[RUMBLE] Invalid intensity', { intensity });
      intensity = Math.max(0, Math.min(255, intensity));
    }
    
    this.logger.debug(`[SEND] Rumble command for slot ${slot}, motor ${motorId}, intensity ${intensity}`);
    
    const payload = Buffer.alloc(10);
    payload.writeUInt8(1, 0);
    payload.writeUInt8(slot, 1);
    payload.writeUInt8(motorId, 8);
    payload.writeUInt8(intensity, 9);
    
    return this._send('DSUC', TYPE_RUMBLE, payload);
  }

  /**
   * Handle incoming messages
   * @private
   * @param {Buffer} msg - Message buffer
   * @param {object} rinfo - Remote info
   */
  _onMessage(msg, rinfo) {
    try {
      if (msg.length < 20) {
        this.logger.debug('[MESSAGE] Too short');
        return;
      }
      
      const magic = msg.slice(0, 4).toString('ascii');
      const version = msg.readUInt16LE(4);
      const length = msg.readUInt16LE(6);
      const receivedCrc = msg.readUInt32LE(8);
      const serverId = msg.readUInt32LE(12);
      const type = msg.readUInt32LE(16);
      
      if (magic !== 'DSUS' || version !== PROTOCOL) {
        this.logger.debug('[MESSAGE] Invalid magic or version', { magic, version });
        return;
      }
      
      if (msg.length < 20 + length - 4 || length < 4) {
        this.logger.debug('[MESSAGE] Invalid length', { expected: 20 + length - 4, actual: msg.length });
        return;
      }
      
      const crcBuffer = Buffer.from(msg);
      crcBuffer.writeUInt32LE(0, 8);
      const calculatedCrc = crc32(crcBuffer);
      
      if (calculatedCrc !== receivedCrc) {
        this.logger.debug('[MESSAGE] CRC mismatch', { expected: calculatedCrc, received: receivedCrc });
        return;
      }
      
      const payload = msg.slice(20, 20 + length - 4);
      
      switch (type) {
        case TYPE_PROTOCOL_INFO:
          this._handleProtocolInfoResponse(payload, serverId);
          break;
          
        case TYPE_INFO:
          this._handleControllerInfoResponse(payload, serverId);
          break;
          
        case TYPE_DATA:
          this._handleControllerDataResponse(payload, serverId);
          break;
          
        case TYPE_MOTOR_INFO:
          this._handleMotorInfoResponse(payload, serverId);
          break;
          
        default:
          this.logger.debug('[MESSAGE] Unknown type', { type });
      }
    } catch (err) {
      this.logger.error('[MESSAGE] Error processing', err);
    }
  }

  /**
   * Handle protocol info response
   * @private
   * @param {Buffer} payload - Response payload
   * @param {number} serverId - Server ID
   */
  _handleProtocolInfoResponse(payload, serverId) {
    if (payload.length < 2) {
      this.logger.debug('[PROTOCOL] Invalid payload length');
      return;
    }
    
    const serverProtocol = payload.readUInt16LE(0);
    this.logger.debug(`[PROTOCOL] Server supports protocol version ${serverProtocol}`);
    
    if (serverProtocol !== PROTOCOL) {
      this.logger.warn(`[PROTOCOL] Protocol version mismatch (client: ${PROTOCOL}, server: ${serverProtocol})`);
    }
    
    this.emit('protocolInfo', { protocol: serverProtocol, serverId });
    
    this.requestControllerInfo();
  }

  /**
   * Handle controller info response
   * @private
   * @param {Buffer} payload - Response payload
   * @param {number} serverId - Server ID
   */
  _handleControllerInfoResponse(payload, serverId) {
    if (payload.length < 12) {
      this.logger.debug('[INFO] Invalid payload length');
      return;
    }
    
    const slot = payload.readUInt8(0);
    const state = payload.readUInt8(1);
    const model = payload.readUInt8(2);
    const connectionType = payload.readUInt8(3);
    
    const mac = Buffer.alloc(6);
    for (let i = 0; i < 6; i++) {
      mac[i] = payload.readUInt8(4 + i);
    }
    const macStr = Array.from(mac).map(b => b.toString(16).padStart(2, '0')).join(':');
    
    const battery = payload.readUInt8(10);
    
    this.logger.debug(`[INFO] Controller in slot ${slot}: state=${state}, model=${model}, connection=${connectionType}, mac=${macStr}, battery=${battery}`);
    
    const controller = {
      slot,
      state,
      model,
      connectionType,
      mac,
      macStr,
      battery,
      connected: state === SLOT_STATE.CONNECTED
    };
    
    this._controllers.set(slot, controller);
    
    this.emit('controllerInfo', controller);
    
    this.emit('serverInfo', { protocol: PROTOCOL, serverId });
  }

  /**
   * Handle controller data response
   * @private
   * @param {Buffer} payload - Response payload
   * @param {number} serverId - Server ID
   */
  _handleControllerDataResponse(payload, serverId) {
    if (payload.length < 80) {
      this.logger.debug('[DATA] Invalid payload length');
      return;
    }
    
    const slot = payload.readUInt8(0);
    const state = payload.readUInt8(1);
    const model = payload.readUInt8(2);
    const connectionType = payload.readUInt8(3);
    
    const mac = Buffer.alloc(6);
    for (let i = 0; i < 6; i++) {
      mac[i] = payload.readUInt8(4 + i);
    }
    
    const battery = payload.readUInt8(10);
    const connected = payload.readUInt8(11) === 1;
    const packetNumber = payload.readUInt32LE(12);
    
    const dpad1 = payload.readUInt8(16);
    const dpad2 = payload.readUInt8(17);
    const home = payload.readUInt8(18) === 1;
    const touch = payload.readUInt8(19) === 1;
    
    const buttons = {
      dpadLeft: (dpad1 & 0x80) !== 0,
      dpadDown: (dpad1 & 0x40) !== 0,
      dpadRight: (dpad1 & 0x20) !== 0,
      dpadUp: (dpad1 & 0x10) !== 0,
      options: (dpad1 & 0x08) !== 0,
      r3: (dpad1 & 0x04) !== 0,
      l3: (dpad1 & 0x02) !== 0,
      share: (dpad1 & 0x01) !== 0,
      
      y: (dpad2 & 0x80) !== 0,
      b: (dpad2 & 0x40) !== 0,
      a: (dpad2 & 0x20) !== 0,
      x: (dpad2 & 0x10) !== 0,
      r1: (dpad2 & 0x08) !== 0,
      l1: (dpad2 & 0x04) !== 0,
      r2: (dpad2 & 0x02) !== 0,
      l2: (dpad2 & 0x01) !== 0,
      
      home,
      touch
    };
    
    const sticks = {
      lx: payload.readUInt8(20),
      ly: payload.readUInt8(21),
      rx: payload.readUInt8(22),
      ry: payload.readUInt8(23)
    };
    
    const analog = {
      dpadLeft: payload.readUInt8(24),
      dpadDown: payload.readUInt8(25),
      dpadRight: payload.readUInt8(26),
      dpadUp: payload.readUInt8(27),
      y: payload.readUInt8(28),
      b: payload.readUInt8(29),
      a: payload.readUInt8(30),
      x: payload.readUInt8(31),
      r1: payload.readUInt8(32),
      l1: payload.readUInt8(33),
      r2: payload.readUInt8(34),
      l2: payload.readUInt8(35)
    };
    
    const touchData = [];
    
    const touch1Active = payload.readUInt8(36) === 1;
    if (touch1Active) {
      touchData.push({
        id: payload.readUInt8(37),
        x: payload.readUInt16LE(38),
        y: payload.readUInt16LE(40),
        active: true
      });
    }
    
    const touch2Active = payload.readUInt8(42) === 1;
    if (touch2Active) {
      touchData.push({
        id: payload.readUInt8(43),
        x: payload.readUInt16LE(44),
        y: payload.readUInt16LE(46),
        active: true
      });
    }
    
    let timestamp;
    if (typeof BigInt !== 'undefined') {
      timestamp = Number(payload.readBigUInt64LE(48));
    } else {
      const low = payload.readUInt32LE(48);
      const high = payload.readUInt32LE(52);
      timestamp = low + high * 0x100000000;
    }
    
    const motion = {
      timestamp,
      accelX: payload.readFloatLE(56),
      accelY: payload.readFloatLE(60),
      accelZ: payload.readFloatLE(64),
      gyroPitch: payload.readFloatLE(68),
      gyroYaw: payload.readFloatLE(72),
      gyroRoll: payload.readFloatLE(76)
    };
    
    const controllerData = {
      slot,
      state,
      model,
      connectionType,
      mac,
      battery,
      connected,
      packetNumber,
      buttons,
      sticks,
      analog,
      touch: touchData,
      motion
    };
    
    this._controllers.set(slot, {
      ...this._controllers.get(slot) || {},
      ...controllerData
    });
    console.log(`[DATA] Controller data for slot ${slot}`, controllerData);
    
    this.emit('controllerData', controllerData);
  }

  /**
   * Handle motor info response
   * @private
   * @param {Buffer} payload - Response payload
   * @param {number} serverId - Server ID
   */
  _handleMotorInfoResponse(payload, serverId) {
    if (payload.length < 12) {
      this.logger.debug('[MOTOR] Invalid payload length');
      return;
    }
    
    const slot = payload.readUInt8(0);
    const state = payload.readUInt8(1);
    const model = payload.readUInt8(2);
    const connectionType = payload.readUInt8(3);
    
    const mac = Buffer.alloc(6);
    for (let i = 0; i < 6; i++) {
      mac[i] = payload.readUInt8(4 + i);
    }
    const macStr = Array.from(mac).map(b => b.toString(16).padStart(2, '0')).join(':');
    
    const battery = payload.readUInt8(10);
    const motorCount = payload.readUInt8(11);
    
    this.logger.debug(`[MOTOR] Controller in slot ${slot} has ${motorCount} motors`);
    
    if (this._controllers.has(slot)) {
      const controller = this._controllers.get(slot);
      controller.motorCount = motorCount;
      this._controllers.set(slot, controller);
    }
    
    this.emit('motorInfo', {
      slot,
      state,
      model,
      connectionType,
      mac,
      macStr,
      battery,
      motorCount
    });
  }

  /**
   * Get list of all controllers
   * @returns {Array} Array of controller objects
   */
  getControllers() {
    return Array.from(this._controllers.values());
  }
  
  /**
   * Get controller by slot
   * @param {number} slot - Controller slot
   * @returns {object|null} Controller object or null if not found
   */
  getControllerBySlot(slot) {
    return this._controllers.get(slot) || null;
  }
}

module.exports = { 
  CemuhookClient,
  BATTERY,
  CONNECTION_TYPE,
  DEVICE_MODEL,
  SLOT_STATE
};