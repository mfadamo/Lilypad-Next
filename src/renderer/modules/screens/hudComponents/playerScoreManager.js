//src/renderer/modules/screens/hudComponents/playerScoreManager.js

import MSP_LIB from '../../scoring/msp.js';
import WebGLFeedBackParticleSystem from './particles/feedback.js';
import StarManager from './starManager.js';

const SCORING_CONFIG = {
  ENABLE_DEBUG: true,
  G_FORCE: 9.81,
  MAX_SCORE: 13333,
  SENSOR_SMOOTHING_FREQUENCY: 60.0, 

  MOVEMENT: {
    MIN_VALID_SAMPLES: 8,
  },

  MOVESPACE_PARAMS: {
    default_distance_low_threshold: 1.0,
    default_distance_high_threshold: 3.5,
    default_auto_correlation_theshold: 0.70,
    default_direction_impact_factor: 1.0,
    
    // Thresholds
    no_move_penalty_if_energy_amount_under: 0.16,
    charity_bonus_if_energy_factor_above: 0.50,
    perfect_malus_if_energy_factor_under: 0.30,
    
    // Phone Specifics
    phone_no_move_penalty_if_energy_amount_under: 0.25,
    phone_shake_detected_max_score_ratio: 0.40,
    phone_direction_malus_multiplier: 0.50,
  },

  CONSTANTS: {
    NO_MOVE_PENALTY_MULTIPLIER: 0.1,
    CHARITY_BONUS_ADD: 0.15,
    PERFECT_MALUS_CAP: 0.80,
  },

  JUDGMENTS: {
    PERFECT: 90,
    SUPER: 75,
    GOOD: 45,
    OK: 15,
  },

  STREAKS: {
    THRESHOLDS: { HOT: 3, ON_FIRE: 6 },
    MULTIPLIERS: { NONE: 1.0, HOT: 1.03, ON_FIRE: 1.08 }
  }
};

function calculateEnergyFactor(energyMeansResults, classifierEnergyMeans, dampingRatio = 0.5) {
  if (!energyMeansResults || energyMeansResults.length < 2 ||
    !classifierEnergyMeans || classifierEnergyMeans.length < 2) {
    return -1.0;
  }

  dampingRatio = Math.max(0, Math.min(1, dampingRatio));

  const factor0 = classifierEnergyMeans[0] !== 0
    ? energyMeansResults[0] / classifierEnergyMeans[0]
    : 0;

  const factor1 = classifierEnergyMeans[1] !== 0
    ? energyMeansResults[1] / classifierEnergyMeans[1]
    : 0;

  return (1.0 - dampingRatio) * factor0 + dampingRatio * factor1;
}

const getJudgmentFromScore = (score, isGold) => {
  if (isGold) return score >= 80 ? "yeah" : "badgold";
  if (score >= SCORING_CONFIG.JUDGMENTS.PERFECT) return "perfect";
  if (score >= SCORING_CONFIG.JUDGMENTS.SUPER) return "super";
  if (score >= SCORING_CONFIG.JUDGMENTS.GOOD) return "good";
  if (score >= SCORING_CONFIG.JUDGMENTS.OK) return "ok";
  return "bad";
};

function arrayToBuffer(array) {
  if (array instanceof ArrayBuffer) return array;
  if (!Array.isArray(array)) {
    throw new TypeError("Input must be an array or ArrayBuffer.");
  }
  return new Uint8Array(array).buffer;
}

export default class PlayerScoreManager {
  constructor(songVar) {
    this.songVar = songVar;
    this.starManager = new StarManager(songVar);
    this.songVar.playerScore = this.songVar.playerScore || {};

    this.scoreManagerInstance = new MSP_LIB.ScoreManager();

    this.scoreManagerInstance.Game().Init(
      SCORING_CONFIG.MOVESPACE_PARAMS.default_distance_low_threshold,
      SCORING_CONFIG.MOVESPACE_PARAMS.default_distance_high_threshold,
      SCORING_CONFIG.MOVESPACE_PARAMS.default_auto_correlation_theshold,
      SCORING_CONFIG.MOVESPACE_PARAMS.default_direction_impact_factor,
      SCORING_CONFIG.SENSOR_SMOOTHING_FREQUENCY
    );

    this.modelFiles = this._loadModelFiles(songVar.modelsBuffer);
    this.particleSystems = this._initializeParticleSystems();
    this.scores = Array(6).fill(0);
    this.perfectStreaks = Array(6).fill(0);
  }

