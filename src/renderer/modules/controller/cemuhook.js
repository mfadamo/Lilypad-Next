// CemuhookControllerHandler.js
// A simple class to handle controller connections via CemuHook protocol and respond to controller events

class CemuhookControllerHandler {
    constructor() {
      this.activeSlots = new Set();
      this.buttonCallbacks = {};
      this.axisCallbacks = {};
      this.motionCallbacks = {};
      this.lastButtonStates = {};
      this.lastAxisValues = {};
      this.controllerData = {};
      
      // Bind methods to ensure proper 'this' context
      this.onControllerHandshake = this.onControllerHandshake.bind(this);
      this.onControllerData = this.onControllerData.bind(this);
      this.onControllerInfo = this.onControllerInfo.bind(this);
      this.onControllerError = this.onControllerError.bind(this);
      this.onControllerDisconnected = this.onControllerDisconnected.bind(this);
  
      // Initialize event listeners
      this._setupEventListeners();
    }
  
    /**
     * Set up event listeners for controller events
     * @private
     */
    _setupEventListeners() {
      if (window.electronAPI && window.electronAPI.controller) {
        window.electronAPI.controller.onControllerHandshake(this.onControllerHandshake);
        window.electronAPI.controller.onControllerData(this.onControllerData);
        window.electronAPI.controller.onControllerInfo(this.onControllerInfo);
        window.electronAPI.controller.onControllerError(this.onControllerError);
        window.electronAPI.controller.onControllerDisconnected(this.onControllerDisconnected);
      } else {
        console.error('ElectronAPI or controller API not available');
      }
    }
  
    /**
     * Connect to a CemuHook server at the specified IP address
     * @param {number} slot - Controller slot number (0-3)
     * @param {string} ip - IP address of the CemuHook server
     * @returns {boolean} - Success status
     */
    connect(slot, ip) {
      if (!window.electronAPI || !window.electronAPI.controller) {
        console.error('ElectronAPI or controller API not available');
        return false;
      }
  
      // CemuHook typically supports 4 slots (0-3)
      if (slot < 0 || slot > 3) {
        console.error('Invalid slot number. Must be between 0 and 3.');
        return false;
      }
  
      if (!ip || !ip.trim()) {
        console.error('Invalid IP address');
        return false;
      }
  
      try {
        this.activeSlots.add(slot);
        // Initialize state tracking objects for this slot
        this.lastButtonStates[slot] = {};
        this.lastAxisValues[slot] = {};
        
        window.electronAPI.controller.connectController(slot, ip);
        
        return true;
      } catch (error) {
        console.error(`Failed to connect to CemuHook server at slot ${slot}:`, error);
        return false;
      }
    }
  
    /**
     * Disconnect from CemuHook server for the specified slot
     * @param {number} slot - Controller slot number
     * @returns {boolean} - Success status
     */
    disconnect(slot) {
      if (!window.electronAPI || !window.electronAPI.controller) {
        console.error('ElectronAPI or controller API not available');
        return false;
      }
  
      if (!this.activeSlots.has(slot)) {
        console.warn(`No active controller at slot ${slot}`);
        return false;
      }
  
      try {
        window.electronAPI.controller.disconnectController(slot);
        
        // Clean up slot tracking
        this.activeSlots.delete(slot);
        delete this.lastButtonStates[slot];
        delete this.lastAxisValues[slot];
        delete this.controllerData[slot];
        
        return true;
      } catch (error) {
        console.error(`Failed to disconnect controller at slot ${slot}:`, error);
        return false;
      }
    }
  
    /**
     * Disconnect all connected controllers
     */
    disconnectAll() {
      [...this.activeSlots].forEach(slot => this.disconnect(slot));
    }
  
    /**
     * Register a callback for a specific button press
     * @param {string} button - Button name (a, b, x, y, l1, r1, l2, r2, etc.)
     * @param {Function} callback - Function to call when button state changes
     * @param {Object} options - Additional options
     * @param {boolean} options.onPress - Trigger on press (default: true)
     * @param {boolean} options.onRelease - Trigger on release
     * @param {number} options.slot - Specific slot to watch, or undefined for any slot
     */
    onButton(button, callback, options = {}) {
      const { onPress = true, onRelease = false, slot } = options;
      
      if (!this.buttonCallbacks[button]) {
        this.buttonCallbacks[button] = [];
      }
      
      this.buttonCallbacks[button].push({
        callback,
        onPress,
        onRelease,
        slot
      });
    }
  
