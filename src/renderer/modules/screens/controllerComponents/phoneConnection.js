// phoneConnectionLayout.js
// Define the JSON structure for the "Connect Phone" screen without pairing code
import { PhoneController } from '../../controller/phone.js';
import './phoneConnection.css';

export const phoneConnectionLayout = {
  tag: "div",
  attrs: { id: "phoneScreen" },
  children: [
    {
      tag: "h1",
      attrs: { class: "title" },
      children: ["Connect Your JD Controller"]
    },
    {
      tag: "p",
      attrs: { class: "instructions" },
      children: [
        "To start controller, open this site to your browser"
      ]
    },
    {
      tag: "div",
      attrs: { class: "url" },
      children: ["Loading IP..."]
    },
    {
      tag: "div",
      attrs: { class: "button--continue", uinavable: "" },
      children: [{ tag: "span", attrs: { class: "txt-dance" }, children: ["Continue"] }]
    }
  ]
};

// Usage in your initPhone function:
import { changeSceneHTML } from '../../webRenderer.js';
import { TransitionManager } from '../../transitions/default.js';
import { startHomeScreen } from '../homeScreen.js';

export function startPhoneConnection() {
  changeSceneHTML('phoneConnection', phoneConnectionLayout, 0);

  // Request local IP from backend using the exposed API
  globalThis.electronAPI.system.getLocalIp().then(ip => {
    const urlElement = document.querySelector('#phoneScreen .url');
    if (urlElement) {
      if (ip && ip !== '127.0.0.1') {
        urlElement.textContent = `https://${ip}:8443/controller`;
      } else {
        urlElement.textContent = 'Could not determine local IP. Please check network connection.';
      }
    }
  }).catch(err => {
    console.error("Failed to get local IP:", err);
    const urlElement = document.querySelector('#phoneScreen .url');
    if (urlElement) {
      urlElement.textContent = 'Error getting local IP.';
    }
  });

  // Initialize the phone controller system with main controller handling
  if (!window.phoneController) {
    window.phoneController = new PhoneController({
      players: window.players
    });

    // Track main controller status - use a more robust structure
    window.mainControllerState = {
      phoneId: null,
      isCoachSelection: false
    };

    // Add additional debug logging
    const debug = true; // Set to false in production
    function log(...args) {
      if (debug) console.log('[PhoneController]', ...args);
    }

    // Connect to server
    window.phoneController.connect().then(() => {
      log("Phone controller connected to server");
    }).catch(err => {
      console.error("Failed to connect phone controller:", err);
    });

    // Handle phone connections
    window.phoneController.on('phoneConnected', ({ phoneId }) => {
      log(`Phone ${phoneId} connected!`);

      // If no main controller exists, assign this phone as main
      if (window.mainControllerState.phoneId === null) {
        window.mainControllerState.phoneId = phoneId;
        log(`Phone ${phoneId} assigned as main controller`);

        // Update UI for main controller
        window.phoneController.sendToPhone(phoneId, {
          type: 'notification',
          message: 'You are the main controller'
        });

        // Configure this phone as main controller
        window.phoneController.setupPhoneUI(phoneId, {
          isMainController: true,
          showDPad: true
        });
      } else {
        // Configure as regular controller
        window.phoneController.setupPhoneUI(phoneId, {
          isMainController: false,
          showDPad: window.mainControllerState.isCoachSelection // Only show D-pad during coach selection
        });

        // Inform user they're not main controller
        window.phoneController.sendToPhone(phoneId, {
          type: 'notification',
          message: 'Waiting for your turn to control'
        });
      }
    });

    // Handle disconnections - reassign main controller if needed
    window.phoneController.on('phoneDisconnected', ({ phoneId }) => {
      log(`Phone ${phoneId} disconnected`);

      // If the main controller disconnected, assign a new one
      if (window.mainControllerState.phoneId === phoneId) {
        const activePhones = Array.from(window.phoneController.getActivePhones());

        if (activePhones.length > 0) {
          // Assign first available phone as new main controller
          const newMainId = activePhones[0];
          window.mainControllerState.phoneId = newMainId;
          log(`Reassigning main controller to phone ${newMainId}`);

          // Update UI for new main controller
          window.phoneController.setupPhoneUI(newMainId, {
            isMainController: true,
            showDPad: true
          });

          window.phoneController.sendToPhone(newMainId, {
            type: 'notification',
            message: 'You are now the main controller'
          });
        } else {
          // No phones left, reset main controller
          window.mainControllerState.phoneId = null;
          log('No active phones - waiting for connection');
        }
      }
    });

    // Handle d-pad input with main controller restriction - FIX VALUE COMPARISON
    window.phoneController.on('dpad', ({ phoneId, direction, value }) => {
      // Log the raw data to debug
      log(`DPAD RAW DATA: phoneId=${phoneId}, dir=${direction}, value=${value}, typeof value=${typeof value}`);
      log(`Current mainController: ${window.mainControllerState.phoneId}, isCoachSelection: ${window.mainControllerState.isCoachSelection}`);

      // Compare phoneId as numbers to ensure correct comparison
      const phoneIdNum = Number(phoneId);
      const mainIdNum = Number(window.mainControllerState.phoneId);
      const isMainController = (phoneIdNum === mainIdNum);

      // Fix value comparison - handle value as either boolean or string
      // The WebSocket might send '1' as string or true as boolean
      const isValueActive = (value === true || value === 1 || value === '1');

      // Determine if this controller can control now
      const canControl = isMainController ||
        (window.mainControllerState.isCoachSelection && !isMainController);

      log(`Processing DPAD: isMain=${isMainController}, canControl=${canControl}, isValueActive=${isValueActive}`);

      if (canControl && isValueActive) {
        log(`Executing action: ${direction}`);
        if (direction === "center") {
          window.navigation.executeAction('enter');
        } else {
          window.navigation.executeAction(direction);
        }
      } else {
        if (!canControl) {
          log(`Ignoring input from non-controlling phone ${phoneId}`);
        }
        if (!isValueActive) {
          log(`Ignoring inactive value: ${value}`);
        }
      }
    });

    // Button press handler - also fix boolean comparison
    window.phoneController.on('buttonPress', ({ phoneId, button, pressed }) => {
      log(`Button press: phoneId=${phoneId}, button=${button}, pressed=${pressed}, typeof pressed=${typeof pressed}`);

      // Handle pressed as either boolean or string
      const isPressedActive = (pressed === true || pressed === 1 || pressed === '1');
      const isMainController = (Number(phoneId) === Number(window.mainControllerState.phoneId));

      log(`Button process: isMain=${isMainController}, isPressedActive=${isPressedActive}`);

      // Only allow main controller to use buttons (could add exceptions here)
      if (isMainController && isPressedActive) {
        log(`Executing button action: ${button}`);
        if (button === 'action') {
          window.navigation.executeAction('enter');
        } else if (button === 'back') {
          window.navigation.executeAction('back');
        } else if (button === 'menu') {
          window.navigation.executeAction('menu');
        }
      }
    });

    // Public methods to control coach selection mode
    window.setCoachSelectionMode = function (enabled) {
      window.mainControllerState.isCoachSelection = !!enabled; // Convert to boolean explicitly
      log(`Coach selection mode: ${enabled ? 'enabled' : 'disabled'}`);

      // Update all non-main controllers to show/hide d-pad
      const activePhones = Array.from(window.phoneController.getActivePhones());
      const mainId = window.mainControllerState.phoneId;

      activePhones.forEach(phoneId => {
        if (Number(phoneId) !== Number(mainId)) {
          window.phoneController.setupPhoneUI(phoneId, {
            isMainController: false,
            showDPad: !!enabled // Make sure it's boolean
          });

          // Inform users of mode change
          window.phoneController.sendToPhone(phoneId, {
            type: 'notification',
            message: enabled ? 'Coach selection active - you can now use controls' : 'Main controller mode active'
          });
        }
      });
    };

    // Method to force refresh all controller UIs
    window.refreshControllerUI = function () {
      const activePhones = Array.from(window.phoneController.getActivePhones());
      const mainId = window.mainControllerState.phoneId;

      log(`Refreshing UI for all ${activePhones.length} controllers`);

      activePhones.forEach(phoneId => {
        const isMain = Number(phoneId) === Number(mainId);
        window.phoneController.setupPhoneUI(phoneId, {
          isMainController: isMain,
          showDPad: isMain || window.mainControllerState.isCoachSelection
        });

        // Re-notify about status
        window.phoneController.sendToPhone(phoneId, {
          type: 'notification',
          message: isMain ? 'You are the main controller' :
            (window.mainControllerState.isCoachSelection ?
              'Coach selection active - you can control' :
              'Waiting for your turn to control')
        });
      });
    };

    // Method to manually switch the main controller
    window.switchMainController = function (newMainPhoneId) {
      const oldMainId = window.mainControllerState.phoneId;

      // Convert to number for consistent comparison
      newMainPhoneId = Number(newMainPhoneId);

      if (window.phoneController.getActivePhones().has(newMainPhoneId)) {
        // Update state
        window.mainControllerState.phoneId = newMainPhoneId;
        log(`Manually switched main controller from ${oldMainId} to ${newMainPhoneId}`);

        // Update old main controller UI if it exists
        if (oldMainId !== null && window.phoneController.getActivePhones().has(oldMainId)) {
          window.phoneController.setupPhoneUI(oldMainId, {
            isMainController: false,
            showDPad: !!window.mainControllerState.isCoachSelection // Make sure it's boolean
          });

          window.phoneController.sendToPhone(oldMainId, {
            type: 'notification',
            message: 'You are no longer the main controller'
          });
        }

        // Update new main controller UI
        window.phoneController.setupPhoneUI(newMainPhoneId, {
          isMainController: true,
          showDPad: true
        });

        window.phoneController.sendToPhone(newMainPhoneId, {
          type: 'notification',
          message: 'You are now the main controller'
        });

        return true;
      } else {
        console.error(`Cannot switch to phone ${newMainPhoneId} - not connected`);
        return false;
      }
    };

    // Add a debug method to print the current state
    window.debugPhoneController = function () {
      const state = {
        mainControllerId: window.mainControllerState.phoneId,
        isCoachSelection: window.mainControllerState.isCoachSelection,
        activePhones: Array.from(window.phoneController.getActivePhones())
      };
      console.log('Phone Controller Debug:', state);
      return state;
    };
  }

  document.querySelector('.button--continue').onclick = () => {
    TransitionManager.startTransition(1, () => {
      startHomeScreen()
    })
  }
}