  _loadModelFiles(modelsBuffer) {
    const files = {};
    if (!Array.isArray(modelsBuffer)) {
      console.warn("songVar.modelsBuffer is not a valid array or is missing.");
      return files;
    }
    modelsBuffer.forEach(buf => {
      try {
        if (buf && buf.name && buf.arrayBuffer) {
          files[buf.name.toLowerCase()] = arrayToBuffer(buf.arrayBuffer);
        }
      } catch (e) {
        console.warn(`Error processing model buffer for "${buf.name}": ${e.message}`);
      }
    });
    return files;
  }

  _initializeParticleSystems() {
    const systems = [];
    document.querySelectorAll('.particle-canvas').forEach(canvas => {
      try {
        const system = new WebGLFeedBackParticleSystem(canvas);
        systems.push(system);
        system.resizeCanvas();
      } catch (e) {
        console.warn(`Error creating particle system: ${e.message}`);
      }
    });
    return systems;
  }

  // --- CORE FIX: RESAMPLING ---
  // Transforms erratic network packets into a smooth 60Hz signal.
  // This eliminates artificial high energy caused by packet bursts/jitter.
  _resampleSeries(samples, targetFreq = SCORING_CONFIG.SENSOR_SMOOTHING_FREQUENCY) {
    if (samples.length < 2) return [];

    // 1. Sort by time (Network packets can arrive out of order)
    samples.sort((a, b) => a.timestamp - b.timestamp);

    const result = [];
    const step = 1000.0 / targetFreq; // ms per frame (e.g., 16.66ms)
    
    const startTime = samples[0].timestamp;
    const endTime = samples[samples.length - 1].timestamp;

    let currentSampleIdx = 0;

    // 2. Generate perfect timestamps
    for (let t = startTime; t <= endTime; t += step) {
        
        // Find the two raw samples surrounding our target time 't'
        while (currentSampleIdx < samples.length - 1 && samples[currentSampleIdx + 1].timestamp < t) {
            currentSampleIdx++;
        }

        const p0 = samples[currentSampleIdx];
        const p1 = samples[currentSampleIdx + 1];

        // End of data
        if (!p1) break;

        // 3. Linear Interpolation
        // If data is missing for 50ms, this draws a straight line instead of a jump
        const range = p1.timestamp - p0.timestamp;
        const factor = range === 0 ? 0 : (t - p0.timestamp) / range;

        const x = p0.accel[0] + (p1.accel[0] - p0.accel[0]) * factor;
        const y = p0.accel[1] + (p1.accel[1] - p0.accel[1]) * factor;
        const z = p0.accel[2] + (p1.accel[2] - p0.accel[2]) * factor;

        result.push({ timestamp: t, accel: [x, y, z] });
    }

    return result;
  }

  _preprocessSamples(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return [];

    // Filter valid data first
    const valid = samples.filter(s =>
      s &&
      typeof s.timestamp === 'number' && isFinite(s.timestamp) &&
      Array.isArray(s.accel) && s.accel.length >= 3
    );

    if (valid.length < SCORING_CONFIG.MOVEMENT.MIN_VALID_SAMPLES) return [];

    // Apply the Resampler
    const resampled = this._resampleSeries(valid);

    return resampled;
  }

