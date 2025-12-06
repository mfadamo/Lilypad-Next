/**
 * PhoneController - Client library for managing phone connections
 * - Direct integration with player system
 * - Event-based messaging
 * - Streamlined phone communication
 */
export class PhoneController {
  /**
   * Create a new PhoneController client
   * @param {Object} options Configuration options
   * @param {string} options.url WebSocket URL to connect to
   * @param {Object} options.players Reference to player objects (optional)
   * @param {number} options.maxPhones Maximum number of phones to support
   */
  constructor({
    url = `ws://127.0.0.1:8080/game`,
    players = window.players || {},
    maxPhones = 6
  } = {}) {
    this.url = url;
    this.ws = null;
    this.players = players;
    this.maxPhones = maxPhones;
    this.connected = false;
    this.handlers = {};
    this.activePhones = new Set();
    this.phoneOffsets = new Map();
    this.latencies = new Map();  
    this.pingInterval = null; 

    this.EVENT_TYPES = {
      CONNECT: 'connect',
      DISCONNECT: 'disconnect',
      PHONE_CONNECTED: 'phoneConnected',
      PHONE_DISCONNECTED: 'phoneDisconnected',
      BUTTON_PRESS: 'buttonPress',
      DPAD: 'dpad',
      MOTION: 'motion',
      RAW: 'raw'
    };
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise} Resolves when connected
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.connected = true;
        this._emit(this.EVENT_TYPES.CONNECT);
        this._startPingLoop();
        resolve();
      };

      this.ws.onclose = () => {
        this.connected = false;
        this._stopPingLoop();
        this._emit(this.EVENT_TYPES.DISCONNECT);
      };

      this.ws.onerror = (err) => {
        console.error('PhoneController WebSocket error:', err);
        reject(err);
      };

      this.ws.onmessage = (e) => this._handleMessage(e.data);
    });
  }

  _startPingLoop() {
    this._stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.connected && this.activePhones.size > 0) {
        this.broadcast({
          type: 'ping',
          sendTime: performance.now()
        });
      }
    }, 1000);
  }

  _stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get the time offset for a specific phone
   * @param {number} phoneId 
   * @returns {number} Offset in ms (Add this to phone time to get game time)
   */
  getPhoneOffset(phoneId) {
    return this.phoneOffsets.get(phoneId) || 0;
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.activePhones.clear();
  }

  /**
   * Subscribe to events
   * @param {string} eventType Event type to listen for
   * @param {Function} callback Function to call when event occurs
   */
  on(eventType, callback) {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType].push(callback);
    return this;
  }

  /**
   * Unsubscribe from events
   * @param {string} eventType Event type to stop listening for
   * @param {Function} callback Function to remove
   */
  off(eventType, callback) {
    if (this.handlers[eventType]) {
      this.handlers[eventType] = this.handlers[eventType].filter(fn => fn !== callback);
    }
    return this;
  }

  /**
   * Send a message to a specific phone
   * @param {number} phoneId ID of the phone to send to
   * @param {Object} payload Data to send
   */
  sendToPhone(phoneId, payload) {
    if (!this.activePhones.has(phoneId)) {
      console.warn(`PhoneController: Attempting to send to unknown phoneId ${phoneId}`);
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        targetPhoneId: phoneId,
        payload
      }));
    } else {
      console.error('PhoneController: Cannot send message, not connected');
    }

    return this;
  }

  /**
   * Broadcast a message to all connected phones
   * @param {Object} payload Data to send
   */
  broadcast(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        broadcast: true,
        payload
      }));
    } else {
      console.error('PhoneController: Cannot broadcast, not connected');
    }

    return this;
  }

  /**
   * Send player profile to a specific phone
   * @param {number} phoneId ID of phone to update
   * @param {Object} profile Player profile data
   */
  sendProfileToPhone(phoneId, profile = null) {
    if (!profile && this.players[`player${phoneId + 1}`]) {
      const player = this.players[`player${phoneId + 1}`];
      profile = {
        name: player.name || `Player ${phoneId + 1}`,
        playerId: phoneId,
        color: player.color || this._getDefaultColor(phoneId),
        avatar: player.avatar || 'default',
        showOnScreen: true
      };
    }

    if (!profile) {
      profile = {
        name: `Player ${phoneId + 1}`,
        playerId: phoneId,
        color: this._getDefaultColor(phoneId),
        avatar: 'default',
        showOnScreen: true
      };
    }

    return this.sendToPhone(phoneId, {
      type: 'profile',
      profile
    });
  }

  /**
   * Enable or disable phone motion/accelerometer
   * @param {number} phoneId ID of phone to update
   * @param {boolean} enabled Whether to enable motion
   */
  enableMotion(phoneId, enabled = true) {
    return this.sendToPhone(phoneId, {
      type: 'enableMotion',
      enabled
    });
  }

  /**
   * Request UI setup for phone controller
   * @param {number} phoneId ID of phone to update
   * @param {Object} options UI configuration options
   */
  setupPhoneUI(phoneId, options = {}) {
    const defaults = {
      isMainController: false,
      showDPad: true,
      showMenuButton: true,
      showBackButton: true,
      showActionButton: true,
      controllerMode: 'standard', // 'standard', 'motion', 'custom'
      displayText: ''
    };

    const config = { ...defaults, ...options };

    return this.sendToPhone(phoneId, {
      type: 'uiSetup',
      ...config
    });
  }

  /**
   * Update player data from phone information
   * @param {number} phoneId ID of the phone
   * @param {boolean} isActive Whether the phone is active
   */
  updatePlayerFromPhone(phoneId, isActive = true) {
    const playerKey = `player${phoneId + 1}`;

    if (this.players[playerKey]) {
      const player = this.players[playerKey];
      player.isActive = isActive;
      player.isController = isActive;
      player.controllerType = 'phone';

      // Notify game that player status changed
      window.dispatchEvent(new CustomEvent('playerStatusChanged', {
        detail: { playerKey, player }
      }));
    }

    return this;
  }

  /**
   * Get all active phones
   * @returns {Set} Set of active phone IDs
   */
  getActivePhones() {
    return new Set(this.activePhones);
  }

  /**
   * Internal: Handle incoming WebSocket messages
   * @private
   */
  _handleMessage(data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      console.error('PhoneController: Failed to parse message', data);
      return;
    }

    this._emit(this.EVENT_TYPES.RAW, msg);

    const phoneId = msg.phoneId;

    switch (msg.type) {
      case 'phoneStatus':
        if (msg.connectedPhones) {
          this.activePhones.clear();
          for (const phone of msg.connectedPhones) {
            this.activePhones.add(phone.phoneId);
            this.updatePlayerFromPhone(phone.phoneId, true);
            this._emit(this.EVENT_TYPES.PHONE_CONNECTED, { phoneId: phone.phoneId });
          }
        }
        break;

      case 'phoneConnected':
        if (phoneId !== undefined) {
          this.activePhones.add(phoneId);
          this.updatePlayerFromPhone(phoneId, true);

          this.sendProfileToPhone(phoneId);
          this.setupPhoneUI(phoneId);

          this._emit(this.EVENT_TYPES.PHONE_CONNECTED, { phoneId });
        }
        break;

      case 'phoneDisconnected':
        if (phoneId !== undefined) {
          this.activePhones.delete(phoneId);
          this.updatePlayerFromPhone(phoneId, false);
          this._emit(this.EVENT_TYPES.PHONE_DISCONNECTED, { phoneId });
        }
        break;

      case 'buttonPress':
        if (phoneId !== undefined) {
          this._emit(this.EVENT_TYPES.BUTTON_PRESS, {
            phoneId,
            button: msg.button,
            pressed: msg.pressed
          });
        }
        break;

      case 'dpad':
        if (phoneId !== undefined) {
          this._emit(this.EVENT_TYPES.DPAD, {
            phoneId,
            direction: msg.direction,
            value: msg.value
          });
        }
        break;

      case 'motion':
        if (phoneId !== undefined) {
          this._emit(this.EVENT_TYPES.MOTION, {
            phoneId,
            data: msg.data,
            timestamp: msg.timestamp
          });
        }
        break;

      case 'updatePlayerProfile':
        if (phoneId !== undefined && msg.profile) {
          const playerKey = `player${phoneId + 1}`;
          if (this.players[playerKey]) {
            Object.assign(this.players[playerKey], msg.profile);
            console.log(`Player ${phoneId + 1} profile updated:`, this.players[playerKey]);
          }
        }
        break;

      case 'pong':
        if (phoneId !== undefined && msg.clientSendTime) {
          const now = performance.now();
          const rtt = now - msg.clientSendTime; // Round Trip Time
          const latency = rtt / 2;
          
          // Offset = (GameReceiveTime - Latency) - PhoneSendTime
          const offset = (now - latency) - msg.phoneReceiveTime;
          
          this.phoneOffsets.set(phoneId, offset);
          this.latencies.set(phoneId, latency);
          
          console.debug(`Phone ${phoneId} sync: Latency=${latency.toFixed(1)}ms, Offset=${offset.toFixed(1)}ms`);
        }
        break;

      default:
        console.log(`PhoneController: Unhandled message type: ${msg.type}`, msg);
    }
  }

  /**
   * Internal: Emit events to listeners
   * @private
   */
  _emit(type, data) {
    const handlers = this.handlers[type] || [];
    handlers.forEach(fn => fn(data));

    // Also dispatch DOM events for convenience
    window.dispatchEvent(new CustomEvent(`PhoneController:${type}`, {
      detail: data
    }));
  }

  /**
   * Internal: Get default color for player
   * @private
   */
  _getDefaultColor(phoneId) {
    const colors = [
      [0, 0.85, 1, 1],    // Blue
      [1, 0.35, 0.2, 1],  // Red
      [0.2, 0.8, 0.2, 1], // Green
      [1, 0.8, 0.2, 1],   // Yellow
      [0.8, 0.2, 0.8, 1], // Purple
      [1, 0.5, 0.1, 1]    // Orange
    ];

    return colors[phoneId % colors.length];
  }
}