    /**
     * Register a callback for an axis value beyond threshold
     * @param {string} axis - Axis name (lx, ly, rx, ry)
     * @param {Function} callback - Function to call when axis exceeds threshold
     * @param {Object} options - Additional options
     * @param {number} options.threshold - Threshold value (0-255), default: 127
     * @param {number} options.slot - Specific slot to watch, or undefined for any slot
     */
    onAxis(axis, callback, options = {}) {
      const { threshold = 127, slot } = options;
      
      if (!this.axisCallbacks[axis]) {
        this.axisCallbacks[axis] = [];
      }
      
      this.axisCallbacks[axis].push({
        callback,
        threshold,
        slot
      });
    }
  
    /**
     * Register a callback for motion data
     * @param {string} motionType - Motion type ('gyro', 'accel', or 'all')
     * @param {Function} callback - Function to call with motion data
     * @param {Object} options - Additional options
     * @param {number} options.slot - Specific slot to watch, or undefined for any slot
     */
    onMotion(motionType, callback, options = {}) {
      const { slot } = options;
      
      if (!this.motionCallbacks[motionType]) {
        this.motionCallbacks[motionType] = [];
      }
      
      this.motionCallbacks[motionType].push({
        callback,
        slot
      });
    }
  
    /**
     * Remove all callbacks for a specific button
     * @param {string} button - Button name
     * @param {Function} [specificCallback] - Optional specific callback to remove
     */
    offButton(button, specificCallback = null) {
      if (!specificCallback) {
        delete this.buttonCallbacks[button];
      } else if (this.buttonCallbacks[button]) {
        this.buttonCallbacks[button] = this.buttonCallbacks[button].filter(
          cb => cb.callback !== specificCallback
        );
      }
    }
  
    /**
     * Remove all callbacks for a specific axis
     * @param {string} axis - Axis name
     * @param {Function} [specificCallback] - Optional specific callback to remove
     */
    offAxis(axis, specificCallback = null) {
      if (!specificCallback) {
        delete this.axisCallbacks[axis];
      } else if (this.axisCallbacks[axis]) {
        this.axisCallbacks[axis] = this.axisCallbacks[axis].filter(
          cb => cb.callback !== specificCallback
        );
      }
    }
  
    /**
     * Remove all callbacks for a specific motion type
     * @param {string} motionType - Motion type
     * @param {Function} [specificCallback] - Optional specific callback to remove
     */
    offMotion(motionType, specificCallback = null) {
      if (!specificCallback) {
        delete this.motionCallbacks[motionType];
      } else if (this.motionCallbacks[motionType]) {
        this.motionCallbacks[motionType] = this.motionCallbacks[motionType].filter(
          cb => cb.callback !== specificCallback
        );
      }
    }
  
    /**
     * Request single controller data update for a slot
     * @param {number} slot - Controller slot
     * @returns {Promise<object>} - Promise with controller data
     */
    async requestControllerData(slot) {
      if (!window.electronAPI || !window.electronAPI.controller) {
        throw new Error('ElectronAPI or controller API not available');
      }
  
      if (!this.activeSlots.has(slot)) {
        throw new Error(`No active controller at slot ${slot}`);
      }
  
      try {
        const result = await window.electronAPI.controller.requestControllerData({ slot });
        return result;
      } catch (error) {
        console.error(`Failed to request controller data at slot ${slot}:`, error);
        throw error;
      }
    }
  
    /**
     * Get latest controller data for a slot
     * @param {number} slot - Controller slot
     * @returns {object|null} - Controller data or null if not available
     */
    getControllerData(slot) {
      return this.controllerData[slot] || null;
    }
  
    /**
     * Get all controller data
     * @returns {object} - Controller data by slot
     */
    getAllControllerData() {
      return { ...this.controllerData };
    }
  
