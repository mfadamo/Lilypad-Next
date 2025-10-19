//src/renderer/modules/screens/hudComponents/playerScoreManager.js

import MSP_LIB from '../../scoring/msp.js';
import WebGLFeedBackParticleSystem from './particles/feedback.js';
import StarManager from './starManager.js';

const G_FORCE = 9.81;
const MAX_SCORE = 13333;
const SENSOR_SMOOTHING_FREQUENCY = 60.0;

const MOVEMENT_DETECTION = {
  STATIONARY_VARIANCE_THRESHOLD: 0.01,
  MIN_TOTAL_ACCEL_CHANGE: 0.5,
  MIN_VALID_SAMPLES: 10,
};

const JUDGMENT_THRESHOLDS = {
  PERFECT: 91,
  SUPER: 80,
  GOOD: 50,
  OK: 15,
};

const PERFECT_STREAK_THRESHOLDS = { HOT: 3, ON_FIRE: 6 };
const PERFECT_STREAK_MULTIPLIERS = { NONE: 1.0, HOT: 1.03, ON_FIRE: 1.08 };

/**
 * Energy calculation exactly from C++:
 * energyAmount = (1.0 - ratio) * (accelNormAvg - 1.0) + ratio * accelDevNormAvg
 * where accelNormAvg and accelDevNormAvg come from maf_EnergyMeansResultsAtMoveEnd
 */
function calculateEnergyAmount(energyMeans, dampingRatio = 0.15) {
  if (!energyMeans || energyMeans.length < 2) return -1.0;
  
  dampingRatio = Math.max(0, Math.min(1, dampingRatio));
  
  let accelNormAvgFromZero = energyMeans[0] - 1.0;
  if (accelNormAvgFromZero < 0.0) {
    accelNormAvgFromZero = 0.0;
  }
  
  return (1.0 - dampingRatio) * accelNormAvgFromZero + dampingRatio * energyMeans[1];
}

