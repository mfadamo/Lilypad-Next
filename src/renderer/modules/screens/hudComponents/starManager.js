// modules/hudComponents/starManager.js

import { SFXManager } from '../../audio/sfx.js';


// Star score thresholds
const STAR_THRESHOLDS = {
    star1: 2000,
    star2: 4000,
    star3: 6000,
    star4: 8000,
    star5: 10000,
    superstar: 11000,
    megastar: 12000
};

/**
 * Manages the star display and animation for players and racetrack
 */
export default class StarManager {
    constructor(songVar) {
        this.songVar = songVar;

        // Track which stars have been achieved by which players
        this.playerStars = {};

        this.highestPlayer = null;
        this.highestScore = 0;

        this.racetrackStars = {
            star1: false,
            star2: false,
            star3: false,
            star4: false,
            star5: false,
            superstar: false,
            megastar: false
        };

        // Initialize the stars
        this.initializeStars();
    }

    /**
     * Set up initial state of all stars
     */
    initializeStars() {
        // Set all player stars as hidden
        document.querySelectorAll('#players .hud-stars .star').forEach(star => {
            star.classList.add('hidden');
        });

        // Set all racetrack stars as hidden, except the first one which is pre-glow
        document.querySelectorAll('#racetrack .hud-stars .star').forEach((star, index) => {
            if (index === 0) {
                star.classList.add('pre-glow');
            } else {
                star.classList.add('hidden');
            }
        });
    }

    /**
     * Update the star display based on current scores
     */
    update() {
        // Get the current scores from songVar
        const scores = this.songVar.playerScore || {};

        // Find the highest scoring player
        let highestPlayer = null;
        let highestScore = 0;

        Object.keys(scores).forEach(player => {
            const score = scores[player];
            if (score > highestScore) {
                highestScore = score;
                highestPlayer = player;
            }
        });

        // If highest player has changed, update the racetrack stars
        if (highestScore > this.highestScore) {
            this.highestScore = highestScore;
            this.highestPlayer = highestPlayer;
            this.updateRacetrackStars(highestScore);
        }

        // Update each player's stars
        Object.keys(scores).forEach(player => {
            const score = scores[player];
            const playerIndex = parseInt(player.replace('player', '')) - 1;
            this.updatePlayerStars(playerIndex, score);
        });
    }

    /**
     * Update racetrack stars based on highest score
     */
    updateRacetrackStars(score) {
        // Check each star threshold
        Object.keys(STAR_THRESHOLDS).forEach(starName => {
            const threshold = STAR_THRESHOLDS[starName];

            // If score is above threshold and star hasn't been activated yet
            if (score >= threshold && !this.racetrackStars[starName]) {
                this.activateRacetrackStar(starName);
            }
        });
    }

    /**
     * Activate a star on the racetrack with animation
     * SFX functionality moved to player star activation
     */
    activateRacetrackStar(starName) {
        this.racetrackStars[starName] = true;

        if (starName === 'megastar' || starName === "superstar") {
            const stars = document.querySelector(`#racetrack .hud-stars`);
            stars.classList.remove("megastar", "superstar")
            stars.classList.add(starName)
        } else {
            const starElement = document.querySelector(`#racetrack .hud-stars .${starName}`);
            if (!starElement) return;

            starElement.classList.remove('pre-glow', 'hidden');

            starElement.classList.add('no-beat');
            starElement.style.animation = 'newStar 1.1s forwards';

            setTimeout(() => {
                starElement.style.animation = '';
                starElement.classList.remove('no-beat');

                this.setNextStarPreGlow(starName);
            }, 1100); 

        }
    }

    /**
     * Set the next star in sequence to pre-glow state
     */
    setNextStarPreGlow(currentStar) {
        const starOrder = ['star1', 'star2', 'star3', 'star4', 'star5'];
        const currentIndex = starOrder.indexOf(currentStar);

        // If not the last star
        if (currentIndex < starOrder.length - 1) {
            const nextStarName = starOrder[currentIndex + 1];
            const nextStar = document.querySelector(`#racetrack .hud-stars .${nextStarName}`);

            if (nextStar) {
                nextStar.classList.remove('hidden');
                nextStar.classList.add('pre-glow');
            }
        }
    }

    /**
     * Update an individual player's stars based on their score
     */
    updatePlayerStars(playerIndex, score) {
        const playerKey = `player${playerIndex + 1}`;

        if (!this.playerStars[playerKey]) {
            this.playerStars[playerKey] = {
                star1: false,
                star2: false,
                star3: false,
                star4: false,
                star5: false,
                superstar: false,
                megastar: false
            };
        }

        Object.keys(STAR_THRESHOLDS).forEach(starName => {
            const threshold = STAR_THRESHOLDS[starName];

            if (score >= threshold && !this.playerStars[playerKey][starName]) {
                this.activatePlayerStar(playerIndex, starName);
            }
        });

        const playerContainer = document.querySelector(`#players .player${playerIndex + 1}`);
        if (playerContainer) {
            const starsContainer = playerContainer.querySelector('.hud-stars');
            if (starsContainer) {
                if (score >= STAR_THRESHOLDS.superstar) {
                    starsContainer.classList.add('superstar');
                }
                if (score >= STAR_THRESHOLDS.megastar) {
                    starsContainer.classList.add('megastar');
                }
            }
        }
    }

    /**
     * Activate a star for a specific player with sound effects
     */
    activatePlayerStar(playerIndex, starName) {
        const playerKey = `player${playerIndex + 1}`;

        this.playerStars[playerKey][starName] = true;

        const starElement = document.querySelector(`#players .player${playerIndex + 1} .hud-stars .${starName}`);
        if (!starElement) return;

        starElement.classList.remove('hidden');

        if (SFXManager) {
            if (starName === 'megastar') {
                SFXManager.play('megastar');
            } else if (starName === 'superstar') {
                SFXManager.play('superstar');
            } else {
                const starNumber = starName.replace('star', '');
                setTimeout(() => {
                    SFXManager.play(`star${starNumber}`);
                }, 1000);

                SFXManager.play('obtainStar');
            }
        }

        if (starName === 'superstar' || starName === 'megastar') {
            SFXManager.play(starName);
            const starsContainer = document.querySelector(`#players .player${playerIndex + 1} .hud-stars`);
            if (starsContainer) {
                starsContainer.classList.add(starName);
            }
        }
    }

    /**
     * Clean up resources when the star manager is no longer needed
     */
    destroy() {
        // Remove any event listeners or timers if needed
    }
}