    /**
     * Send rumble command to a specific controller
     * @param {number} slot - Controller slot (0-3)
     * @param {number} motorId - Motor ID (0 for left/small, 1 for right/large)
     * @param {number} intensity - Rumble intensity (0-255)
     * @returns {Promise<boolean>} Success status
     */
    async sendRumble(slot, motorId, intensity) {
      if (!window.electronAPI || !window.electronAPI.controller) {
        throw new Error('ElectronAPI or controller API not available');
      }
  
      if (!this.activeSlots.has(slot)) {
        throw new Error(`No active controller at slot ${slot}`);
      }
  
      try {
        const result = await window.electronAPI.controller.sendRumble({ 
          slot, 
          motorId, 
          intensity 
        });
        return result.success;
      } catch (error) {
        console.error(`Failed to send rumble to slot ${slot}:`, error);
        throw error;
      }
    }
  
    /**
     * Handler for controller handshake events
     * @param {Event} event - Event object
     * @param {object} data - Handshake data
     */
    onControllerHandshake(event, { slot }) {
      console.log(`Controller handshake successful for slot ${slot}`);
      
      // Request initial controller data to populate our cache
      this.requestControllerData(slot).catch(err => {
        console.warn(`Failed to get initial controller data for slot ${slot}:`, err);
      });
    }
  
    /**
     * Handler for controller info events
     * @param {Event} event - Event object
     * @param {object} data - Controller info data
     */
    onControllerInfo(event, { slot, info }) {
      if (!this.controllerData[slot]) {
        this.controllerData[slot] = {};
      }
      
      this.controllerData[slot].info = info;
      
      this._emitEvent('controllerInfo', { slot, info });
    }
  
    /**
     * Handler for controller data events
     * @param {Event} event - Event object
     * @param {object} data - Controller data
     */
    onControllerData(event, { slot, data }) {
      if (!this.controllerData[slot]) {
        this.controllerData[slot] = {};
      }
      
      this.controllerData[slot].data = data;
      
      if (data.buttons) {
        this._processButtonEvents(slot, data.buttons);
      }
      
      if (data.sticks) {
        this._processAxisEvents(slot, data.sticks);
      }
      
      if (data.motion) {
        this._processMotionEvents(slot, data.motion);
      }
      
      this._emitEvent('controllerData', { slot, data });
    }
  
    /**
     * Handler for controller error events
     * @param {Event} event - Event object
     * @param {object} data - Error data
     */
    onControllerError(event, { slot, error }) {
      console.error(`Controller error on slot ${slot}:`, error);
      
      this._emitEvent('controllerError', { slot, error });
    }
  
    /**
     * Handler for controller disconnection events
     * @param {Event} event - Event object
     * @param {object} data - Disconnection data
     */
    onControllerDisconnected(event, { slot }) {
      console.log(`Controller disconnected on slot ${slot}`);
      
      // Clean up tracking
      this.activeSlots.delete(slot);
      delete this.lastButtonStates[slot];
      delete this.lastAxisValues[slot];
      delete this.controllerData[slot];
      
      this._emitEvent('controllerDisconnected', { slot });
    }
  
    /**
     * Custom event emitter for the handler
     * @private
     * @param {string} eventName - Event name
     * @param {object} data - Event data
     */
    _emitEvent(eventName, data) {
      const event = new CustomEvent(eventName, { detail: data });
      document.dispatchEvent(event);
    }
  
    /**
   * Process button events based on current and last states
   * @param {number} slot - Controller slot
   * @param {Object} buttons - Current button states
   * @private
   */
  _processButtonEvents(slot, buttons) {
    console.debug(`Processing button events for slot ${slot}`, buttons);
    // Initialize last button states for this slot if not exists
    if (!this.lastButtonStates[slot]) {
      this.lastButtonStates[slot] = {};
    }
    
    Object.entries(buttons).forEach(([button, isPressed]) => {
      const wasPressed = this.lastButtonStates[slot][button];
      
      if (isPressed !== wasPressed) {
        if (isPressed && !wasPressed) {
          this._triggerButtonCallbacks(button, slot, true);
        } else if (!isPressed && wasPressed) {
          this._triggerButtonCallbacks(button, slot, false);
        }
      }
      
      this.lastButtonStates[slot][button] = isPressed;
    });
  }

