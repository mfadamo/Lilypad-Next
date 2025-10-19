import './recapComponents/scoreRecapScreen.css';
import { changeSceneHTML } from '../webRenderer.js';
import { TransitionManager } from '../transitions/default.js';
import { SFXManager } from '../audio/sfx.js';

// Re-using STAR_THRESHOLDS from starManager.js context
const STAR_THRESHOLDS = {
    star1: 2000,
    star2: 4000,
    star3: 6000,
    star4: 8000,
    star5: 10000,
    superstar: 11000,
    megastar: 12000
};
const STAR_ORDER = ['star1', 'star2', 'star3', 'star4', 'star5'];
const ANIMATION_DURATION = 2500; // ms

/**
 * Starts the score recap screen.
 * @param {object} finalScores - e.g., { player1: 12345, player2: 9876 }
 * @param {object} songData - The song's metadata to display title, etc.
 */
export function startScoreRecapScreen(finalScores = {}, songData = {}) {
    window.starfield.continue();
    const menuAudio = document.querySelector('.menu-audio');
    if (menuAudio) {
        menuAudio.src = require('../../../assets/audio/ui/music_jd2015.ogg');
        menuAudio.play();
    }

    const activePlayers = Object.keys(finalScores)
        .map(key => {
            const playerInfo = window.players[key] || {};
            return {
                id: key,
                name: playerInfo.name || key,
                score: finalScores[key],
                playerIndex: parseInt(key.replace('player', ''), 10) - 1,
                color: playerInfo.color || 'blue'
            };
        })
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);

    const winner = activePlayers.length > 0 ? activePlayers[0] : null;
    const otherPlayers = activePlayers.length > 1 ? activePlayers.slice(1) : [];

    // Build HTML structure
    changeSceneHTML('scoreRecapScreen', {
        tag: "div",
        attrs: { id: "RecapScreen" },
        children: [
            {
                tag: "div",
                attrs: { class: "recap-header" },
                children: [
                    { tag: "h1", attrs: { class: "recap-song-title" }, children: [songData.title || "Song Title"] },
                    { tag: "h2", attrs: { class: "recap-song-artist" }, children: [songData.artist || "Artist"] }
                ]
            },
            {
                tag: "div",
                attrs: { class: "recap-leaderboard-container" },
                children: [
                    // Winner Container
                    winner && {
                        tag: "div",
                        attrs: { class: "recap-winner-container" },
                        children: [createPlayerCard(winner, true)]
                    },
                    // Others Container
                    otherPlayers.length > 0 && {
                        tag: "div",
                        attrs: { class: "recap-others-container" },
                        children: otherPlayers.map((player, index) => createPlayerCard(player, false, index + 2))
                    }
                ].filter(Boolean)
            },
            {
                tag: "button",
                attrs: { class: "recap-continue-button hidden", uinavable: "true" },
                children: ["CONTINUE"]
            }
        ]
    });

    // Animate all players and show continue button when done
    const animationPromises = activePlayers.map(player => animatePlayerScore(player));
    Promise.all(animationPromises).then(() => {
        const continueButton = document.querySelector('.recap-continue-button');
        if (continueButton) {
            continueButton.classList.remove('hidden');
            continueButton.addEventListener('click', () => {
                SFXManager.play('menu_validate');
                TransitionManager.startTransition(1, () => {
                    require("./homeScreen.js").startHomeScreen();
                });
            });
        }
    });
}

/**
 * Creates the VDOM structure for a player card.
 * @param {object} player - The player data object.
 * @param {boolean} isWinner - True if this is the winning player.
 * @param {number|null} rank - The player's rank (e.g., 2, 3, 4).
 * @returns {object} The VDOM object for the card.
 */
function createPlayerCard(player, isWinner, rank = null) {
    const cardClasses = `player-recap-card ${player.color} ${isWinner ? 'winner' : ''}`;
    return {
        tag: "div",
        attrs: { id: `recap-${player.id}`, class: cardClasses },
        children: [
            isWinner 
                ? { tag: "div", attrs: { class: "winner-crown" }, children: ["👑"] } 
                : { tag: "div", attrs: { class: "player-rank" }, children: [`#${rank}`] },
            { tag: "div", attrs: { class: "player-name" }, children: [player.name] },
            {
                tag: "div",
                attrs: { class: "recap-stars" },
                children: STAR_ORDER.map(starKey => ({
                    tag: "div",
                    attrs: { class: `recap-star ${starKey} unearned` }
                }))
            },
            {
                tag: "div",
                attrs: { class: "score-progress-bar" },
                children: [{ tag: "div", attrs: { class: "score-progress-fill" } }]
            },
            { tag: "div", attrs: { class: "player-score-value" }, children: ["0"] }
        ]
    };
}


function animatePlayerScore(player) {
    return new Promise(resolve => {
        const card = document.getElementById(`recap-${player.id}`);
        if (!card) return resolve();

        const scoreEl = card.querySelector('.player-score-value');
        const progressFill = card.querySelector('.score-progress-fill');
        const stars = STAR_ORDER.map(key => card.querySelector(`.recap-star.${key}`));

        let currentScore = 0;
        const finalScore = player.score;
        const maxScoreForProgress = STAR_THRESHOLDS.megastar;

        const achievedStars = {};
        let startTime = null;

        function animationStep(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsedTime = timestamp - startTime;
            const progress = Math.min(elapsedTime / ANIMATION_DURATION, 1);
            currentScore = Math.floor(progress * finalScore);

            scoreEl.textContent = currentScore.toLocaleString();
            const barPercentage = Math.min((currentScore / maxScoreForProgress) * 100, 100);
            progressFill.style.width = `${barPercentage}%`;

            Object.keys(STAR_THRESHOLDS).forEach(starName => {
                if (currentScore >= STAR_THRESHOLDS[starName] && !achievedStars[starName]) {
                    achievedStars[starName] = true;
                    const starNum = starName.replace('star', '');
                    if (starName === 'megastar') SFXManager.play('megastar');
                    else if (starName === 'superstar') SFXManager.play('superstar');
                    else SFXManager.play(`star${starNum}`);
                    
                    const starIndex = STAR_ORDER.indexOf(starName);
                    if (starIndex !== -1) {
                        stars[starIndex]?.classList.remove('unearned');
                        stars[starIndex]?.classList.add('earned');
                    }
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animationStep);
            } else {
                scoreEl.textContent = finalScore.toLocaleString();
                const finalBarPercentage = Math.min((finalScore / maxScoreForProgress) * 100, 100);
                progressFill.style.width = `${finalBarPercentage}%`;
                if (finalScore >= STAR_THRESHOLDS.megastar) card.classList.add('megastar');
                else if (finalScore >= STAR_THRESHOLDS.superstar) card.classList.add('superstar');
                resolve();
            }
        }
        requestAnimationFrame(animationStep);
    });
}
