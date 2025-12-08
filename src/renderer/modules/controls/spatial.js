// Spatial Navigation Module by Ibratabian17
// GitHub Repository: https://github.com/ibratabian17/spatial
// Purpose: Provides TV D-Pad support for web applications, enabling seamless navigation using directional input.
// Usage: Create an instance of the SpatialNavigation class and call the initialize() method to activate.

export class SpatialNavigation {
    constructor(config = {}) {
        this.config = {
            selector: '[data-navable], .navable',
            focusedClass: 'focused',
            keyMapping: {
                up: ['ArrowUp'],
                down: ['ArrowDown'],
                left: ['ArrowLeft'],
                right: ['ArrowRight'],
                enter: ['Enter', ' '],
                back: ['Escape', 'Backspace']
            },
            wrap: false,
            autoInitialize: true,
            focusMargin: 2,
            obstacleDetection: true,
            raycastSamples: 1,
            scrollDuration: 300,
            scrollBehavior: 'smooth',
            considerOutOfViewport: true,
            debug: false,
            
            audioFeedback: false,
            navigationSound: null,
            selectSound: null,
            backSound: null,
            
            onNavigate: null,
            onClick: null,
            onBack: null,
            onFocusChanged: null,
            
            gamepadSupport: false,
            gamepadDeadzone: 0.5,
            gamepadPollingInterval: 100, // ms
            gamepadMapping: {
                buttons: {
                    0: 'enter', // A button
                    1: 'back',  // B button
                    12: 'up',   // D-pad up
                    13: 'down', // D-pad down
                    14: 'left', // D-pad left
                    15: 'right' // D-pad right
                },
                axes: {
                    0: { positive: 'right', negative: 'left' },  // Left stick X
                    1: { positive: 'down', negative: 'up' }      // Left stick Y
                }
            },
            ...config
        };

        this.currentFocusIndex = -1;
        this.elements = [];
        this.isInitialized = false;
        this.navigationHistory = [];
        this.lastGamepadTimestamp = 0;
        this.gamepadState = {
            axes: [],
            buttons: []
        };
        this.gamepadPolling = null;

        if (this.config.autoInitialize) {
            this.initialize();
        }
    }

    initialize() {
        if (this.isInitialized) return;

        this.updateElements();
        this.setupEventListeners();

        if (!this.findAndFocusNearestElement()) {
            this.log('No navable elements found in initial check');
        }

        this.setupMutationObserver();
        
        if (this.config.gamepadSupport) {
            this.initGamepadSupport();
        }

        this.isInitialized = true;
        this.log('Spatial Navigation initialized');
    }

    destroy() {
        this.removeEventListeners();
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        if (this.gamepadPolling) {
            clearInterval(this.gamepadPolling);
            this.gamepadPolling = null;
        }
        
        this.isInitialized = false;
        this.elements = [];
        this.currentFocusIndex = -1;
    }

    setupMutationObserver() {
        this.mutationObserver = new MutationObserver((mutations) => {
            let needsUpdate = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    needsUpdate = true;
                }
            });