  /**
   * Process axis events based on current and last values
   * @param {number} slot - Controller slot
   * @param {Object} sticks - Current stick/axis values
   * @private
   */
  _processAxisEvents(slot, sticks) {
    // Initialize last axis values for this slot if not exists
    if (!this.lastAxisValues[slot]) {
      this.lastAxisValues[slot] = {};
    }
    
    Object.entries(sticks).forEach(([axis, value]) => {
      const lastValue = this.lastAxisValues[slot][axis] || 0;
      
      const callbacks = this.axisCallbacks[axis] || [];
      callbacks.forEach(({ callback, threshold, slot: callbackSlot }) => {
        // Skip if callback is for a specific slot and it's not this one
        if (callbackSlot !== undefined && callbackSlot !== slot) {
          return;
        }
        
        // Calculate if value crosses threshold in either direction
        const valueExceedsThreshold = Math.abs(value - 127) > threshold;
        const lastValueExceedsThreshold = Math.abs(lastValue - 127) > threshold;
        
        if (valueExceedsThreshold !== lastValueExceedsThreshold) {
          // Calculate direction (-1, 0, 1)
          let direction = 0;
          if (valueExceedsThreshold) {
            direction = value > 127 ? 1 : -1;
          }
          
          callback({
            slot,
            axis,
            value,
            direction,
            raw: value,
            normalized: (value - 127) / 127 // Convert to -1 to 1 range
          });
        }
      });
      
      this.lastAxisValues[slot][axis] = value;
    });
  }

  /**
   * Process motion events and call registered callbacks
   * @param {number} slot - Controller slot
   * @param {Object} motion - Motion data including acceleration and gyro
   * @private
   */
  _processMotionEvents(slot, motion) {
    // Process gyro callbacks
    if (this.motionCallbacks['gyro']) {
      this.motionCallbacks['gyro'].forEach(({ callback, slot: callbackSlot }) => {
        // Skip if callback is for a specific slot and it's not this one
        if (callbackSlot !== undefined && callbackSlot !== slot) {
          return;
        }
        
        callback({
          slot,
          type: 'gyro',
          pitch: motion.gyroPitch,
          yaw: motion.gyroYaw,
          roll: motion.gyroRoll,
          timestamp: motion.timestamp
        });
      });
    }
    
    // Process acceleration callbacks
    if (this.motionCallbacks['accel']) {
      this.motionCallbacks['accel'].forEach(({ callback, slot: callbackSlot }) => {
        // Skip if callback is for a specific slot and it's not this one
        if (callbackSlot !== undefined && callbackSlot !== slot) {
          return;
        }
        
        callback({
          slot,
          type: 'accel',
          x: motion.accelX,
          y: motion.accelY,
          z: motion.accelZ,
          timestamp: motion.timestamp
        });
      });
    }
    
    // Process all motion callbacks
    if (this.motionCallbacks['all']) {
      this.motionCallbacks['all'].forEach(({ callback, slot: callbackSlot }) => {
        // Skip if callback is for a specific slot and it's not this one
        if (callbackSlot !== undefined && callbackSlot !== slot) {
          return;
        }
        
        callback({
          slot,
          gyro: {
            pitch: motion.gyroPitch,
            yaw: motion.gyroYaw,
            roll: motion.gyroRoll
          },
          accel: {
            x: motion.accelX,
            y: motion.accelY,
            z: motion.accelZ
          },
          timestamp: motion.timestamp
        });
      });
    }
  }