/**
 * Energy factor (ratio of actual to expected)
 * Used for validation, not scoring
 */
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
  if (score >= JUDGMENT_THRESHOLDS.PERFECT) return "perfect";
  if (score >= JUDGMENT_THRESHOLDS.SUPER) return "super";
  if (score >= JUDGMENT_THRESHOLDS.GOOD) return "good";
  if (score >= JUDGMENT_THRESHOLDS.OK) return "ok";
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
    this.scoreManagerInstance.Game().Init(-1, -1, -1, -1, SENSOR_SMOOTHING_FREQUENCY);

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
        totalChange += Math.abs(samples[i].accel[j] - samples[i-1].accel[j]);
      }
    }
    totalChange /= G_FORCE;

    const maxVariance = Math.max(...variance);
    const isStationary = (
      maxVariance < MOVEMENT_DETECTION.STATIONARY_VARIANCE_THRESHOLD &&
      totalChange < MOVEMENT_DETECTION.MIN_TOTAL_ACCEL_CHANGE
    );

    return { variance, totalChange, isStationary, maxVariance };
  }

  _preprocessSamples(samples) {
    if (!Array.isArray(samples) || samples.length === 0) {
      return [];
    }
    
    const valid = samples.filter(s =>
      s && 
      typeof s.timestamp === 'number' && 
      isFinite(s.timestamp) &&
      Array.isArray(s.accel) && 
      s.accel.length >= 3 &&
      s.accel.every(v => typeof v === 'number' && isFinite(v))
    );

    if (valid.length < MOVEMENT_DETECTION.MIN_VALID_SAMPLES) return [];

    valid.sort((a, b) => a.timestamp - b.timestamp);

    const unique = [valid[0]];
    for (let i = 1; i < valid.length; i++) {
      const curr = valid[i];
      const prev = unique[unique.length - 1];
      
      const timeSame = Math.abs(curr.timestamp - prev.timestamp) < 0.001;
      const accelSame = curr.accel.every((v, j) => Math.abs(v - prev.accel[j]) < 0.00001);
      
      if (timeSame && accelSame) continue;
      
      unique.push(curr);
    }
    
    return unique;
  }

  /**
   * Helper functions for the scoring model
   */
  _calculateEnergyScore(energyFactor) {
    const idealMin = 0.75;
    const idealMax = 1.25;
    
    if (energyFactor >= idealMin && energyFactor <= idealMax) {
        return 1.0;
    }
    
    if (energyFactor < idealMin) {
        const diff = idealMin - energyFactor;
        const decay = 1.5; 
        return Math.exp(-decay * diff);
    } else {
        const diff = energyFactor - idealMax;
        const decay = 0.5;
        return Math.exp(-decay * diff);
    }
  }

  _calculateDirectionScore(directionTendency) {
    const linearMap = (directionTendency + 1.0) / 2.0;
    return Math.pow(linearMap, 0.7);
  }

  /**
   * Multiplicative model matching Just Dance behavior
   * 
   * The score is multiplicative, not additive:
   * finalScore = baseRatio * energyModifier * directionModifier * shakeModifier
   */
  _applyScoringModel(components, movementStats, classifier, customizationFlags) {
    if (movementStats.isStationary) {
      return 0;
    }

    const baseScore = components.ratioScore;

    const ef = components.energyFactor;
    if (ef < 0.05 || ef > 20.0) {
      return 0;
    }
    const energyScore = this._calculateEnergyScore(ef);

    const ignoreDirection = (customizationFlags & 0x01) !== 0;
    let directionScore = 1.0;
    if (!ignoreDirection && components.directionTendency !== undefined) {
      directionScore = this._calculateDirectionScore(components.directionTendency);
    }

    const ignoreShake = (customizationFlags & 0x02) !== 0;
    let shakeMultiplier = 1.0;
    if (!ignoreShake && components.shakeTime !== undefined && components.shakeTime > 0) {
      shakeMultiplier = 0.7;
    }

    const qualityWeight = 0.4;
    const qualityModifier = energyScore * directionScore;
    
    let finalRatio = (baseScore * (1.0 - qualityWeight)) + (baseScore * qualityModifier * qualityWeight);
    finalRatio *= shakeMultiplier;

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
    
    if (originalSampleCount < MOVEMENT_DETECTION.MIN_VALID_SAMPLES) {
      console.warn(`Too few samples: ${originalSampleCount}`);
      this.postPlayerFeedback(playerIndex, fallbackJudgment, goldMove, 0, coachIdx);
      return fallbackReturn;
    }

    const movementStats = this._calculateMovementStats(samples);
    
    if (movementStats.isStationary) {
      console.warn(
        `STATIONARY DETECTED - Variance: ${movementStats.maxVariance.toFixed(4)}, ` +
        `Change: ${movementStats.totalChange.toFixed(2)}G`
      );
      this.postPlayerFeedback(playerIndex, fallbackJudgment, goldMove, 0, coachIdx);
      return fallbackReturn;
    }

    const cleanedSamples = this._preprocessSamples(samples);

    if (cleanedSamples.length < MOVEMENT_DETECTION.MIN_VALID_SAMPLES) {
      console.warn(
        `Too few samples after cleaning: ${cleanedSamples.length}/${originalSampleCount}`
      );
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
        console.warn(`Failed to start move analysis for ${modelFileName}`);
        return fallbackReturn;
      }

      const t0 = cleanedSamples[0].timestamp;
      const tN = cleanedSamples[cleanedSamples.length - 1].timestamp;
      const moveDurationMs = tN - t0;

      if (moveDurationMs < 100) {
        console.warn(`Move duration too short: ${moveDurationMs}ms`);
        return fallbackReturn;
      }

      // Feed all samples to MSP for analysis
      for (const s of cleanedSamples) {
        const progressRatio = (s.timestamp - t0) / moveDurationMs;
        if (progressRatio >= 0 && progressRatio <= 1.0) {
          gameInterface.UpdateFromProgressRatioAndAccels(
            progressRatio, 
            s.accel[0] / G_FORCE, 
            s.accel[1] / G_FORCE, 
            s.accel[2] / G_FORCE
          );
        }
      }

      gameInterface.StopMoveAnalysis();
      
      // Get ALL data from MSP
      const classifier = mspTools.pstGetMoveClassifierStruct();
      const statisticalDistance = mspTools.fGetLastMoveStatisticalDistance();
      const ratioScore = gameInterface.fGetLastMoveRatioScore(); // 0-1
      
      // Energy data
      const energyMeansResults = mspTools.afGetLastMoveEnergyMeansResults();
      const playerEnergyAmount = gameInterface.fGetLastMoveEnergyAmount(0.15); // Use exact C++ damping
      const classifierEnergyMeans = classifier?.maf_EnergyMeans || [];
      const energyFactor = calculateEnergyFactor(energyMeansResults, classifierEnergyMeans, 0.5);
      
      // Direction data
      let directionTendency = 0;
      const canComputeDirection = gameInterface.bCanComputeDirectionTendency();
      if (canComputeDirection) {
        directionTendency = gameInterface.fGetDirectionTendencyImpactOnScoreRatio();
      }
      
      // Shake detection
      const shakeTime = gameInterface.fGetAutoCorrelationValidationTime(0.05, 0.5);
      
      // Get customization flags from classifier
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

      const rawScore = this._applyScoringModel(components, movementStats, classifier, customizationFlags);
      const judgment = getJudgmentFromScore(rawScore, goldMove);
      
      this.postPlayerFeedback(playerIndex, judgment, goldMove, rawScore, coachIdx);
      
      /* if u want to change the scoring system, uncomment this to debug
      if (document.querySelector('.msp-debug')) {
        this.updateMspDebug(
          rawScore, 
          judgment, 
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
      } */

      return { score: rawScore, judgment, adjustedScore: this.scores[playerIndex] };

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
    if (streakCount >= PERFECT_STREAK_THRESHOLDS.ON_FIRE) {
      return PERFECT_STREAK_MULTIPLIERS.ON_FIRE;
    }
    if (streakCount >= PERFECT_STREAK_THRESHOLDS.HOT) {
      return PERFECT_STREAK_MULTIPLIERS.HOT;
    }
    return PERFECT_STREAK_MULTIPLIERS.NONE;
  }
  
  _calculatePoints(judgment, rawScore, isGoldMove, coachIdx) {
    if (judgment === 'bad' || judgment === 'badgold') return 0;
  
    const moveSetIdx = typeof coachIdx === 'number' ? coachIdx : 0;
    const movesArr = this.songVar[`Moves${moveSetIdx}`] || [];
    const totalMoveValue = movesArr.reduce((count, move) => 
      count + (move && move.goldMove ? 2 : 1), 0) || 1;
    const basePoints = Math.floor(MAX_SCORE / totalMoveValue);
  
    let pts = Math.floor(basePoints * (rawScore / 100));
  
    if (isGoldMove && judgment === 'yeah') {
      pts *= 2;
    }
  
    return pts;
  }

  postPlayerFeedback(playerIndex, judgment, isGoldMove, rawScore, coachIdx) {
    if (playerIndex < 0 || playerIndex >= this.scores.length) {
      console.warn(`Invalid player index: ${playerIndex}`);
      return;
    }

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

    const percentage = Math.min(100, (this.scores[playerIndex] / MAX_SCORE) * 100).toFixed(2) + '%';
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
      console.warn(`Error updating UI feedback animation:`, e);
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