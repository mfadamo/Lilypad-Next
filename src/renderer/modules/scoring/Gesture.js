/**
 * @file Gesture.js
 * @description A JavaScript implementation of the Gesture motion analysis system (Kinect).
 * 
 * This library provides tools for deserializing .gesture model files and scoring
 * movement patterns based on skeleton data.
 * 
 * Original implementations:
 * - JD2021_MAIN: Ubisoft (tyy kezo.dev) for C code.
 * - Refactored by Ibratabian17, Partial implementation in JavaScript.
 */

/**
 * @namespace Gesture
 * @description Main namespace for gesture recognition functionality
 */
const Gesture = {};

/**
 * @namespace Gesture.Utils
 * @description Utility functions for gesture recognition
 */
Gesture.Utils = {};

/**
 * @namespace Gesture.Utils.BinaryReader
 * @description Utilities for reading binary data with proper endianness handling
 */
Gesture.Utils.BinaryReader = {
  /**
   * Read a null-terminated ASCII string from buffer
   * @param {ArrayBuffer} buffer - Source buffer
   * @param {number} length - Maximum string length to read
   * @returns {string} - Decoded string
   */
  readString(buffer, length) {
    const bytes = new Uint8Array(buffer, 0, length);
    return new TextDecoder().decode(bytes).split("\0")[0];
  },

  /**
   * Read a 32-bit float from buffer at given offset
   * @param {ArrayBuffer} buffer - Source buffer
   * @param {number} offset - Byte offset to read from
   * @param {boolean} littleEndian - Whether to use little endian byte order
   * @returns {number} - The float value
   */
  readFloat32(buffer, offset, littleEndian = true) {
    return new DataView(buffer, offset, 4).getFloat32(0, littleEndian);
  },

  /**
   * Read a 32-bit unsigned integer from buffer at given offset
   * @param {ArrayBuffer} buffer - Source buffer
   * @param {number} offset - Byte offset to read from
   * @param {boolean} littleEndian - Whether to use little endian byte order
   * @returns {number} - The integer value
   */
  readUint32(buffer, offset, littleEndian = true) {
    return new DataView(buffer, offset, 4).getUint32(0, littleEndian);
  }
};

/**
 * @namespace Gesture.Core
 * @description Core components for gesture recognition
 */
Gesture.Core = {};

/**
 * @class
 * @memberof Gesture.Core
 * @description Single weak classifier from AdaBoost ensemble
 */
Gesture.Core.DecisionStump = class DecisionStump {
  /**
   * Create a new decision stump
   * @param {number} weight - The weight of this stump (alpha in AdaBoost)
   * @param {number} featureIndex - Which feature to test
   * @param {number} threshold - Decision boundary threshold
   */
  constructor(weight, featureIndex, threshold) {
    /**
     * The weight of this stump (alpha in AdaBoost)
     * @type {number}
     */
    this.weight = weight;
    
    /**
     * Index of the feature to test
     * @type {number}
     */
    this.featureIndex = featureIndex;
    
    /**
     * Decision boundary threshold
     * @type {number}
     */
    this.threshold = threshold;
  }

  /**
   * Evaluate this stump on a feature vector
   * @param {number[]} features - Feature vector to evaluate
   * @returns {number} - Weighted vote (+/- weight)
   */
  evaluate(features) {
    const featureValue = features[this.featureIndex] || 0;
    const vote = featureValue > this.threshold ? 1 : -1;
    return this.weight * vote;
  }
};

/**
 * @class Model
 * @memberof Gesture
 * @description Represents a trained gesture recognition model
 */