  /**
   * Trigger button callbacks when button state changes
   * @param {string} button - Button name
   * @param {number} slot - Controller slot
   * @param {boolean} isPressed - Whether button is pressed or released
   * @private
   */
  _triggerButtonCallbacks(button, slot, isPressed) {
    const callbacks = this.buttonCallbacks[button] || [];
    
    callbacks.forEach(({ callback, onPress, onRelease, slot: callbackSlot }) => {
      // Skip if callback is for a specific slot and it's not this one
      if (callbackSlot !== undefined && callbackSlot !== slot) {
        return;
      }
      
      if ((isPressed && onPress) || (!isPressed && onRelease)) {
        callback({
          slot,
          button,
          pressed: isPressed,
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Get the current state of a specific button
   * @param {string} button - Button name
   * @param {number} slot - Controller slot
   * @returns {boolean|null} - Button state or null if not available
   */
  isButtonPressed(button, slot) {
    if (!this.controllerData[slot] || !this.controllerData[slot].data || 
        !this.controllerData[slot].data.buttons) {
      return null;
    }
    
    return this.controllerData[slot].data.buttons[button] || false;
  }

  /**
   * Get the current value of a specific axis
   * @param {string} axis - Axis name (lx, ly, rx, ry)
   * @param {number} slot - Controller slot
   * @param {boolean} normalized - Whether to return normalized (-1 to 1) value
   * @returns {number|null} - Axis value or null if not available
   */
  getAxisValue(axis, slot, normalized = false) {
    if (!this.controllerData[slot] || !this.controllerData[slot].data || 
        !this.controllerData[slot].data.sticks) {
      return null;
    }
    
    const value = this.controllerData[slot].data.sticks[axis];
    if (value === undefined) return null;
    
    return normalized ? (value - 127) / 127 : value;
  }

  /**
   * Get the latest motion data
   * @param {number} slot - Controller slot
   * @param {string} type - Motion type ('gyro', 'accel', or 'all')
   * @returns {object|null} - Motion data or null if not available
   */
  getMotionData(slot, type = 'all') {
    if (!this.controllerData[slot] || !this.controllerData[slot].data || 
        !this.controllerData[slot].data.motion) {
      return null;
    }
    
    const motion = this.controllerData[slot].data.motion;
    
    if (type === 'gyro') {
      return {
        pitch: motion.gyroPitch,
        yaw: motion.gyroYaw,
        roll: motion.gyroRoll,
        timestamp: motion.timestamp
      };
    } else if (type === 'accel') {
      return {
        x: motion.accelX,
        y: motion.accelY,
        z: motion.accelZ,
        timestamp: motion.timestamp
      };
    } else {
      return {
        gyro: {
          pitch: motion.gyroPitch,
          yaw: motion.gyroYaw,
          roll: motion.gyroRoll
        },
        accel: {
          x: motion.accelX,
          y: motion.accelY,
          z: motion.accelZ
        },
        timestamp: motion.timestamp
      };
    }
  }

  /**
   * Get all active controller slots
   * @returns {Array<number>} - Array of active slot numbers
   */
  getActiveSlots() {
    return [...this.activeSlots];
  }

  /**
   * Check if a controller is connected to a specific slot
   * @param {number} slot - Controller slot to check
   * @returns {boolean} - Whether a controller is connected
   */
  isControllerConnected(slot) {
    return this.activeSlots.has(slot) && 
           this.controllerData[slot] && 
           this.controllerData[slot].data;
  }

  /**
   * Get battery level of a controller
   * @param {number} slot - Controller slot
   * @returns {string|null} - Battery level description or null if not available
   */
  getBatteryLevel(slot) {
    if (!this.controllerData[slot] || !this.controllerData[slot].info) {
      return null;
    }
    
    const batteryCode = this.controllerData[slot].info.battery;
    
    // Battery level interpretations
    const batteryLevels = {
      0x00: 'not applicable',
      0x01: 'dying',
      0x02: 'low',
      0x03: 'medium',
      0x04: 'high',
      0x05: 'full',
      0xEE: 'charging',
      0xEF: 'charged'
    };
    
    return batteryLevels[batteryCode] || `unknown (${batteryCode})`;
  }

  /**
   * Add an event listener for controller events
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  addEventListener(eventName, callback) {
    document.addEventListener(eventName, callback);
  }

  /**
   * Remove an event listener for controller events
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  removeEventListener(eventName, callback) {
    document.removeEventListener(eventName, callback);
  }
}

export default CemuhookControllerHandler;