  _applyScoringModel(components, customizationFlags) {
    let finalRatio = components.ratioScore;
    const params = SCORING_CONFIG.MOVESPACE_PARAMS;
    const consts = SCORING_CONFIG.CONSTANTS;

    // 1. Energy Floor
    // Fixes "Perfect" on stationary phones. If Energy < 0.25 (Phone param), score is nuked.
    if (components.playerEnergyAmount < params.phone_no_move_penalty_if_energy_amount_under) {
      finalRatio *= consts.NO_MOVE_PENALTY_MULTIPLIER;
    }

    // 2. Shake Penalty
    const ignoreShake = (customizationFlags & 0x02) !== 0;
    if (!ignoreShake && components.shakeTime > 0) {
      finalRatio = Math.min(finalRatio, params.phone_shake_detected_max_score_ratio);
    }

    // 3. Direction Malus
    const ignoreDirection = (customizationFlags & 0x01) !== 0;
    if (!ignoreDirection && components.directionTendency !== undefined) {
      if (components.directionTendency < 0) {
        const directionFactor = 1.0 + ((components.directionTendency * params.phone_direction_malus_multiplier) * 10);
        finalRatio *= Math.max(0.1, directionFactor);
      }
    }

    // 4. Charity Bonus
    if (components.energyFactor > params.charity_bonus_if_energy_factor_above) {
        if(finalRatio > 0.2 && finalRatio < 0.9) { 
            finalRatio += consts.CHARITY_BONUS_ADD;
        }
    }

    // 5. Perfect Malus (Lazy Move Prevention)
    if (finalRatio > consts.PERFECT_MALUS_CAP && components.energyFactor < params.perfect_malus_if_energy_factor_under) {
        finalRatio = consts.PERFECT_MALUS_CAP; 
    }

    if (finalRatio > 0.97) finalRatio = 1.0;

    return Math.max(0, Math.min(1, finalRatio)) * 100;
  }

  async scoreMove(playerIndex, modelFileName, samples, goldMove, coachIdx, duration) {
    const fallbackJudgment = goldMove ? 'badgold' : 'bad';
    const fallbackReturn = {
      score: 0,
      judgment: fallbackJudgment,
      adjustedScore: this.scores[playerIndex] || 0
    };

    const originalSampleCount = Array.isArray(samples) ? samples.length : 0;
    
    // Process: Validate -> Resample (Fix Jitter) -> Clean
    const cleanedSamples = this._preprocessSamples(samples);

    // Ensure we have enough data AFTER resampling (approx 130ms at 60Hz)
    if (cleanedSamples.length < SCORING_CONFIG.MOVEMENT.MIN_VALID_SAMPLES) {
      this.postPlayerFeedback(playerIndex, fallbackJudgment, goldMove, 0, coachIdx);
      return fallbackReturn;
    }

    const modelKey = modelFileName.toLowerCase();
    const classifierFileData = this.modelFiles[modelKey];
    if (!classifierFileData) {
      console.warn(`Model file "${modelFileName}" not found.`);
      return fallbackReturn;
    }

    try {
      const gameInterface = this.scoreManagerInstance.Game();
      const mspTools = this.scoreManagerInstance.Tools();
      const gameMoveDurationSec = duration / 1000.0;

      if (!gameInterface.bStartMoveAnalysis(classifierFileData, gameMoveDurationSec)) {
        return fallbackReturn;
      }

      const t0 = cleanedSamples[0].timestamp;
      const tN = cleanedSamples[cleanedSamples.length - 1].timestamp;
      const moveDurationMs = tN - t0;

      if (moveDurationMs < 100) {
        gameInterface.StopMoveAnalysis();
        return fallbackReturn;
      }

      for (const s of cleanedSamples) {
        const progressRatio = (s.timestamp - t0) / moveDurationMs;
        const clampedRatio = Math.max(0, Math.min(1, progressRatio));

        gameInterface.UpdateFromProgressRatioAndAccels(
          clampedRatio,
          s.accel[0] / SCORING_CONFIG.G_FORCE,
          s.accel[1] / SCORING_CONFIG.G_FORCE,
          s.accel[2] / SCORING_CONFIG.G_FORCE
        );
      }

      gameInterface.StopMoveAnalysis();

      const classifier = mspTools.pstGetMoveClassifierStruct();
      const statisticalDistance = mspTools.fGetLastMoveStatisticalDistance();
      const ratioScore = gameInterface.fGetLastMoveRatioScore();

      const energyMeansResults = mspTools.afGetLastMoveEnergyMeansResults();
      const playerEnergyAmount = gameInterface.fGetLastMoveEnergyAmount(0.15);
      const classifierEnergyMeans = classifier?.maf_EnergyMeans || [];
      const energyFactor = calculateEnergyFactor(energyMeansResults, classifierEnergyMeans, 0.5);

      let directionTendency = 0;
      if (gameInterface.bCanComputeDirectionTendency()) {
        directionTendency = gameInterface.fGetDirectionTendencyImpactOnScoreRatio();
      }

      const shakeTime = gameInterface.fGetAutoCorrelationValidationTime(0.05, 0.5);

      const customizationFlags = mspTools.ulGetMoveCustomizationFlagsFromFileData
        ? mspTools.ulGetMoveCustomizationFlagsFromFileData(classifierFileData)
        : 0;

      const components = {
        ratioScore,
        statisticalDistance,
        directionTendency,
        shakeTime,
        playerEnergyAmount,
        energyFactor,
        energyMeansResults,
        classifierEnergyMeans,
        scoringAlgorithmType: classifier?.ml_ScoringAlgorithmType || 0,
      };

      const rawScore = this._applyScoringModel(components, customizationFlags);

      let finalJudgment = "bad";

      if (goldMove) {
        // Gold Moves: Require accuracy AND minimum energy
        if (rawScore >= 70 && playerEnergyAmount > SCORING_CONFIG.MOVESPACE_PARAMS.phone_no_move_penalty_if_energy_amount_under) {
          finalJudgment = "yeah";
        } else {
          finalJudgment = "badgold";
        }
      } else {
        finalJudgment = getJudgmentFromScore(rawScore, false);
      }

      if (SCORING_CONFIG.ENABLE_DEBUG && document.querySelector('.msp-debug')) {
        this.updateMspDebug(
          rawScore,
          finalJudgment,
          components,
          mspTools,
          classifierFileData,
          originalSampleCount,
          cleanedSamples.length,
          moveDurationMs,
          classifier,
          customizationFlags
        );
      }

      this.postPlayerFeedback(playerIndex, finalJudgment, goldMove, rawScore, coachIdx);

      return { score: rawScore, judgment: finalJudgment, adjustedScore: this.scores[playerIndex] };

    } catch (error) {
      console.error(`Error in scoreMove for "${modelFileName}":`, error);
      this.postPlayerFeedback(playerIndex, fallbackJudgment, goldMove, 0, coachIdx);
      return fallbackReturn;
    }
  }