Gesture.Model = class Model {
  /**
   * Create a new model instance
   * @param {ArrayBuffer} buffer - Binary buffer containing model data
   */
  constructor(buffer) {
    /**
     * Array of decision stumps comprising the model
     * @type {Gesture.Core.DecisionStump[]}
     */
    this.stumps = [];
    
    /**
     * Model metadata from the binary file
     * @type {Object}
     * @property {string} name - Model name
     * @property {number} version - Model version
     * @property {number} stumpCount - Number of decision stumps
     * @property {number} featureCount - Number of features
     */
    this.modelInfo = this.loadFromBuffer(buffer);
    
    /**
     * Model name for identification
     * @type {string}
     */
    this.modelName = this.modelInfo.name;
  }

  /**
   * Load model data from binary buffer
   * @param {ArrayBuffer} buffer - Raw model data
   * @returns {Object} - Model metadata
   */
  loadFromBuffer(buffer) {
    // Parse header (model name)
    const name = Gesture.Utils.BinaryReader.readString(buffer, 64);
    let offset = 64 + (64 % 4);
    
    // Detect version and endianness
    const versionLE = Gesture.Utils.BinaryReader.readFloat32(buffer, offset, true);
    const versionBE = Gesture.Utils.BinaryReader.readFloat32(buffer, offset, false);
    const version = Math.abs(versionLE - 1.3) < Math.abs(versionBE - 1.3) ? versionLE : versionBE;
    offset += 4;
    
    // Read counts
    const stumpCount = Gesture.Utils.BinaryReader.readUint32(buffer, offset, true);
    offset += 4;
    const featureCount = Gesture.Utils.BinaryReader.readUint32(buffer, offset, true);
    offset += 4;
    
    // Read each decision stump
    for (let i = 0; i < stumpCount; i++) {
      const weight = Gesture.Utils.BinaryReader.readFloat32(buffer, offset, true);
      const featureIndex = Gesture.Utils.BinaryReader.readUint32(buffer, offset + 4, true);
      const threshold = Gesture.Utils.BinaryReader.readFloat32(buffer, offset + 8, true);
      this.stumps.push(new Gesture.Core.DecisionStump(weight, featureIndex, threshold));
      offset += 12;
    }
    
    return { name, version, stumpCount, featureCount };
  }

  /**
   * Classify a feature vector using the model
   * @param {number[]} features - Feature vector to classify
   * @returns {number} - Raw classification score
   */
  classify(features) {
    let voteSum = 0;
    for (const stump of this.stumps) {
      voteSum += stump.evaluate(features);
    }
    return voteSum;
  }
};

/**
 * @namespace Gesture.Features
 * @description Feature extraction for skeleton motion data
 */
Gesture.Features = {};

/**
 * @class FeatureExtractor
 * @memberof Gesture.Features
 * @description Extracts motion features from skeleton frames
 */