            if (needsUpdate) {
                this.updateElements();
                this.validateCurrentFocus();
            }
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-navable', 'style', 'hidden']
        });
    }

    setupEventListeners() {
        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.handleKeyDown);
    }

    removeEventListeners() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    updateElements() {
        const previouslyFocusedElement = this.currentFocusIndex >= 0 ? this.elements[this.currentFocusIndex] : null;
        const oldElements = [...this.elements];
        
        const allElements = Array.from(document.querySelectorAll(this.config.selector));
        
        this.elements = allElements.filter(el => this.isElementNavigable(el));
        
        this.log(`Found ${this.elements.length} navigable elements out of ${allElements.length} total elements`);
        
        if (previouslyFocusedElement && !this.elements.includes(previouslyFocusedElement)) {
            if (this.currentFocusIndex >= 0) {
                const lastFocusedRect = previouslyFocusedElement.getBoundingClientRect();
                const nearestIndex = this.findNearestElementIndex(lastFocusedRect);
                
                if (nearestIndex !== -1) {
                    this.currentFocusIndex = nearestIndex;
                    this.focusElement(this.currentFocusIndex);
                } else {
                    this.currentFocusIndex = -1;
                }
            }
        } else if (previouslyFocusedElement) {
            this.currentFocusIndex = this.elements.indexOf(previouslyFocusedElement);
        }
    }

    validateCurrentFocus() {
        if (this.currentFocusIndex >= 0 && 
            (this.currentFocusIndex >= this.elements.length || 
             !this.isElementNavigable(this.elements[this.currentFocusIndex]))) {
            this.findAndFocusNearestElement();
        } else if (this.elements.length === 1 && this.currentFocusIndex === -1) {
            this.currentFocusIndex = 0;
            this.focusElement(0);
        } else if (this.elements.length === 0) {
            this.currentFocusIndex = -1;
        }
    }

    findAndFocusNearestElement() {
        if (this.elements.length === 0) return false;

        if (this.elements.length === 1) {
            this.currentFocusIndex = 0;
            this.focusElement(0);
            return true;
        }

        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;

        let nearestIndex = 0;
        let minDistance = Infinity;

        this.elements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const elementCenterX = rect.left + rect.width / 2;
            const elementCenterY = rect.top + rect.height / 2;

            const distance = Math.hypot(
                elementCenterX - viewportCenterX,
                elementCenterY - viewportCenterY
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = index;
            }
        });

        this.currentFocusIndex = nearestIndex;
        this.focusElement(this.currentFocusIndex);
        return true;
    }

    findNearestElementIndex(fromRect) {
        if (this.elements.length === 0) return -1;

        let nearestIndex = 0;
        let minDistance = Infinity;

        const fromCenterX = fromRect.left + fromRect.width / 2;
        const fromCenterY = fromRect.top + fromRect.height / 2;

        this.elements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const elementCenterX = rect.left + rect.width / 2;
            const elementCenterY = rect.top + rect.height / 2;

            const distance = Math.hypot(
                elementCenterX - fromCenterX,
                elementCenterY - fromCenterY
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = index;
            }
        });

        return nearestIndex;
    }

    refocusElement() { 
        if (this.currentFocusIndex >= 0 && this.currentFocusIndex < this.elements.length) {
            this.focusElement(this.currentFocusIndex);
        } else {
            this.findAndFocusNearestElement();
        }
    }

    isElementNavigable(element) {
        if (!element || !element.nodeType) return false;
        
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            this.log(`Element ${element.tagName} has zero dimensions`, element);
            return false;
        }
        
        let currentNode = element;
        while (currentNode) {
            const style = window.getComputedStyle(currentNode);
            
            if (style.display === 'none') {
                this.log(`Element ${element.tagName} or its parent has display: none`, element);
                return false;
            }
            
            if (style.visibility === 'hidden' || style.visibility === 'collapse') {
                this.log(`Element ${element.tagName} or its parent has visibility: hidden`, element);
                return false;
            }
            
            if (parseFloat(style.opacity) === 0) {
                this.log(`Element ${element.tagName} or its parent has opacity: 0`, element);
                return false;
            }
            
            if (currentNode.hidden) {
                this.log(`Element ${element.tagName} or its parent has hidden attribute`, element);
                return false;
            }
            
            if (currentNode.getAttribute('aria-hidden') === 'true') {
                this.log(`Element ${element.tagName} or its parent has aria-hidden="true"`, element);
                return false;
            }
            
            currentNode = currentNode.parentElement;
        }
        
        if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
            this.log(`Element ${element.tagName} is disabled`, element);
            return false;
        }
        
        if (rect.top > document.documentElement.clientHeight * 2 || 
            rect.bottom < -document.documentElement.clientHeight || 
            rect.left > document.documentElement.clientWidth * 2 || 
            rect.right < -document.documentElement.clientWidth) {
            this.log(`Element ${element.tagName} is far outside document bounds`, element);
            return false;
        }
        
        return true;
    }

    isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );
    }

    getScrollableParent(element) {
        let parent = element.parentElement;
        
        while (parent) {
            const style = window.getComputedStyle(parent);
            const isScrollable = (
                (style.overflow === 'auto' || style.overflow === 'scroll') ||
                (style.overflowX === 'auto' || style.overflowX === 'scroll') ||
                (style.overflowY === 'auto' || style.overflowY === 'scroll')
            );
            
            if (isScrollable && 
                style.display !== 'none' && 
                style.visibility !== 'hidden' &&
                style.visibility !== 'collapse') {
                return parent;
            }
            parent = parent.parentElement;
        }
        
        return document.documentElement;
    }

    scrollElementIntoView(element) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        
        if (rect.top >= 0 && 
            rect.left >= 0 && 
            rect.bottom <= window.innerHeight && 
            rect.right <= window.innerWidth) {
            return;
        }
        
        const scrollableParent = this.getScrollableParent(element);
        
        if (!this.isElementNavigable(scrollableParent)) {
            return;
        }
        
        if (scrollableParent === document.documentElement) {
            element.scrollIntoView({
                behavior: this.config.scrollBehavior,
                block: 'center',
                inline: 'center'
            });
        } else {
            const parentRect = scrollableParent.getBoundingClientRect();
            
            const style = window.getComputedStyle(scrollableParent);
            const hasHorizontalScroll = (style.overflowX === 'auto' || style.overflowX === 'scroll') && 
                                       scrollableParent.scrollWidth > scrollableParent.clientWidth;
            const hasVerticalScroll = (style.overflowY === 'auto' || style.overflowY === 'scroll') && 
                                     scrollableParent.scrollHeight > scrollableParent.clientHeight;
            
            if (hasHorizontalScroll) {
                const elementOffsetLeft = element.offsetLeft;
                const elementWidth = rect.width;
                const parentWidth = parentRect.width;
                
                const targetScrollLeft = elementOffsetLeft - (parentWidth / 2) + (elementWidth / 2);
                
                if (this.config.scrollBehavior === 'smooth') {
                    this.smoothScrollTo(scrollableParent, 'scrollLeft', targetScrollLeft, this.config.scrollDuration);
                } else {
                    scrollableParent.scrollLeft = targetScrollLeft;
                }
            }
            
            if (hasVerticalScroll) {
                const elementOffsetTop = element.offsetTop;
                const elementHeight = rect.height;
                const parentHeight = parentRect.height;
                
                const targetScrollTop = elementOffsetTop - (parentHeight / 2) + (elementHeight / 2);
                
                if (this.config.scrollBehavior === 'smooth') {
                    this.smoothScrollTo(scrollableParent, 'scrollTop', targetScrollTop, this.config.scrollDuration);
                } else {
                    scrollableParent.scrollTop = targetScrollTop;
                }
            }
        }
    }
    
    smoothScrollTo(element, property, target, duration) {
        const start = element[property];
        const change = target - start;
        const startTime = performance.now();
        
        function easeInOutQuad(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }
        
        function animateScroll(currentTime) {
            const elapsedTime = currentTime - startTime;
            
            if (elapsedTime >= duration) {
                element[property] = target;
                return;
            }
            
            const progress = easeInOutQuad(elapsedTime / duration);
            element[property] = start + change * progress;
            requestAnimationFrame(animateScroll);
        }
        
        requestAnimationFrame(animateScroll);
    }

    handleKeyDown(event) {
        const key = event.key;
        let action = null;
        let handled = false;

        for (const [actionName, keys] of Object.entries(this.config.keyMapping)) {
            if (keys.includes(key)) {
                action = actionName;
                break;
            }
        }

        if (action) {
            handled = this.executeAction(action);
        }

        if (handled) {
            event.preventDefault();
        }
    }

    executeAction(action) {
        switch (action) {
            case 'up':
            case 'down':
            case 'left':
            case 'right':
                return this.navigate(action);
            case 'enter':
                return this.clickCurrent();
            case 'back':
                return this.goBack();
            default:
                return false;
        }
    }

    navigate(direction) {
        if (this.elements.length === 0) return false;

        if (this.currentFocusIndex === -1) {
            this.currentFocusIndex = 0;
            this.focusElement(0);
            return true;
        }

        const currentElement = this.elements[this.currentFocusIndex];
        
        if (!this.isElementNavigable(currentElement)) {
            this.log('Current element is no longer navigable, finding new focus', currentElement);
            this.updateElements();
            if (this.elements.length > 0) {
                this.findAndFocusNearestElement();
                return true;
            }
            return false;
        }
        
        const currentRect = currentElement.getBoundingClientRect();
        const candidates = this.findCandidatesInDirection(direction, currentRect);
        
        if (candidates.length > 0) {
            const bestCandidate = this.findBestCandidate(candidates, currentRect, direction);
            if (bestCandidate) {
                const newIndex = this.elements.indexOf(bestCandidate.element);
                
                const prevElement = this.elements[this.currentFocusIndex];
                
                this.focusElement(newIndex);
                
                if (this.config.onNavigate) {
                    this.config.onNavigate(this.elements[newIndex], direction);
                }
                
                if (this.config.audioFeedback && this.config.navigationSound) {
                    this.playSound(this.config.navigationSound);
                }
                
                return true;
            }
        }

        if (this.config.wrap) {
            const wrapIndex = this.findWrapAroundIndex(direction);
            if (wrapIndex !== -1) {
                const prevElement = this.elements[this.currentFocusIndex]; 
                this.focusElement(wrapIndex);
                
                if (this.config.audioFeedback && this.config.navigationSound) {
                    this.playSound(this.config.navigationSound);
                }
                
                return true;
            }
        }

        return false;
    }

    findCandidatesInDirection(direction, fromRect) {
        const candidates = [];

        this.elements.forEach((element, index) => {
            if (index === this.currentFocusIndex) return;
            
            if (!this.isElementNavigable(element)) return;

            const rect = element.getBoundingClientRect();
            
            if (this.isInDirection(direction, fromRect, rect)) {
                if (this.config.obstacleDetection && !this.canReachWithoutObstacles(fromRect, rect)) {
                    return;
                }
                
                candidates.push({
                    element,
                    rect,
                    index
                });
            }
        });

        return candidates;
    }

    canReachWithoutObstacles(fromRect, toRect) {
        const samples = this.config.raycastSamples;
        const obstacles = document.querySelectorAll('.obstacle');
        
        const fromCenterX = fromRect.left + fromRect.width / 2;
        const fromCenterY = fromRect.top + fromRect.height / 2;
        const toCenterX = toRect.left + toRect.width / 2;
        const toCenterY = toRect.top + toRect.height / 2;
        
        for (let i = 0; i < samples; i++) {
            const t = i / (samples - 1);
            const samplePoint = {
                x: fromCenterX + (toCenterX - fromCenterX) * t,
                y: fromCenterY + (toCenterY - fromCenterY) * t
            };
            
            for (let obstacle of obstacles) {
                if (!this.isElementNavigable(obstacle)) continue;
                
                const obstacleRect = obstacle.getBoundingClientRect();
                if (samplePoint.x >= obstacleRect.left && 
                    samplePoint.x <= obstacleRect.right &&
                    samplePoint.y >= obstacleRect.top && 
                    samplePoint.y <= obstacleRect.bottom) {
                    return false;
                }
            }
        }
        
        return true;
    }

    isInDirection(direction, fromRect, toRect) {
        const fromCenter = {
            x: fromRect.left + fromRect.width / 2,
            y: fromRect.top + fromRect.height / 2
        };
        const toCenter = {
            x: toRect.left + toRect.width / 2,
            y: toRect.top + toRect.height / 2
        };

        const dx = toCenter.x - fromCenter.x;
        const dy = toCenter.y - fromCenter.y;
        
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;

        const cone = 60; 

        let inSector = false;
        
        switch (direction) {
            case 'right':
                if (toCenter.x <= fromCenter.x) return false;
                inSector = (angle >= 360 - cone || angle <= cone);
                break;
            case 'down':
                if (toCenter.y <= fromCenter.y) return false;
                inSector = (angle >= 90 - cone && angle <= 90 + cone);
                break;
            case 'left':
                if (toCenter.x >= fromCenter.x) return false;
                inSector = (angle >= 180 - cone && angle <= 180 + cone);
                break;
            case 'up':
                if (toCenter.y >= fromCenter.y) return false;
                inSector = (angle >= 270 - cone && angle <= 270 + cone);
                break;
        }

        return inSector;
    }

    findBestCandidate(candidates, fromRect, direction) {
        let bestCandidate = null;
        let bestScore = Infinity;

        const fromCenter = {
            x: fromRect.left + fromRect.width / 2,
            y: fromRect.top + fromRect.height / 2
        };

        candidates.forEach(candidate => {
            const score = this.calculateCandidateScore(
                candidate,
                fromCenter,
                direction
            );

            if (score < bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        });

        return bestCandidate;
    }

    calculateCandidateScore(candidate, fromCenter, direction) {
        const candidateRect = candidate.rect;
        const candidateCenter = {
            x: candidateRect.left + candidateRect.width / 2,
            y: candidateRect.top + candidateRect.height / 2
        };

        const distX = Math.abs(candidateCenter.x - fromCenter.x);
        const distY = Math.abs(candidateCenter.y - fromCenter.y);

        let primaryDist, secondaryDist;

        if (direction === 'left' || direction === 'right') {
            primaryDist = distX;
            secondaryDist = distY;
        } else {
            primaryDist = distY;
            secondaryDist = distX;
        }

        let baseScore = primaryDist + (secondaryDist * 2.5);

        if (!this.isElementInViewport(candidate.element)) {
            if (this.config.considerOutOfViewport) {
                const visibilityPenalty = this.calculateVisibilityPenalty(candidate.rect);
                baseScore += visibilityPenalty;
            } else {
                baseScore = Infinity;
            }
        }

        return baseScore;
    }
    
    calculateVisibilityPenalty(rect) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
        const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
        
        const totalArea = rect.width * rect.height;
        const visibleArea = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
        const visibilityRatio = totalArea > 0 ? visibleArea / totalArea : 0;
        
        return 2000 * (1 - visibilityRatio);
    }

    findWrapAroundIndex(direction) {
        let navigableElements = this.elements.filter(el => this.isElementNavigable(el));
        if (navigableElements.length === 0) return -1;
        
        const getCenter = (rect) => ({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        });

        let sortedElements = [...navigableElements];
        
        sortedElements.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            const centerA = getCenter(rectA);
            const centerB = getCenter(rectB);

            switch (direction) {
                case 'up':
                    return centerB.y - centerA.y; 
                case 'down':
                    return centerA.y - centerB.y;
                case 'left':
                    return centerB.x - centerA.x;
                case 'right':
                    return centerA.x - centerB.x;
                default:
                    return 0;
            }
        });

        return this.elements.indexOf(sortedElements[0]);
    }

    focusElement(index) {
        if (index < 0 || index >= this.elements.length) return;
        
        if (!this.isElementNavigable(this.elements[index])) {
            this.log(`Cannot focus element at index ${index} as it's not navigable`);
            this.updateElements();
            return;
        }

        const previousElement = this.currentFocusIndex >= 0 ? this.elements[this.currentFocusIndex] : null;
        
        if (previousElement) {
            previousElement.classList.remove(this.config.focusedClass);
        }

        this.currentFocusIndex = index;
        const newElement = this.elements[index];
        newElement.classList.add(this.config.focusedClass);
        
        this.scrollElementIntoView(newElement);
        
        if (this.config.onFocusChanged && (previousElement !== newElement)) {
            this.config.onFocusChanged(newElement, previousElement);
        }
    }

    clickCurrent() {
        if (this.currentFocusIndex === -1) return false;
        
        const element = this.elements[this.currentFocusIndex];
        
        if (!this.isElementNavigable(element)) {
            this.log('Cannot click current element as it\'s not navigable');
            this.updateElements();
            return false;
        }
        
        if (this.config.audioFeedback && this.config.selectSound) {
            this.playSound(this.config.selectSound);
        }
        
        if (this.config.onClick) {
            this.config.onClick(element);
        } else {
            element.click();
        }

        return true;
    }

    goBack() {
        if (this.config.audioFeedback && this.config.backSound) {
            this.playSound(this.config.backSound);
        }
        
        if (this.config.onBack) {
            this.config.onBack();
            return true;
        }
        return false;
    }

    setOnBack(callback) {
        if (typeof callback === 'function') {
            this.config.onBack = callback;
            return true;
        }
        return false;
    }
    setOnClick(callback) { 
        if (typeof callback === 'function') {
            this.config.onClick = callback;
            return true;
        }
        return false;
    }

    log(message, data = null) {
        if (this.config.debug) {
            console.log(`[SpatialNavigation] ${message}`, data ? data : '');
        }
    }

    playSound(sound) {
        if (typeof sound === 'string') {
            const audio = new Audio(sound);
            audio.play().catch(e => this.log('Error playing sound:', e));
        } else if (sound instanceof HTMLAudioElement) {
            sound.currentTime = 0;
            sound.play().catch(e => this.log('Error playing sound:', e));
        } else if (typeof sound === 'function') {
            sound();
        }
    }

    initGamepadSupport() {
        if (!navigator.getGamepads) {
            this.log('Gamepad API not supported in this browser');
            return;
        }
        
        this.gamepadPolling = setInterval(() => {
            this.pollGamepads();
        }, this.config.gamepadPollingInterval);
        
        window.addEventListener('gamepadconnected', (e) => {
            this.log(`Gamepad connected: ${e.gamepad.id}`);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            this.log(`Gamepad disconnected: ${e.gamepad.id}`);
        });
    }
    
    pollGamepads() {
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;
        
        let activeGamepad = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                activeGamepad = gamepads[i];
                break;
            }
        }
        
        if (!activeGamepad) return;
        
        if (activeGamepad.timestamp === this.lastGamepadTimestamp) return;
        this.lastGamepadTimestamp = activeGamepad.timestamp;
        
        const buttonMapping = this.config.gamepadMapping.buttons;
        for (let i = 0; i < activeGamepad.buttons.length; i++) {
            const button = activeGamepad.buttons[i];
            
            if (button.pressed && !this.gamepadState.buttons[i]) {
                if (buttonMapping[i]) {
                    this.executeAction(buttonMapping[i]);
                }
            }
            
            this.gamepadState.buttons[i] = button.pressed;
        }
        
        const axesMapping = this.config.gamepadMapping.axes;
        for (let i = 0; i < activeGamepad.axes.length; i++) {
            const axisValue = activeGamepad.axes[i];
            const previousValue = this.gamepadState.axes[i] || 0;
            
            if (Math.abs(axisValue) >= this.config.gamepadDeadzone) {
                if (Math.abs(previousValue) < this.config.gamepadDeadzone) {
                    if (axisValue > 0 && axesMapping[i]?.positive) {
                        this.executeAction(axesMapping[i].positive);
                    } else if (axisValue < 0 && axesMapping[i]?.negative) {
                        this.executeAction(axesMapping[i].negative);
                    }
                }
            }
            
            this.gamepadState.axes[i] = axisValue;
        }
    }

    refresh() {
        this.updateElements();
        this.validateCurrentFocus();
    }

    getCurrentElement() {
        return this.currentFocusIndex >= 0 ? this.elements[this.currentFocusIndex] : null;
    }

    setFocus(element) {
        const index = this.elements.indexOf(element);
        if (index !== -1) {
            this.focusElement(index);
            return true;
        }
        return false;
    }
    
    setKeyMap(actionName, keys) {
        if (typeof keys === 'string') {
            keys = [keys];
        }
        
        if (Array.isArray(keys)) {
            this.config.keyMapping[actionName] = keys;
            return true;
        }
        
        return false;
    }
    
    addKeyToMap(actionName, key) {
        if (!this.config.keyMapping[actionName]) {
            this.config.keyMapping[actionName] = [];
        }
        
        if (!this.config.keyMapping[actionName].includes(key)) {
            this.config.keyMapping[actionName].push(key);
            return true;
        }
        
        return false;
    }
    
    removeKeyFromMap(actionName, key) {
        if (!this.config.keyMapping[actionName]) return false;
        
        const index = this.config.keyMapping[actionName].indexOf(key);
        if (index !== -1) {
            this.config.keyMapping[actionName].splice(index, 1);
            return true;
        }
        
        return false;
    }
}