  _updateStreaksAndGetMultiplier(playerIndex, judgment) {
    if (['perfect', 'yeah'].includes(judgment)) {
      this.perfectStreaks[playerIndex]++;
    } else {
      this.perfectStreaks[playerIndex] = 0;
    }

    const streakCount = this.perfectStreaks[playerIndex];
    if (streakCount >= SCORING_CONFIG.STREAKS.THRESHOLDS.ON_FIRE) {
      return SCORING_CONFIG.STREAKS.MULTIPLIERS.ON_FIRE;
    }
    if (streakCount >= SCORING_CONFIG.STREAKS.THRESHOLDS.HOT) {
      return SCORING_CONFIG.STREAKS.MULTIPLIERS.HOT;
    }
    return SCORING_CONFIG.STREAKS.MULTIPLIERS.NONE;
  }

  _calculatePoints(judgment, rawScore, isGoldMove, coachIdx) {
    if (judgment === 'bad' || judgment === 'badgold') return 0;

    const moveSetIdx = typeof coachIdx === 'number' ? coachIdx : 0;
    const movesArr = this.songVar[`Moves${moveSetIdx}`] || [];
    const totalMoveValue = movesArr.reduce((count, move) =>
      count + (move && move.goldMove ? 2 : 1), 0) || 1;

    const basePoints = Math.floor(SCORING_CONFIG.MAX_SCORE / totalMoveValue);

    let pts = Math.floor(basePoints * (rawScore / 100));

    if (isGoldMove && judgment === 'yeah') {
      pts = basePoints * 2;
    }

    return pts;
  }

  postPlayerFeedback(playerIndex, judgment, isGoldMove, rawScore, coachIdx) {
    if (playerIndex < 0 || playerIndex >= this.scores.length) return;

    try {
      const points = this._calculatePoints(judgment, rawScore, isGoldMove, coachIdx);
      const streakMultiplier = this._updateStreaksAndGetMultiplier(playerIndex, judgment);
      const finalPoints = Math.floor(points * streakMultiplier);

      this.scores[playerIndex] = Math.max(0, this.scores[playerIndex] + finalPoints);

      this._updateUi(playerIndex);
      this._triggerParticleEffects(playerIndex, judgment);
      this._triggerFeedbackAnimation(playerIndex, judgment);

    } catch (error) {
      console.error(`Error in postPlayerFeedback:`, error);
    }
  }

