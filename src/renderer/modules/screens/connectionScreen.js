import { changeSceneHTML } from '../webRenderer.js';
import { TransitionManager } from '../transitions/default.js';
import { startHomeScreen } from './homeScreen.js';
import { startCemuHookConnection } from './controllerComponents/cemuhookConnection.js';
import { startPhoneConnection } from './controllerComponents/phoneConnection.js'
import './controllerComponents/selectConnection.css';

function createControllerOption({ type, label, icon }) {
    return {
        tag: 'div',
        attrs: {
            class: `controller-option ${type}`,
            uinavable: ''
        },
        children: [
            {
                tag: 'img',
                attrs: {
                    src: icon,
                    class: 'controller-icon'
                }
            },
            {
                tag: 'span',
                attrs: { class: 'controller-label' },
                children: [label]
            }
        ]
    };
}

function showComingSoonMessage() {
    alert('Coming soon! This controller option is not available yet.');
}

export function startControllerSelect() {
    const CONTROLLER_OPTIONS = [
        {
            type: 'phone',
            label: 'Phone',
            icon: require('../../../assets/texture/ui/phone_controller.webp')
        },
        {
            type: 'cemuhook',
            label: 'CemuHook',
            icon: require('../../../assets/texture/ui/phone_controller.webp')
        },
        {
            type: 'camera',
            label: 'Phone Camera',
            icon: require('../../../assets/texture/ui/phone_camera.webp')
        },
        {
            type: 'nocontroller',
            label: 'No Controller',
            icon: require('../../../assets/texture/ui/no_controller.webp')
        }
    ];

    changeSceneHTML('controllerSelect', {
        tag: 'div',
        attrs: { id: 'ControllerSelectScreen' },
        children: [
            {
                tag: 'h1',
                attrs: { class: 'select-title' },
                children: ['Select Your Controller']
            },
            {
                tag: 'div',
                attrs: { class: 'controller-options' },
                children: CONTROLLER_OPTIONS.map(createControllerOption)
            }
        ]
    });

    document.querySelectorAll('.controller-option').forEach((option) => {
        option.addEventListener('click', () => {
            try {
                if (option.classList.contains('nocontroller')) {
                    TransitionManager.startTransition(1, startHomeScreen);
                } else if (option.classList.contains('cemuhook')) {
                    TransitionManager.startTransition(1, () => {
                        startCemuHookConnection();
                    });
                } else if (option.classList.contains('phone')) {
                    TransitionManager.startTransition(1, startPhoneConnection);
                } else {
                    showComingSoonMessage();
                }
            } catch (error) {
                console.error('Error during transition:', error);
            }
        });
    });
}