Gesture.Features.FeatureExtractor = class FeatureExtractor {
  /**
   * Create a new feature extractor
   * @param {Array} frames - Array of skeleton frames
   * @param {Object} options - Configuration options
   * @param {number} [options.frameRate=30] - Frame rate of the skeleton data
   */
  constructor(frames, options = {}) {
    /**
     * Array of skeleton frames to analyze
     * @type {Array}
     */
    this.frames = frames;
    
    /**
     * Frame rate in frames per second
     * @type {number}
     */
    this.frameRate = options.frameRate || 30;
  }

  /**
   * Calculate angle between two vectors
   * @param {number[]} v1 - First 3D vector
   * @param {number[]} v2 - Second 3D vector
   * @returns {number} - Angle in radians
   */
  static calculateAngle(v1, v2) {
    const dotProduct = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
    const magnitude1 = Math.hypot(...v1);
    const magnitude2 = Math.hypot(...v2);
    
    if (!magnitude1 || !magnitude2) return 0;
    
    const cosine = dotProduct / (magnitude1 * magnitude2);
    return Math.acos(Math.min(1, Math.max(-1, cosine)));
  }

  /**
   * Calculate motion energy across frames
   * @returns {number} - Total motion energy
   */
  calculateMotionEnergy() {
    let totalEnergy = 0;
    
    for (let i = 1; i < this.frames.length; i++) {
      const prevFrame = this.frames[i-1];
      const currFrame = this.frames[i];
      
      for (const jointId in currFrame) {
        const dx = currFrame[jointId][0] - prevFrame[jointId][0];
        const dy = currFrame[jointId][1] - prevFrame[jointId][1];
        const dz = currFrame[jointId][2] - prevFrame[jointId][2];
        totalEnergy += Math.hypot(dx, dy, dz);
      }
    }
    
    return (totalEnergy / this.frames.length) * this.frameRate;
  }

  /**
   * Extract all motion features from frames
   * @returns {number[]} - Feature vector
   */
  extractFeatures() {
    const features = [];
    
    // 1. Joint angle features
    const jointTriplets = [
      ['SpineBase', 'SpineMid', 'Neck'],
      ['ShoulderLeft', 'ElbowLeft', 'WristLeft'],
      ['ShoulderRight', 'ElbowRight', 'WristRight']
    ];
    
    for (const [joint1, joint2, joint3] of jointTriplets) {
      const angles = this.frames.map(frame => {
        const vector1 = [
          frame[joint1][0] - frame[joint2][0],
          frame[joint1][1] - frame[joint2][1],
          frame[joint1][2] - frame[joint2][2]
        ];
        
        const vector2 = [
          frame[joint3][0] - frame[joint2][0],
          frame[joint3][1] - frame[joint2][1],
          frame[joint3][2] - frame[joint2][2]
        ];
        
        return FeatureExtractor.calculateAngle(vector1, vector2);
      });
      
      features.push(angles.reduce((sum, angle) => sum + angle, 0) / angles.length);
    }
    
    // 2. Hand velocity features
    for (const hand of ['HandLeft', 'HandRight']) {
      let velocitySum = 0;
      
      for (let i = 1; i < this.frames.length; i++) {
        const displacement = [
          this.frames[i][hand][0] - this.frames[i-1][hand][0],
          this.frames[i][hand][1] - this.frames[i-1][hand][1],
          this.frames[i][hand][2] - this.frames[i-1][hand][2]
        ];
        
        velocitySum += Math.hypot(...displacement);
      }
      
      features.push((velocitySum / this.frames.length) * this.frameRate);
    }
    
    // 3. Overall motion energy
    features.push(this.calculateMotionEnergy());
    
    return features;
  }
};

/**
 * @namespace Gesture.Analysis
 * @description Analysis components for gesture detection
 */
Gesture.Analysis = {};

/**
 * @class Analyzer
 * @memberof Gesture.Analysis
 * @description Main class for analyzing skeleton data with gesture models
 */