  _updateUi(playerIndex) {
    const key = `player${playerIndex + 1}`;
    this.songVar.playerScore[key] = this.scores[playerIndex];

    const percentage = Math.min(100, (this.scores[playerIndex] / SCORING_CONFIG.MAX_SCORE) * 100).toFixed(2) + '%';
    const scoreBar = document.querySelector(`.raceline-bar.${key}`);
    if (scoreBar) scoreBar.style.setProperty('--progress', percentage);

    this.starManager?.update();
  }

  _triggerParticleEffects(playerIndex, judgment) {
    const system = this.particleSystems[playerIndex];
    if (!system || typeof system.explode !== 'function') return;

    try {
      const effects = {
        'perfect': [
          { type: 'perfect', shape: 'star', count: 12, scale: 8, duration: 1000, distancePercent: 65 },
          { type: 'perfect', shape: 'circle', count: 22, scale: 4, duration: 900, distancePercent: 50 }
        ],
        'super': [
          { type: 'super', shape: 'star', count: 10, scale: 5, duration: 900, distancePercent: 40 },
          { type: 'super', shape: 'circle', count: 20, scale: 3, duration: 800, distancePercent: 30 }
        ],
        'good': [
          { type: 'good', shape: 'circle', count: 25, scale: 7, duration: 1200, distancePercent: 30, direction: 'both' },
          { type: 'good', shape: 'ring', count: 3, scale: 6, duration: 1000, distancePercent: 30 }
        ],
        'yeah': [
          { type: 'yeah', shape: 'star', count: 20, scale: 9, duration: 1200, distancePercent: 90 },
          { type: 'yeah', shape: 'circle', count: 30, scale: 5, duration: 1100, distancePercent: 80 }
        ],
      };

      if (effects[judgment]) {
        effects[judgment].forEach(effect => system.explode(effect));
      }
    } catch (e) {
      console.warn(`Error triggering particle effects:`, e);
    }
  }

  _triggerFeedbackAnimation(playerIndex, judgment) {
    try {
      const playerEl = document.querySelector(`#players .player${playerIndex + 1}`);
      const feedbackEl = playerEl?.querySelector(`.feedback-${judgment}`);
      if (feedbackEl) {
        feedbackEl.classList.remove('animate');
        void feedbackEl.offsetWidth;
        feedbackEl.classList.add('animate');
      }
    } catch (e) {
      // safe ignore
    }
  }

