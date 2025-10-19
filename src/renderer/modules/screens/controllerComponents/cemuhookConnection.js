import { changeSceneHTML } from '../../webRenderer.js';
import CemuhookControllerHandler from '../../controller/cemuhook.js';
import './cemuhookConnection.css';

export function startCemuHookConnection() {
    const saved = JSON.parse(localStorage.getItem('cemuIPs') || '[]');
    let ips = [...new Set(saved)];
    const controllerHandler = new CemuhookControllerHandler();
    const activeConnections = {};
    const previousButtonStates = {};
    const previousStickValues = {};
    const previousAnalogValues = {};
    const previousMotionValues = {};

    function render() {
        const children = ips.map((ip, slot) => ({
            tag: 'div',
            attrs: { class: 'ip-row' },
            children: [
                {
                    tag: 'input',
                    attrs: {
                        type: 'text',
                        value: ip,
                        placeholder: '192.168.1.100',
                        'data-slot': slot
                    }
                },
                {
                    tag: 'button',
                    attrs: { 'data-remove': slot },
                    children: ['–']
                },
                {
                    tag: 'div',
                    attrs: { class: 'connection-status', 'data-status-slot': slot },
                    children: ['Not Connected']
                }
            ]
        }));

        children.push(
            { tag: 'button', attrs: { uiname: 'add-ip' }, children: ['+ Add Controller'] },
            { tag: 'button', attrs: { uiname: 'connect' }, children: ['Connect'] },
            { tag: 'button', attrs: { uiname: 'disconnect-all' }, children: ['Disconnect All'] }
        );

        changeSceneHTML('cemuhookConnection', {
            tag: 'div',
            attrs: { class: 'cemuhook-conn' },
            children
        });

        // update ips array on user input
        document.querySelectorAll('input[data-slot]').forEach(input => {
            const slot = Number(input.dataset.slot);
            input.oninput = e => {
                ips[slot] = e.target.value;
            };
        });

        document.querySelectorAll('[data-remove]').forEach(btn => {
            btn.onclick = () => {
                const idx = Number(btn.getAttribute('data-remove'));
                ips.splice(idx, 1);
                render();
            };
        });

        const addBtn = document.querySelector('[uiname="add-ip"]');
        if (addBtn) {
            addBtn.onclick = () => {
                if (ips.length < 6) {
                    ips.push('');
                    render();
                }
            };
        }

        const connectBtn = document.querySelector('[uiname="connect"]');
        if (connectBtn) {
            connectBtn.onclick = () => {
                // read fresh values directly from DOM
                const valid = Array.from(document.querySelectorAll('input[data-slot]'))
                    .map(input => ({ ip: input.value.trim(), slot: Number(input.dataset.slot) }))
                    .filter(({ ip }) => ip);
                localStorage.setItem('cemuIPs', JSON.stringify(valid.map(v => v.ip)));

                valid.forEach(({ slot, ip }) => {
                    if (!activeConnections[slot]) {
                        const success = controllerHandler.connect(slot, ip);
                        const statusDiv = document.querySelector(`[data-status-slot=\"${slot}\"]`);
                        if (success) {
                            activeConnections[slot] = true;
                            if (statusDiv) statusDiv.textContent = 'Connecting...';
                        } else {
                            if (statusDiv) statusDiv.textContent = 'Connection Failed';
                        }
                    }
                });
            };
        }

        const disconnectAllBtn = document.querySelector('[uiname="disconnect-all"]');
        if (disconnectAllBtn) {
            disconnectAllBtn.onclick = () => {
                controllerHandler.disconnectAll();
                for (const slot in activeConnections) {
                    if (activeConnections.hasOwnProperty(slot)) {
                        delete activeConnections[slot];
                        const statusDiv = document.querySelector(`[data-status-slot=\"${slot}\"]`);
                        if (statusDiv) statusDiv.textContent = 'Disconnected';
                        const input = document.querySelector(`input[data-slot=\"${slot}\"]`);
                        if (input) input.classList.remove('ok', 'error');
                    }
                }
            };
        }
    }

    // event listeners
    controllerHandler.addEventListener('controllerHandshake', (event) => {
        const { slot } = event.detail;
        const input = document.querySelector(`input[data-slot=\"${slot}\"]`);
        const statusDiv = document.querySelector(`[data-status-slot=\"${slot}\"]`);
        if (input) input.classList.add('ok');
        if (statusDiv) statusDiv.textContent = 'Connected';
        console.log(`Slot ${slot}: Handshake successful.`);
    });

    controllerHandler.addEventListener('controllerData', (event) => {
        const { slot, data } = event.detail;
        if (!previousButtonStates[slot]) previousButtonStates[slot] = {};
        if (!previousStickValues[slot]) previousStickValues[slot] = { lx: 127, ly: 127, rx: 127, ry: 127 };
        if (!previousAnalogValues[slot]) previousAnalogValues[slot] = { zl: 0, zr: 0 };
        if (!previousMotionValues[slot]) previousMotionValues[slot] = {};

        // Buttons
        if (data.buttons) {
            for (const button in data.buttons) {
                const isPressed = data.buttons[button];
                const prev = previousButtonStates[slot][button];
                if (isPressed !== prev) {
                    console.log(`Slot ${slot}: Button ${button} is now ${isPressed ? 'pressed' : 'released'}`);
                    previousButtonStates[slot][button] = isPressed;
                }
            }
        }
        // Sticks
        if (data.sticks) {
            const { lx, ly, rx, ry } = data.sticks;
            const prev = previousStickValues[slot];
            const deadzone = 8;
            if (Math.abs(lx - prev.lx) > deadzone || Math.abs(ly - prev.ly) > deadzone ||
                Math.abs(rx - prev.rx) > deadzone || Math.abs(ry - prev.ry) > deadzone) {
                console.log(`Slot ${slot}: Left Stick X=${lx} Y=${ly}`);
                console.log(`Slot ${slot}: Right Stick X=${rx} Y=${ry}`);
                previousStickValues[slot] = { lx, ly, rx, ry };
            }
        }
        // Analog triggers
        if (data.analog) {
            const { zl, zr } = data.analog;
            const prev = previousAnalogValues[slot];
            if (zl !== prev.zl || zr !== prev.zr) {
                console.log(`Slot ${slot}: Triggers ZL=${zl} ZR=${zr}`);
                previousAnalogValues[slot] = { zl, zr };
            }
        }
        // Motion
        if (data.motion) {
            const { accelX, accelY, accelZ, gyroPitch, gyroYaw, gyroRoll } = data.motion;
            const prev = previousMotionValues[slot];
            const t = 0.1;
            if (prev.accelX === undefined || Math.abs(accelX - prev.accelX) > t ||
                Math.abs(accelY - prev.accelY) > t || Math.abs(accelZ - prev.accelZ) > t ||
                Math.abs(gyroPitch - prev.gyroPitch) > t || Math.abs(gyroYaw - prev.gyroYaw) > t ||
                Math.abs(gyroRoll - prev.gyroRoll) > t) {
                console.log(`Slot ${slot}: Motion Accel X=${accelX} Y=${accelY} Z=${accelZ}`);
                console.log(`Slot ${slot}: Motion Gyro Pitch=${gyroPitch} Yaw=${gyroYaw} Roll=${gyroRoll}`);
                previousMotionValues[slot] = { accelX, accelY, accelZ, gyroPitch, gyroYaw, gyroRoll };
            }
        }
    });

    render();
}
