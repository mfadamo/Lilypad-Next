//src/renderer/modules/screens/hudComponents/playerScoreManager.js

import MSP_LIB from '../../scoring/msp.js';
import WebGLFeedBackParticleSystem from './particles/feedback.js';
import StarManager from './starManager.js';

const SCORING_CONFIG = {
  G_FORCE: 9.81,
  MAX_SCORE: 13333,
  SENSOR_SMOOTHING_FREQUENCY: 60.0,

  MOVEMENT: {
    STATIONARY_VARIANCE: 0.001,
    MIN_TOTAL_ACCEL_CHANGE: 0.5,
    MIN_VALID_SAMPLES: 8,
  },

  THRESHOLDS: {
    STAT_DIST_LOW: 1.0,
    STAT_DIST_HIGH: 3.5,
    AUTO_CORRELATION: 0.70,
    DIRECTION_IMPACT: 1.0,
  },

  ENERGY: {
    NO_MOVE_PENALTY_THRESHOLD: 0.16,
    NO_MOVE_PENALTY_MULTIPLIER: 0.25,
    SHAKE_DETECTED_MAX_SCORE: 0.40,
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
  if (isGold) return score >= 70 ? "yeah" : "badgold";
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
      SCORING_CONFIG.THRESHOLDS.STAT_DIST_LOW,
      SCORING_CONFIG.THRESHOLDS.STAT_DIST_HIGH,
      SCORING_CONFIG.THRESHOLDS.AUTO_CORRELATION,
      SCORING_CONFIG.THRESHOLDS.DIRECTION_IMPACT,
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

  _calculateMovementStats(samples) {
    if (samples.length < 3) {
      return { variance: [0, 0, 0], totalChange: 0, isStationary: true };
    }

    const mean = [0, 0, 0];
    for (const s of samples) {
      for (let i = 0; i < 3; i++) {
        mean[i] += s.accel[i];
      }
    }
    for (let i = 0; i < 3; i++) {
      mean[i] /= samples.length;
    }

    const variance = [0, 0, 0];
    for (const s of samples) {
      for (let i = 0; i < 3; i++) {
        const diff = s.accel[i] - mean[i];
        variance[i] += diff * diff;
      }
    }
    for (let i = 0; i < 3; i++) {
      variance[i] /= samples.length;
    }

    let totalChange = 0;
    for (let i = 1; i < samples.length; i++) {
      for (let j = 0; j < 3; j++) {
        totalChange += Math.abs(samples[i].accel[j] - samples[i - 1].accel[j]);
      }
    }
    totalChange /= SCORING_CONFIG.G_FORCE;

    const maxVariance = Math.max(...variance);
    const isStationary = (
      maxVariance < SCORING_CONFIG.MOVEMENT.STATIONARY_VARIANCE &&
      totalChange < SCORING_CONFIG.MOVEMENT.MIN_TOTAL_ACCEL_CHANGE
    );

    return { variance, totalChange, isStationary, maxVariance };
  }

  _preprocessSamples(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return [];

    const valid = samples.filter(s =>
      s &&
      typeof s.timestamp === 'number' && isFinite(s.timestamp) &&
      Array.isArray(s.accel) && s.accel.length >= 3
    );

    if (valid.length < SCORING_CONFIG.MOVEMENT.MIN_VALID_SAMPLES) return [];

    valid.sort((a, b) => a.timestamp - b.timestamp);

    const unique = [valid[0]];
    for (let i = 1; i < valid.length; i++) {
      const curr = valid[i];
      const prev = unique[unique.length - 1];

      const timeDiff = Math.abs(curr.timestamp - prev.timestamp);
      if (timeDiff < 5) continue;

      unique.push(curr);
    }

    return unique;
  }

  _applyScoringModel(components, movementStats, customizationFlags) {
    if (movementStats.isStationary) return 0;

    let finalRatio = components.ratioScore;

    // Energy Floor: Penalty for small movements
    if (components.playerEnergyAmount < SCORING_CONFIG.ENERGY.NO_MOVE_PENALTY_THRESHOLD) {
      finalRatio *= SCORING_CONFIG.ENERGY.NO_MOVE_PENALTY_MULTIPLIER;
    }

    // Shake Penalty
    const ignoreShake = (customizationFlags & 0x02) !== 0;
    if (!ignoreShake && components.shakeTime > 0) {
      finalRatio = Math.min(finalRatio, SCORING_CONFIG.ENERGY.SHAKE_DETECTED_MAX_SCORE);
    }

    // Direction Penalty
    const ignoreDirection = (customizationFlags & 0x01) !== 0;
    if (!ignoreDirection && components.directionTendency !== undefined) {
      if (components.directionTendency < 0) {
        const directionMultiplier = 1.0 + (components.directionTendency * 0.5);
        finalRatio *= Math.max(0.1, directionMultiplier);
      }
    }

    // Sticky Perfect
    if (finalRatio > 0.96) finalRatio = 1.0;

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

    if (originalSampleCount < SCORING_CONFIG.MOVEMENT.MIN_VALID_SAMPLES) {
      this.postPlayerFeedback(playerIndex, fallbackJudgment, goldMove, 0, coachIdx);
      return fallbackReturn;
    }

    const movementStats = this._calculateMovementStats(samples);

    if (movementStats.isStationary) {
      this.postPlayerFeedback(playerIndex, fallbackJudgment, goldMove, 0, coachIdx);
      return fallbackReturn;
    }

    const cleanedSamples = this._preprocessSamples(samples);

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

      const rawScore = this._applyScoringModel(components, movementStats, customizationFlags);

      let finalJudgment = "bad";

      if (goldMove) {
        if (rawScore >= 80 && playerEnergyAmount > SCORING_CONFIG.ENERGY.NO_MOVE_PENALTY_THRESHOLD) {
          finalJudgment = "yeah";
        } else {
          finalJudgment = "badgold";
        }
      } else {
        finalJudgment = getJudgmentFromScore(rawScore, false);
      }

      if (document.querySelector('.msp-debug') && ) {
        this.updateMspDebug(
          rawScore, 
          finalJudgment, 
          components,
          movementStats,
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

  updateMspDebug(finalScore, judgment, components, movementStats, mspTools,
    classifierFileData, originalSampleCount, cleanedSampleCount, moveDurationMs, classifier, customizationFlags) {
    const debugElement = document.querySelector('.msp-debug');
    if (!debugElement) return;

    const fmt = (num, p = 3) => (typeof num === 'number' ? num.toFixed(p) : 'N/A');
    const staticTools = MSP_LIB.ScoreManager.ToolsInterface;

    // Parse customization flags
    const ignoreDirection = (customizationFlags & 0x01) !== 0;
    const ignoreShake = (customizationFlags & 0x02) !== 0;

    // Energy analysis
    const energyRatio = components.energyFactor > 0 ? components.energyFactor : 0;
    const energyStatus = energyRatio < 0.05 ? 'âœ— CRITICAL' :
      energyRatio > 20.0 ? 'âœ— IMPOSSIBLE' :
        energyRatio >= 0.5 && energyRatio <= 1.5 ? 'âœ“ PERFECT' : 'âš  OFF';

    // Classifier info
    const scoringType = components.scoringAlgorithmType > 0 ? 'Naive Bayes' :
      components.scoringAlgorithmType < 0 ? 'Mahalanobis' : 'NONE';
    const measuresCount = Math.abs(components.scoringAlgorithmType);

    // Direction info
    const directionStatus = ignoreDirection ? 'âŠ˜ IGNORED' :
      components.directionTendency > 0.3 ? 'âœ“ RIGHT' :
        components.directionTendency < -0.3 ? 'âœ— WRONG' : 'â†” MIXED';

    // Shake info
    const shakeStatus = ignoreShake ? 'âŠ˜ IGNORED' :
      components.shakeTime > 0 ? `âœ— YES (${fmt(components.shakeTime, 2)}s)` : 'âœ“ NO';

    const scoreColumn = `
=== FINAL SCORE ===
Score: ${fmt(finalScore, 1)}% (${judgment.toUpperCase()})
Ratio: ${fmt(components.ratioScore, 3)} (0-1)
Stat Dist: ${fmt(components.statisticalDistance, 3)}

=== ADJUSTMENTS ===
Direction: ${directionStatus}
  Impact: ${fmt(components.directionTendency, 2)}
Shake: ${shakeStatus}
`;

    const energyColumn = `
=== ENERGY ===
Factor: ${fmt(energyRatio, 2)}x ${energyStatus}
Amount: ${fmt(components.playerEnergyAmount, 3)}
  AccelNormAvg: ${fmt(components.energyMeansResults[0], 3)}
  AccelDevNormAvg: ${fmt(components.energyMeansResults[1], 3)}
Expected:
  AccelNormAvg: ${fmt(components.classifierEnergyMeans[0], 3)}
  AccelDevNormAvg: ${fmt(components.classifierEnergyMeans[1], 3)}
`;

    const classifierColumn = `
=== CLASSIFIER DATA ===
Algorithm: ${scoringType}
Measures: ${measuresCount}
Means: ${classifier?.maf_Means?.length || 0}
Covariances: ${classifier?.maf_InvertedCovariances?.length || 0}
Energy Means: ${classifier?.maf_EnergyMeans?.length || 0}

Flags:
  IgnoreDirection: ${ignoreDirection ? 'YES' : 'NO'}
  IgnoreShake: ${ignoreShake ? 'YES' : 'NO'}
`;

    const dataColumn = `
=== RAW DATA ===
Samples: ${cleanedSampleCount}/${originalSampleCount}
Duration: ${fmt(moveDurationMs / 1000, 2)}s
Rate: ${fmt(cleanedSampleCount / (moveDurationMs / 1000), 1)} Hz
Move: ${staticTools.GetMoveNameFromFileData(classifierFileData)}

Movement:
  Status: ${movementStats.isStationary ? 'âœ— STATIC' : 'âœ“ MOVING'}
  Variance: ${fmt(movementStats.maxVariance, 4)}
  Change: ${fmt(movementStats.totalChange, 2)}G
`;

    const debugHTML = `
<div style="display:flex; flex-direction:row; font-family:monospace; font-size:11px; white-space:pre; color: #fff; background: rgba(0, 0, 0, 0.29); padding: 10px; border-radius: 4px; gap: 20px; line-height: 1.4;">
  <div>${scoreColumn}</div>
  <div>${energyColumn}</div>
  <div>${classifierColumn}</div>
  <div>${dataColumn}</div>
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