  updateMspDebug(finalScore, judgment, components, mspTools,
    classifierFileData, originalSampleCount, cleanedSampleCount, moveDurationMs, classifier, customizationFlags) {
    const debugElement = document.querySelector('.msp-debug');
    if (!debugElement) return;

    const fmt = (num, p = 3) => (typeof num === 'number' ? num.toFixed(p) : 'N/A');
    const staticTools = MSP_LIB.ScoreManager.ToolsInterface;
    const params = SCORING_CONFIG.MOVESPACE_PARAMS;
    const consts = SCORING_CONFIG.CONSTANTS;

    const ignoreDirection = (customizationFlags & 0x01) !== 0;
    const ignoreShake = (customizationFlags & 0x02) !== 0;

    // --- RECONSTRUCT CALCULATION STEPS ---
    let calcLog = `Base: ${fmt(components.ratioScore, 4)}\n`;
    let tempScore = components.ratioScore;

    // 1. Energy Floor
    if (components.playerEnergyAmount < params.phone_no_move_penalty_if_energy_amount_under) {
        calcLog += `[!] Low Energy: * ${consts.NO_MOVE_PENALTY_MULTIPLIER}\n`;
        tempScore *= consts.NO_MOVE_PENALTY_MULTIPLIER;
    } else {
        calcLog += `[OK] Energy Floor Passed\n`;
    }

    // 2. Shake
    if (!ignoreShake && components.shakeTime > 0) {
        calcLog += `[!] Shake (${fmt(components.shakeTime, 2)}s): Cap ${params.phone_shake_detected_max_score_ratio}\n`;
        tempScore = Math.min(tempScore, params.phone_shake_detected_max_score_ratio);
    }

    // 3. Direction
    if (!ignoreDirection && components.directionTendency !== undefined) {
        if (components.directionTendency < 0) {
            const factor = 1.0 + ((components.directionTendency * params.phone_direction_malus_multiplier) * 10);
            calcLog += `[!] Wrong Dir (${fmt(components.directionTendency, 2)}): * ${fmt(factor, 2)}\n`;
            tempScore *= Math.max(0.1, factor);
        } else {
            calcLog += `[OK] Direction (${fmt(components.directionTendency, 2)})\n`;
        }
    } else {
        calcLog += `[--] Direction Ignored\n`;
    }

    // 4. Charity
    if (components.energyFactor > params.charity_bonus_if_energy_factor_above) {
        if(tempScore > 0.2 && tempScore < 0.9) {
            calcLog += `[+] Charity Bonus: + ${consts.CHARITY_BONUS_ADD}\n`;
            tempScore += consts.CHARITY_BONUS_ADD;
        } else {
            calcLog += `[--] Charity: Score out of range\n`;
        }
    } else {
        calcLog += `[--] Charity: Low Factor (${fmt(components.energyFactor, 2)})\n`;
    }

    // 5. Perfect Malus
    if (tempScore > consts.PERFECT_MALUS_CAP && components.energyFactor < params.perfect_malus_if_energy_factor_under) {
        calcLog += `[!] Perf Malus: Cap ${consts.PERFECT_MALUS_CAP}\n`;
        tempScore = consts.PERFECT_MALUS_CAP;
    }

    calcLog += `Final: ${fmt(tempScore, 4)}`;

    const scoreColumn = `
=== RESULT ===
Score: ${fmt(finalScore, 1)}% (${judgment.toUpperCase()})
Raw Ratio: ${fmt(components.ratioScore, 4)}
Stat Dist: ${fmt(components.statisticalDistance, 3)}
`;

    const calcColumn = `
=== CALCULATION ===
${calcLog}
`;

    const energyColumn = `
=== ENERGY ===
Amount: ${fmt(components.playerEnergyAmount, 3)}
  (Min: ${params.phone_no_move_penalty_if_energy_amount_under})

Factor: ${fmt(components.energyFactor, 3)}x
  (Charity > ${params.charity_bonus_if_energy_factor_above})
  (Malus < ${params.perfect_malus_if_energy_factor_under})

Means (User / Model):
  Norm: ${fmt(components.energyMeansResults[0], 2)} / ${fmt(components.classifierEnergyMeans[0], 2)}
  Dev:  ${fmt(components.energyMeansResults[1], 2)} / ${fmt(components.classifierEnergyMeans[1], 2)}
`;

    const classifierColumn = `
=== CLASSIFIER / DATA ===
Move: ${staticTools.GetMoveNameFromFileData(classifierFileData)}
Type: ${components.scoringAlgorithmType > 0 ? 'Naive Bayes' : 'Mahalanobis'}
Dims: ${Math.abs(components.scoringAlgorithmType)}

Samples: ${cleanedSampleCount}/${originalSampleCount}
Rate: ${fmt(cleanedSampleCount / (moveDurationMs / 1000), 1)} Hz
Time: ${fmt(moveDurationMs / 1000, 2)}s

Flags:
  Dir: ${ignoreDirection ? 'IGNORED' : 'ACTIVE'}
  Shake: ${ignoreShake ? 'IGNORED' : 'ACTIVE'}
`;

    const debugHTML = `
<div style="display:flex; flex-direction:row; font-family:monospace; font-size:11px; white-space:pre; color: #fff; background: rgba(0, 0, 0, 0.29); padding: 10px; border-radius: 4px; gap: 20px; line-height: 1.4;">
  <div>${scoreColumn}</div>
  <div>${calcColumn}</div>
  <div>${energyColumn}</div>
  <div>${classifierColumn}</div>
</div>`;

    debugElement.innerHTML = debugHTML;
  }

  destroy() {
    try {
      this.particleSystems.forEach(system => system?.destroy());
      this.particleSystems = [];
    } catch (error) {
      console.error(`Error in PlayerScoreManager destroy:`, error);
    }
  }
}