Gesture.Analysis.Analyzer = class Analyzer {
  /**
   * Create a new gesture analyzer
   * @param {Gesture.Model[]} models - Array of gesture models
   * @param {Object} options - Configuration options
   * @param {number} [options.frameRate=30] - Frame rate of the skeleton data
   * @param {number} [options.windowSize=16] - Number of frames to analyze at once
   * @param {number} [options.scoreScale=100] - Scale factor for final scores
   * @param {number} [options.confidenceThreshold=0.5] - Threshold for gesture detection
   * @param {number} [options.filterWindowSize=3] - Window size for temporal filtering
   */
  constructor(models = [], options = {}) {
    /**
     * Map of models indexed by name
     * @type {Map<string, Gesture.Model>}
     */
    this.models = new Map();
    models.forEach(model => this.models.set(model.modelName, model));
    
    /**
     * Configuration options
     * @type {Object}
     */
    this.options = {
      frameRate: 30,
      windowSize: 16,
      scoreScale: 100,
      confidenceThreshold: 0.5,
      filterWindowSize: 3,
      ...options
    };
    
    /**
     * Array of skeleton frames to analyze
     * @type {Array}
     */
    this.samples = [];
  }

  /**
   * Add skeleton data samples
   * @param {Array} samples - Array of skeleton frames
   */
  addSamples(samples) {
    this.samples = samples;
  }

  /**
   * Apply temporal filtering to smooth scores
   * @param {number[]} scores - Raw scores to filter
   * @param {number} windowSize - Filter window size
   * @returns {number[]} - Filtered scores
   */
  filterScores(scores, windowSize = this.options.filterWindowSize) {
    const filtered = [];
    
    for (let i = 0; i < scores.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize/2));
      const end = Math.min(scores.length, i + Math.floor(windowSize/2) + 1);
      const windowScores = scores.slice(start, end);
      const average = windowScores.reduce((sum, score) => sum + score, 0) / windowScores.length;
      filtered.push(average);
    }
    
    return filtered;
  }

  /**
   * Analyze a segment of skeleton data for a specific gesture
   * @param {string} modelName - Name of the model to use
   * @param {number} startTime - Start time in milliseconds
   * @param {Object} options - Analysis options
   * @returns {Object} - Analysis results with score and component breakdown
   * @throws {Error} If the specified model isn't found
   */
  analyzeSkeleton(modelName, startTime = 0, options = {}) {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model "${modelName}" not found`);
    }
    
    // Extract relevant frames from samples
    // For simplicity, we're assuming startTime is frame index
    const startIndex = Math.floor(startTime / (1000 / this.options.frameRate)) || 0;
    const endIndex = Math.min(startIndex + this.options.windowSize, this.samples.length);
    const frames = this.samples.slice(startIndex, endIndex);
    
    if (frames.length < 2) {
      return { 
        score: 0, 
        components: { 
          classifier: 0, 
          statistical: 0, 
          autoCorrelation: 0, 
          direction: 0, 
          stability: 0 
        } 
      };
    }
    
    // Extract features
    const extractor = new Gesture.Features.FeatureExtractor(frames, { 
      frameRate: this.options.frameRate 
    });
    const features = extractor.extractFeatures();
    
    // Classify features
    const voteSum = model.classify(features);
    const confidence = 1 / (1 + Math.exp(-voteSum));  // Logistic function
    const rawScore = confidence * this.options.scoreScale;
    
    // For demonstration purposes, create mock component scores
    // In a real implementation, these would be computed from the motion data
    const components = {
      classifier: confidence,
      statistical: confidence * 0.73,
      autoCorrelation: 1,
      direction: 0,
      stability: 0
    };
    
    return {
      score: Math.round(rawScore),
      confidence,
      features,
      components
    };
  }
};

/**
 * @namespace Gesture.Config
 * @description Configuration options and defaults
 */
Gesture.Config = {
  /**
   * Default configuration values
   * @type {Object}
   */
  defaults: {
    frameRate: 30,
    windowSize: 16,
    scoreScale: 100,
    confidenceThreshold: 0.5
  }
};

/**
 * Load a gesture model from binary data
 * @function loadModel
 * @memberof Gesture
 * @param {ArrayBuffer} buffer - Binary model data
 * @returns {Gesture.Model} - Loaded model
 */
Gesture.loadModel = function(buffer) {
  return new Gesture.Model(buffer);
};

/**
 * Create an analyzer with specified models
 * @function createAnalyzer
 * @memberof Gesture
 * @param {Gesture.Model[]} models - Array of models to use
 * @param {Object} options - Configuration options
 * @returns {Gesture.Analysis.Analyzer} - Configured analyzer
 */
Gesture.createAnalyzer = function(models = [], options = {}) {
  return new Gesture.Analysis.Analyzer(models, options);
};

// Export as module for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Gesture;
} else if (typeof window !== 'undefined') {
  window.Gesture = Gesture;
  // For convenient direct access to key classes
  window.Model = Gesture.Model;
  window.Analyzer = Gesture.Analysis.Analyzer;
}

/**
 * Export the MoveSpace namespace as the default module export
 */
export default Gesture;

/**
 * Export individual classes for direct import
 */
export const Model = Gesture.Model;
export const Analyzer = Gesture.Analysis.Analyzer;
export const Utils = Gesture.Utils;
export const Core = Gesture.Core;
export const Algorithms = Gesture.Algorithms;
export const Features = Gesture.Features;