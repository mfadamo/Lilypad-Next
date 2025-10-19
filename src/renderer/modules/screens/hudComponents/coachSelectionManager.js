export default class CoachSelectionManager {
    constructor(gamevar) {
        this.gamevar = gamevar;
        this.selectionIndexes = {}; // phoneId -> coachIndex
        this._bindEvents();
    }

    setupCoachSelection() {
        const songDesc = window.selectedSongDesc;
        const assets = songDesc.assets || {};
        const defaultBase = `${this.gamevar.selectedBase}/assets/${this.gamevar.cdn}`;

        // background
        const bkgImage = assets.banner_bkgImageUrl || `${defaultBase}_map_bkg.png`;
        document.querySelector('#coachselection .banner-bkg').style.backgroundImage = `url(${bkgImage})`;

        // coach panels count
        const numCoaches = songDesc.coachCount || 4;
        const container = document.querySelector('#coach-container');
        container.setAttribute('numCoach', `${numCoaches}`);

        // show/hide panels based on numCoaches
        const panels = Array.from(container.children);
        panels.forEach((panel, i) => {
            panel.style.display = (i < numCoaches ? '' : 'none');
        });

        // coach images for visible panels
        for (let i = 1; i <= numCoaches; i++) {
            const coachKey = `coach${i}ImageUrl`;
            const coachImage = document.querySelector(`.coach-${i} .coach-image`);
            let imageUrl = assets[coachKey] ||
                `${this.gamevar.selectedBase}/assets/common/coaches/${this.gamevar.cdn.toLowerCase()}_coach_${i}_big.png`;
            if (!this.gamevar.selectedBase.includes('justdancenow.com')) {
                imageUrl = imageUrl.replace('/assets/common/coaches/', '/assets/');
            }
            if (coachImage) coachImage.style.backgroundImage = `url(${imageUrl})`;
        }

        // initial distribution only for active phones
        if (window.phoneController) {
            const activePhones = Array.from(window.phoneController.getActivePhones());
            activePhones.forEach(pid => {
                const round = Math.floor(pid / numCoaches);
                const pos = pid % numCoaches;
                const idx = (pos + round) % numCoaches;
                this.selectionIndexes[pid] = idx;
                const player = window.players[`player${pid + 1}`];
                if (player) player.currentSelectedCoach = idx;
            });

            // update UI slots: hide all, then show only active
            const panelsVisible = panels.slice(0, numCoaches);
            panelsVisible.forEach((panel, panelIndex) => {
                const slots = panel.querySelectorAll('.player-slot');
                slots.forEach((slot, pid) => {
                    if (activePhones.includes(pid) && this.selectionIndexes[pid] === panelIndex) {
                        slot.classList.remove('hidden');
                        slot.querySelector('.player-name').textContent = window.players[`player${pid + 1}`].name;
                    } else {
                        slot.classList.add('hidden');
                    }
                });
            });
        }
        // hide continue until startSong()
        document.querySelector('#coachselection .button--continue').style.display = 'none';
    }

    moveHighlight(phoneId, delta) {
        const container = document.querySelector('#coach-container');
        const numCoaches = parseInt(container.getAttribute('numCoach'), 10) || 0;
        if (numCoaches <= 0) return;

        // only active phones
        const activePhones = window.phoneController.getActivePhones();
        if (!activePhones.has(phoneId)) return;

        // init index
        if (this.selectionIndexes[phoneId] == null) this.selectionIndexes[phoneId] = 0;
        // wrap within [0, numCoaches)
        let idx = (this.selectionIndexes[phoneId] + delta + numCoaches) % numCoaches;
        this.selectionIndexes[phoneId] = idx;

        // update player model
        const player = window.players[`player${phoneId + 1}`];
        if (player) player.currentSelectedCoach = idx;

        // update panel UI: hide slot in all visible panels, show in new
        const panels = Array.from(container.children).slice(0, numCoaches);
        panels.forEach((panel, panelIndex) => {
            const slot = panel.querySelectorAll('.player-slot')[phoneId];
            if (!slot) return;
            if (panelIndex === idx) {
                slot.classList.remove('hidden');
                slot.querySelector('.player-name').textContent = player.name;
            } else {
                slot.classList.add('hidden');
            }
        });

        // inform phone (for its on‑screen UI)
        window.phoneController.sendToPhone(phoneId, { type: 'highlight', coachIndex: idx });
    }

    _bindEvents() {
        if (window.phoneController) {
            window.phoneController.on('dpad', ({ phoneId, direction, value }) => {
                if (!this.gamevar.isOnCoachSelection) return;
                const active = (value === true || value === 1 || value === '1');
                if (!active) return;

                if (direction === 'left') this.moveHighlight(phoneId, -1);
                else if (direction === 'right') this.moveHighlight(phoneId, 1);
                else if (direction === 'center') {
                    const mainId = Number(window.mainControllerState.phoneId);
                    if (phoneId === mainId) {
                        const btn = document.querySelector('#coachselection .button--continue');
                        if (btn) btn.click();
                    }
                }
            });
        }
    }
}