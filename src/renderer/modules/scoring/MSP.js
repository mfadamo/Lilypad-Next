/**
 * @file MSP.js
 * @description A JavaScript implementation of the MovementSpaces motion analysis system (Kinect).
 * 
 * This library provides tools for deserializing .msm model files and scoring
 * movement patterns based on accelerometer data.
 * 
 * Original implementations:
 * - JD2022_MAIN: Ubisoft for C code.
 * - Refactored by Ibratabian17, Partial implementation in JavaScript.
 */

/**
 * @namespace MSP_LIB
 * Top-level namespace for the Motion Signal Processing Library.
 */
const MSP_LIB = (() => {
    'use strict';

    // Helper for assertions (mimicking ASSERT_MOVESPACE)
    function msp_assert(condition, message) {
        if (!condition) {
            console.error("MSP_LIB Assertion Failed: " + message);
            throw new Error("MSP_LIB Assertion Failed: " + message);
        }
    }

    // Constants from AbstractSignal.h
    const HUGE_POSITIVE_VALUE = 1.0e+32;
    const HUGE_NEGATIVE_VALUE = -1.0e+32;

    // Enums from SignalsId.cs
    const eSignalsIds = {
        eSignalId_Base_ProgressRatio: 0,
        eSignalId_Base_Ax: 1,
        eSignalId_Base_Ay: 2,
        eSignalId_Base_Az: 3,
        eSignalId_AccelNorm: 4,
        eSignalId_AccelDevNorm: 5,
        eSignalId_AxDev: 6,
        eSignalId_AyDev: 7,
        eSignalId_AzDev: 8,
        eSignalId_AccelNormAvg_NP: 9,
        eSignalId_AccelDevNormAvg_NP: 10,
        eSignalId_AxDevAvg_Dir_NP: 11,
        eSignalId_AyDevAvg_Dir_NP: 12,
        eSignalId_AzDevAvg_Dir_NP: 13,
        eSignalId_COUNT: 14
    };

    // Enums from MeasuresIds.cs
    const eMeasuresIds = {
        eMeasureId_AxDevAvg_Dir_NP: 50,
        eMeasureId_AyDevAvg_Dir_NP: 51,
        eMeasureId_AzDevAvg_Dir_NP: 52,
        eMeasureId_AccelNormAvg_NP: 56,
        eMeasureId_AccelDevNormAvg_NP: 61,
        eMeasureId_COUNT: 62
    };

    // Enums from Signals.h (eSignalCalcIds)
    const eSignalCalcIds = {
        eSignalCalcId_None: 0,
        eSignalCalcId_Derivative: 1,
        eSignalCalcId_Norm3D: 2,
        eSignalCalcId_Average: 3,
    };

    // Enums from Measures.h (eMeasureCalcIds)
    const eMeasureCalcIds = {
        eMeasureCalcId_None: 0,
        eMeasureCalcId_SplitToNParts: 1,
    };

    // Malloc and Free are not directly applicable in JS due to garbage collection.
    // Object creation uses `new`.

    /**
     * @class AbstractSignal
     * Base class for all signal types.
     */
    class AbstractSignal {
        constructor() {
            this.mb_MustUpdateFirstTimeAsNextTimes = true;
            this.mf_Value = 0.0;
        }

        ResetParams() {
            this.mf_Value = 0.0;
        }

        UpdateSpeciallyForFirstTime() {
            // Default implementation
        }

        Update() {
            msp_assert(false, "Update() called on AbstractSignal. It should be overridden.");
        }

        SetMustUpdateFirstTimeAsNextTimes(_b_MustPerformFirstUpdateAsOthers) {
            this.mb_MustUpdateFirstTimeAsNextTimes = _b_MustPerformFirstUpdateAsOthers;
        }

        bMustUpdateFirstTimeAsNextTimes() {
            return this.mb_MustUpdateFirstTimeAsNextTimes;
        }

        fGetValue() {
            return this.mf_Value;
        }
    }

    /**
     * @class BaseSignal
     * Represents a basic signal whose value is set externally.
     */
    class BaseSignal extends AbstractSignal {
        constructor() {
            super();
        }

        Update() {
            // Base signals are updated by SetValue
        }

        SetValue(_f_Value) {
            this.mf_Value = _f_Value;
        }
    }


    /**
     * @class Signal_Derivative
     * Calculates the derivative of a source signal with respect to a progress ratio signal.
     */
    class Signal_Derivative extends AbstractSignal {
        constructor(_p_SourceSignal, _p_ProgressRatioSignal) {
            super();
            this.mp_SourceSignal = _p_SourceSignal;
            this.mp_ProgressRatioSignal = _p_ProgressRatioSignal;
            this.mb_MustUpdateFirstTimeAsNextTimes = false;
            this.ResetParams();
        }

        ResetParams() {
            super.ResetParams();
            this.mf_PrevSourceSignalValue = 0.0;
            this.mf_PrevProgressRatio = 0.0;
        }

        UpdateSpeciallyForFirstTime() {
            this.mf_PrevSourceSignalValue = this.mp_SourceSignal.fGetValue();
            this.mf_PrevProgressRatio = this.mp_ProgressRatioSignal.fGetValue();
        }

        Update() {
            const currentSourceValue = this.mp_SourceSignal.fGetValue();
            const currentProgressRatio = this.mp_ProgressRatioSignal.fGetValue();
            const deltaProgress = currentProgressRatio - this.mf_PrevProgressRatio;

            if (deltaProgress === 0) {
                this.mf_Value = 0.0;
            } else {
                this.mf_Value = (currentSourceValue - this.mf_PrevSourceSignalValue) / deltaProgress;
            }

            this.mf_PrevSourceSignalValue = currentSourceValue;
            this.mf_PrevProgressRatio = currentProgressRatio;
        }
    }

    /**
     * @class Signal_Norm3D
     * Calculates the 3D norm (magnitude) of three source signals (X, Y, Z).
     */
    class Signal_Norm3D extends AbstractSignal {
        constructor(_p_SourceSignalX, _p_SourceSignalY, _p_SourceSignalZ) {
            super();
            this.mp_SourceSignalX = _p_SourceSignalX;
            this.mp_SourceSignalY = _p_SourceSignalY;
            this.mp_SourceSignalZ = _p_SourceSignalZ;
            this.ResetParams(); // Though not strictly needed here as Update sets mf_Value directly
        }

        Update() {
            const valX = this.mp_SourceSignalX.fGetValue();
            const valY = this.mp_SourceSignalY.fGetValue();
            const valZ = this.mp_SourceSignalZ.fGetValue();
            this.mf_Value = Math.sqrt(valX * valX + valY * valY + valZ * valZ);
        }
    }

    /**
     * @class Signal_Average
     * Calculates the running average of a source signal.
     */
    class Signal_Average extends AbstractSignal {
        constructor(_p_SourceSignal) {
            super();
            this.mp_SourceSignal = _p_SourceSignal;
            this.ResetParams();
        }

        ResetParams() {
            super.ResetParams();
            this.mf_SourceSignalValuesSum = 0.0;
            this.mi_SourceSignalValuesCount = 0;
        }

        Update() {
            this.mf_SourceSignalValuesSum += this.mp_SourceSignal.fGetValue();
            this.mi_SourceSignalValuesCount++;
            if (this.mi_SourceSignalValuesCount > 0) {
                this.mf_Value = this.mf_SourceSignalValuesSum / this.mi_SourceSignalValuesCount;
            } else {
                this.mf_Value = 0.0;
            }
        }
    }

    class Measure_AverageInPart extends AbstractSignal {
        constructor(_p_SourceSignalToAverage, _p_ProgressRatioSignal, _uc_PartPos, _u8_PartsCount) {
            super();
            this.mp_SourceSignalToAverage = _p_SourceSignalToAverage;
            this.mp_ProgressRatioSignal = _p_ProgressRatioSignal;

            const f_SafetyDelayAtMoveStartAndEndInRatio = 0.01667;
            const f_PartDurationInRatio = (1.0 - 2.0 * f_SafetyDelayAtMoveStartAndEndInRatio) / _u8_PartsCount;
            this.mf_PartStartInRatio = f_SafetyDelayAtMoveStartAndEndInRatio + f_PartDurationInRatio * (_uc_PartPos - 1);
            this.mf_PartEndInRatio = this.mf_PartStartInRatio + f_PartDurationInRatio;

            this.ResetParams();
        }

        ResetParams() {
            super.ResetParams();
            this.mf_InternalSum = 0.0;
            this.mi_InternalCount = 0;
        }

        Update() {
            const progressRatio = this.mp_ProgressRatioSignal.fGetValue();

            // Only accumulate values when inside the designated part
            if (progressRatio >= this.mf_PartStartInRatio && progressRatio <= this.mf_PartEndInRatio) {
                this.mf_InternalSum += this.mp_SourceSignalToAverage.fGetValue();
                this.mi_InternalCount++;

                if (this.mi_InternalCount > 0) {
                    this.mf_Value = this.mf_InternalSum / this.mi_InternalCount;
                }
            }
        }
    }


    /**
     * @class Measure_ValueInPart
     * Extracts the value of a source signal within a specific part of a move's progress.
     */
    class Measure_ValueInPart extends AbstractSignal {
        constructor(_p_SourceSignal, _p_ProgressRatioSignal, _uc_PartPos, _u8_PartsCount) {
            super();
            this.mp_SourceSignal = _p_SourceSignal;
            this.mp_ProgressRatioSignal = _p_ProgressRatioSignal;
            this.mb_PartHasBeenProcessed = false; // Add this state variable

            // Using the same logic as the original file for part boundaries.
            const f_SafetyDelayAtMoveStartAndEndInRatio = 0.01667;
            const f_PartDurationInRatio = (1.0 - 2.0 * f_SafetyDelayAtMoveStartAndEndInRatio) / _u8_PartsCount;
            this.mf_PartStartInRatio = f_SafetyDelayAtMoveStartAndEndInRatio + f_PartDurationInRatio * (_uc_PartPos - 1);
            this.mf_PartEndInRatio = this.mf_PartStartInRatio + f_PartDurationInRatio;
        }

        ResetParams() {
             super.ResetParams();
             this.mb_PartHasBeenProcessed = false;
        }

        Update() {
            // This measure's job is to capture the value of its source signal (which is already an average)
            // as it is at the end of its designated part. It doesn't perform its own averaging.
            const progressRatio = this.mp_ProgressRatioSignal.fGetValue();
            
            if (progressRatio >= this.mf_PartStartInRatio && progressRatio < this.mf_PartEndInRatio) {
                // While inside the part, continuously update the value.
                // The final value will be the one captured on the last update call within this part.
                this.mf_Value = this.mp_SourceSignal.fGetValue();
                this.mb_PartHasBeenProcessed = true;
            } else if (progressRatio >= this.mf_PartEndInRatio && this.mb_PartHasBeenProcessed) {
                // If we have just passed the part, do one final update to ensure we have the very last value.
                // This handles cases where the last frame might be slightly outside the boundary.
                this.mf_Value = this.mp_SourceSignal.fGetValue();
                this.mb_PartHasBeenProcessed = false; // Prevent further updates
            }
        }
    }

    // Constants for Classifier Parsing
    const ENERGY_REQUIRED_MEASURES_BITFIELD = (BigInt(1) << BigInt(eMeasuresIds.eMeasureId_AccelNormAvg_NP)) | (BigInt(1) << BigInt(eMeasuresIds.eMeasureId_AccelDevNormAvg_NP));

    const CLASSIFIER_FORMAT_VERSION_NUMBER_FORCE10PARTS = 5;
    const CLASSIFIER_FORMAT_VERSION_NUMBER_WITHOUT_AC_AND_DIR_SETTINGS = 6;
    const CLASSIFIER_FORMAT_VERSION_NUMBER_WITH_AC_AND_DIR_SETTINGS = 7;
    const CLASSIFIER_FORMAT_VERSION_NUMBER_SUBCLASSIFIERS_SUPPORT = 8;

    const CLASSIFIER_FORMAT_VERSION_NUMBER_LATEST_OFFICIAL = 7;
    const HANDLED_CLASSIFIER_FORMAT_VERSIONS_MIN_NUMBER = CLASSIFIER_FORMAT_VERSION_NUMBER_FORCE10PARTS;
    const HANDLED_CLASSIFIER_FORMAT_VERSIONS_MAX_NUMBER = CLASSIFIER_FORMAT_VERSION_NUMBER_WITH_AC_AND_DIR_SETTINGS; // Or SUBCLASSIFIERS_SUPPORT if handled

    const CLASSIFIER_FILE_DATA_POSITION_ENDIANNESS = 0; // int32
    const CLASSIFIER_FILE_DATA_POSITION_FORMAT_VERSION_NUMBER = 4; // int32
    const CLASSIFIER_FILE_DATA_POSITION_MOVE_NAME = 8; // char[64]
    const CLASSIFIER_FILE_DATA_POSITION_SONG_NAME = 72; // char[64]
    const CLASSIFIER_FILE_DATA_POSITION_MEASURE_SET_NAME = 136; // char[64]
    const CLASSIFIER_FILE_DATA_POSITION_DURATION = 200; // float32
    const CLASSIFIER_FILE_DATA_POSITION_STAT_DIST_LOW_THRESHOLD = 204; // float32
    const CLASSIFIER_FILE_DATA_POSITION_STAT_DIST_HIGH_THRESHOLD = 208; // float32
    // Version dependent offsets start here for AC and DIR
    const CLASSIFIER_FILE_DATA_POSITION_AUTOCORRELATION_THRESHOLD = 212; // float32 (for V7+)
    const CLASSIFIER_FILE_DATA_POSITION_DIRECTION_IMPACT_FACTOR = 216; // float32 (for V7+)
    // The following are relative to the *end* of the above V7+ fields, or where they *would* end.
    // Let's define base offsets and adjust with c_ClassifierFormatCompatibilityOffset
    const CLASSIFIER_FILE_DATA_OFFSET_BASE_FOR_V7_PLUS_STRUCTURE = 220; // Offset after DirectionImpactFactor

    // These offsets are from the start of the file *assuming a V7+ structure*
    // and will be adjusted by c_ClassifierFormatCompatibilityOffset for older versions.
    const CLASSIFIER_FILE_DATA_POSITION_MEASURES_SET_V7BASE = CLASSIFIER_FILE_DATA_OFFSET_BASE_FOR_V7_PLUS_STRUCTURE; // u64
    const CLASSIFIER_FILE_DATA_POSITION_CUSTOMIZATION_FLAGS_V7BASE = CLASSIFIER_FILE_DATA_OFFSET_BASE_FOR_V7_PLUS_STRUCTURE + 8; // u32
    const CLASSIFIER_FILE_DATA_POSITION_MEANS_COUNT_V7BASE = CLASSIFIER_FILE_DATA_OFFSET_BASE_FOR_V7_PLUS_STRUCTURE + 12; // int32 (ml_ScoringAlgorithmType)
    const CLASSIFIER_FILE_DATA_POSITION_ENERGY_MEANS_COUNT_V7BASE = CLASSIFIER_FILE_DATA_OFFSET_BASE_FOR_V7_PLUS_STRUCTURE + 16; // u32
    const CLASSIFIER_FILE_DATA_POSITION_SUBCLASSIFIERS_COUNT_V7BASE = CLASSIFIER_FILE_DATA_OFFSET_BASE_FOR_V7_PLUS_STRUCTURE + 20; // u32
    const CLASSIFIER_FILE_HEADER_SIZE_V7BASE = CLASSIFIER_FILE_DATA_OFFSET_BASE_FOR_V7_PLUS_STRUCTURE + 24;


    const ACCEL_SAMPLES_MIN_COUNT_PER_PART_AT_30_FPS = 2.49;

    const STAT_DIST_LOW_THRESHOLD_MIN = 0.4;
    const STAT_DIST_LOW_THRESHOLD_MAX = 1.4;
    const STAT_DIST_HIGH_THRESHOLD_MIN = 1.5;
    const STAT_DIST_HIGH_THRESHOLD_MAX = 6.0;
    const AUTO_CORRELATION_THRESHOLD_MIN = 0.5;
    const AUTO_CORRELATION_THRESHOLD_MAX = 1.3;
    const DIRECTION_IMPACT_FACTOR_THRESHOLD_MIN = 0.0;
    const DIRECTION_IMPACT_FACTOR_THRESHOLD_MAX = 1.0;

    const EClassifierCustomizationFlags = {
        eCCF_IgnorePartsDirection: 1 << 0,
        eCCF_IgnoreAutoCorrelation: 1 << 1
    };

    function Clamp(value, min, max) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    // Struct-like classes
    class stSignalDefinition {
        constructor(_uc_SignalId, _e_CalculusId, _uc_SignalId1, _uc_SignalId2 = 0xff, _uc_SignalId3 = 0xff) {
            this.muc_SignalId = _uc_SignalId;
            this.me_CalculusId = _e_CalculusId;
            this.mauc_SourceSignalIds = [];
            this.mauc_SourceSignalIds.push(_uc_SignalId1);
            if (_uc_SignalId2 !== 0xff) this.mauc_SourceSignalIds.push(_uc_SignalId2);
            if (_uc_SignalId3 !== 0xff) this.mauc_SourceSignalIds.push(_uc_SignalId3);
            this.mb_MarkedAsUsed = false;
        }
    }

    class stMeasureDefinition {
        constructor(_uc_MeasureId, _e_CalculusId, _uc_SignalId1, _uc_SignalId2 = 0xff, _uc_SignalId3 = 0xff, _uc_SignalId4 = 0xff) {
            this.muc_MeasureId = _uc_MeasureId;
            this.me_CalculusId = _e_CalculusId;
            this.mauc_SourceSignalIds = [];
            this.mauc_SourceSignalIds.push(_uc_SignalId1);
            if (_uc_SignalId2 !== 0xff) this.mauc_SourceSignalIds.push(_uc_SignalId2);
            if (_uc_SignalId3 !== 0xff) this.mauc_SourceSignalIds.push(_uc_SignalId3);
            if (_uc_SignalId4 !== 0xff) this.mauc_SourceSignalIds.push(_uc_SignalId4);
        }
    }

    class stSignal {
        constructor(_uc_Id, _p_Signal) {
            this.muc_Id = _uc_Id;
            this.mp_Signal = _p_Signal;
        }
    }

    class stMeasure {
        constructor(_uc_Id, _p_Measure, _b_UsedForScoringComputation, _b_UsedForEnergyComputation, _uc_PartPos) {
            this.muc_Id = _uc_Id;
            this.mp_Measure = _p_Measure;
            this.mb_UsedForScoringComputation = _b_UsedForScoringComputation;
            this.mb_UsedForEnergyComputation = _b_UsedForEnergyComputation;
            this.muc_PartPos = _uc_PartPos;
        }
    }

    class stWishedMeasures {
        constructor(_uc_Id, _b_UsedForScoringComputation, _b_UsedForEnergyComputation) {
            this.muc_Id = _uc_Id;
            this.mb_UsedForScoringComputation = _b_UsedForScoringComputation;
            this.mb_UsedForEnergyComputation = _b_UsedForEnergyComputation;
        }
    }

    class stMeasuresResultAtMoveEnd {
        constructor(_uc_MeasureId, _f_Value, _uc_PartPos) {
            this.muc_MeasureId = _uc_MeasureId;
            this.mf_Value = _f_Value;
            this.muc_PartPos = _uc_PartPos;
        }
    }

    class stVec3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    class stPartAccelAvg {
        constructor() {
            this.mv_PartAccelAvgResults = new stVec3();
            this.mv_PartAccelAvgMeans = new stVec3();
            this.mv_PartAccelAvgInvertedCovariances = new stVec3();
        }
    }

    class stMoveClassifier {
        constructor() {
            this.ml_ScoringAlgorithmType = 0;
            this.maf_Means = [];
            this.maf_InvertedCovariances = [];
            this.maf_EnergyMeans = [];
        }
    }

    class stAutoCorrelationAccelNormSample {
        constructor(_f_Time = 0.0, _f_AccelNorm = 0.0) {
            this.mf_Time = _f_Time;
            this.mf_AccelNorm = _f_AccelNorm;
        }
    }


    class ScoreManager {
        constructor() {
            this.mp_GameInterface = new ScoreManager.GameInterface(this);
            this.mp_ToolsInterface = new ScoreManager.ToolsInterface(this);
            this.mpst_MoveClassifier = new stMoveClassifier();

            this.mu64_PrevMoveMeasuresSetBitfield = BigInt(0);
            this.muc_MoveAnalysisPartsCount = 0;
            this.mb_EnergyComputationIsRequired = false;
            this.mul_ClassifierFormatVersionNumberToUse = 0;
            this.mf_DefaultMoveStatDistLowThreshold = 0.0;
            this.mf_DefaultMoveStatDistHighThreshold = 0.0;
            this.mf_DefaultMoveAutoCorrelationThreshold = 0.0;
            this.mf_DefaultMoveDirectionImpactFactor = 0.0;
            this.mf_GameMoveDuration = 0.0;
            this.mf_MoveStatDistLowThreshold = 0.0;
            this.mf_MoveStatDistHighThreshold = 0.0;
            this.mf_MoveAutoCorrelationThreshold = 0.0;
            this.mf_MoveDirectionImpactFactor = 0.0;
            this.mul_CustomizationFlags = 0;
            this.mf_InitialSignalSmoothingFrequency = 0.0;
            this.mf_CurrentSignalSmoothingFrequency = 0.0;
            this.mf_SignalSmoothingNextProgressRatio = 0.0;
            this.mul_SignalSmoothing_UpdatesCount = 0;
            this.mf_SignalSmoothing_AccelXSum = 0.0;
            this.mf_SignalSmoothing_AccelYSum = 0.0;
            this.mf_SignalSmoothing_AccelZSum = 0.0;
            this.mf_LastMoveStatisticalDistance = -1.0;
            this.mb_MoveIsRunning = false;
            this.mb_FirstUpdateHasOccurred = false;

            this.mast_Signals = [];
            this.mast_Measures = [];

            this.mast_NonAccelDirMeasuresResultsAtMoveEnd = [];
            this.maf_EnergyMeansResultsAtMoveEnd = [];
            this.maf_PerformedDirectionStatDistByPart = [];
            this.maf_InvertedDirectionStatDistByPart = [];

            this.mast_AutoCorrelationSignal = [];
            this.mf_AutoCorrelationAccelNormsSum = 0.0;
            this.mb_AutoCorrelationSignalHasAlreadyBeenCentered = false;

            this.mf_LowDistanceThresholdModifier = 0.0;
            this.mf_HighDistanceThresholdModifier = 0.0;
            this.mf_ShakeSensitivityModifier = 0.0;
            this.mf_DirectionSensitivityModifier = 0.0;
        }

        Game() { return this.mp_GameInterface; }
        Tools() { return this.mp_ToolsInterface; }

        InitForGeneration(_b_EnergyComputationIsRequired, _f_SignalSmoothingFrequency, _ul_ClassifierFormatVersionNumberToUse) {
            this.mb_EnergyComputationIsRequired = _b_EnergyComputationIsRequired;
            this.mf_InitialSignalSmoothingFrequency = _f_SignalSmoothingFrequency;
            this.mul_ClassifierFormatVersionNumberToUse = _ul_ClassifierFormatVersionNumberToUse;
            this.mf_DefaultMoveStatDistLowThreshold = -1.0;
            this.mf_DefaultMoveStatDistHighThreshold = -1.0;
            this.mf_DefaultMoveAutoCorrelationThreshold = -1.0;
            this.mf_DefaultMoveDirectionImpactFactor = -1.0;
            this.mb_MoveIsRunning = false;
        }

        InitForScoring(_f_DefaultStatDistLowThreshold, _f_DefaultStatDistHighThreshold, _f_DefaultAutoCorrelationThreshold, _f_DefaultDirectionImpactFactor, _f_SignalSmoothingFrequency) {
            this.mf_DefaultMoveStatDistLowThreshold = _f_DefaultStatDistLowThreshold;
            this.mf_DefaultMoveStatDistHighThreshold = _f_DefaultStatDistHighThreshold;
            this.mf_DefaultMoveAutoCorrelationThreshold = _f_DefaultAutoCorrelationThreshold;
            this.mf_DefaultMoveDirectionImpactFactor = _f_DefaultDirectionImpactFactor;
            this.mf_InitialSignalSmoothingFrequency = _f_SignalSmoothingFrequency;
            this.mb_MoveIsRunning = false;
        }

        StartMoveAnalysis(_u64_MeasuresSetBitfield, _f_ClassifierMoveDuration, _f_GameMoveDuration, _f_MoveStatDistLowThreshold, _f_MoveStatDistHighThreshold, _f_MoveAutoCorrelationThreshold, _f_MoveDirectionImpactFactor, _ul_CustomizationFlags) {
            if (this.mb_MoveIsRunning) {
                msp_assert(false, "Movespace LIB : StartMoveAnalysis() has been called but a move is currently running. Should call StopMoveAnalysis() before.");
                return;
            }
            // Ensure it's BigInt, could be passed as number from JS if not careful
            _u64_MeasuresSetBitfield = BigInt(_u64_MeasuresSetBitfield);

            const uc_MoveAnalysisPartsNewCount = this.ucGetMoveAnalysisPartsCounts(_f_ClassifierMoveDuration);

            if (_u64_MeasuresSetBitfield !== this.mu64_PrevMoveMeasuresSetBitfield || uc_MoveAnalysisPartsNewCount !== this.muc_MoveAnalysisPartsCount) {
                this.muc_MoveAnalysisPartsCount = uc_MoveAnalysisPartsNewCount;
                this.DestroySignalsAndMeasures();
                this.CreateSignalsAndMeasures(_u64_MeasuresSetBitfield);
                this.mu64_PrevMoveMeasuresSetBitfield = _u64_MeasuresSetBitfield;
            }

            this.ResetSignalsAndMeasures();
            this.mf_GameMoveDuration = _f_GameMoveDuration;

            this.mf_MoveStatDistLowThreshold = (_f_MoveStatDistLowThreshold === -1.0) ? this.mf_DefaultMoveStatDistLowThreshold : _f_MoveStatDistLowThreshold;
            this.mf_MoveStatDistLowThreshold += this.mf_LowDistanceThresholdModifier;
            this.mf_MoveStatDistLowThreshold = Clamp(this.mf_MoveStatDistLowThreshold, STAT_DIST_LOW_THRESHOLD_MIN, STAT_DIST_LOW_THRESHOLD_MAX);

            this.mf_MoveStatDistHighThreshold = (_f_MoveStatDistHighThreshold === -1.0) ? this.mf_DefaultMoveStatDistHighThreshold : _f_MoveStatDistHighThreshold;
            this.mf_MoveStatDistHighThreshold += this.mf_HighDistanceThresholdModifier;
            this.mf_MoveStatDistHighThreshold = Clamp(this.mf_MoveStatDistHighThreshold, STAT_DIST_HIGH_THRESHOLD_MIN, STAT_DIST_HIGH_THRESHOLD_MAX);

            this.mf_MoveAutoCorrelationThreshold = (_f_MoveAutoCorrelationThreshold === -1.0) ? this.mf_DefaultMoveAutoCorrelationThreshold : _f_MoveAutoCorrelationThreshold;
            this.mf_MoveAutoCorrelationThreshold += this.mf_ShakeSensitivityModifier * (AUTO_CORRELATION_THRESHOLD_MIN - AUTO_CORRELATION_THRESHOLD_MAX);
            this.mf_MoveAutoCorrelationThreshold = Clamp(this.mf_MoveAutoCorrelationThreshold, AUTO_CORRELATION_THRESHOLD_MIN, AUTO_CORRELATION_THRESHOLD_MAX);
            if (this.mf_MoveAutoCorrelationThreshold === AUTO_CORRELATION_THRESHOLD_MAX) {
                _ul_CustomizationFlags |= EClassifierCustomizationFlags.eCCF_IgnoreAutoCorrelation;
            }

            this.mf_MoveDirectionImpactFactor = (_f_MoveDirectionImpactFactor === -1.0) ? this.mf_DefaultMoveDirectionImpactFactor : _f_MoveDirectionImpactFactor;
            this.mf_MoveDirectionImpactFactor += this.mf_DirectionSensitivityModifier;
            this.mf_MoveDirectionImpactFactor = Clamp(this.mf_MoveDirectionImpactFactor, DIRECTION_IMPACT_FACTOR_THRESHOLD_MIN, DIRECTION_IMPACT_FACTOR_THRESHOLD_MAX);
            if (this.mf_MoveDirectionImpactFactor === DIRECTION_IMPACT_FACTOR_THRESHOLD_MIN) {
                _ul_CustomizationFlags |= EClassifierCustomizationFlags.eCCF_IgnorePartsDirection;
            }

            this.mul_CustomizationFlags = _ul_CustomizationFlags;
            if (this.mf_InitialSignalSmoothingFrequency > 0 && _f_GameMoveDuration > 0) {
                this.mf_SignalSmoothingNextProgressRatio = 1.0 / (_f_GameMoveDuration * this.mf_InitialSignalSmoothingFrequency);
            } else {
                this.mf_SignalSmoothingNextProgressRatio = Infinity;
            }
            this.mf_CurrentSignalSmoothingFrequency = this.mf_InitialSignalSmoothingFrequency;
            this.mul_SignalSmoothing_UpdatesCount = 0;
            this.mf_SignalSmoothing_AccelXSum = 0.0;
            this.mf_SignalSmoothing_AccelYSum = 0.0;
            this.mf_SignalSmoothing_AccelZSum = 0.0;
            this.mf_LastMoveStatisticalDistance = -1.0;

            this.mast_NonAccelDirMeasuresResultsAtMoveEnd = [];
            this.maf_EnergyMeansResultsAtMoveEnd = [];
            this.maf_PerformedDirectionStatDistByPart = [];
            this.maf_InvertedDirectionStatDistByPart = [];

            this.mast_AutoCorrelationSignal = [];
            this.mf_AutoCorrelationAccelNormsSum = 0.0;
            this.mb_AutoCorrelationSignalHasAlreadyBeenCentered = false;

            this.mb_FirstUpdateHasOccurred = false;
            this.mb_MoveIsRunning = true;
        }

        bStartMoveAnalysis(classifierFileData, gameMoveDuration) {
            if (!classifierFileData || !(classifierFileData instanceof ArrayBuffer)) {
                msp_assert(false, "classifierFileData must be an ArrayBuffer.");
                return false;
            }

            this.ClearMoveClassifierStruct();

            const dataView = new DataView(classifierFileData);
            const b_EndiannessSwapRequired = ScoreManager.bIsEndiannessSwapRequired(dataView); // Use DataView instance
            const fileIsLittleEndian = !b_EndiannessSwapRequired;

            this.mul_ClassifierFormatVersionNumberToUse = dataView.getUint32(CLASSIFIER_FILE_DATA_POSITION_FORMAT_VERSION_NUMBER, fileIsLittleEndian);

            const c_ClassifierFormatCompatibilityOffset = ScoreManager.cGetClassifierFormatCompatibilityOffset(dataView, this.mul_ClassifierFormatVersionNumberToUse);
            if (c_ClassifierFormatCompatibilityOffset === -1) {
                msp_assert(false, "Unsupported classifier format or invalid file data.");
                return false;
            }

            if (!this.bFillMoveClassifierStructFromFileData(dataView, fileIsLittleEndian, c_ClassifierFormatCompatibilityOffset)) {
                return false;
            }

            // Read header fields sequentially using the existing DataView
            const f_ClassifierMoveDuration = dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_DURATION, fileIsLittleEndian);
            const f_MoveStatDistLowThreshold = dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_STAT_DIST_LOW_THRESHOLD, fileIsLittleEndian);
            const f_MoveStatDistHighThreshold = dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_STAT_DIST_HIGH_THRESHOLD, fileIsLittleEndian);

            let f_MoveAutoCorrelationThreshold = -1.0;
            let f_MoveDirectionImpactFactor = -1.0;

            if (this.mul_ClassifierFormatVersionNumberToUse >= CLASSIFIER_FORMAT_VERSION_NUMBER_WITH_AC_AND_DIR_SETTINGS) {
                f_MoveAutoCorrelationThreshold = dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_AUTOCORRELATION_THRESHOLD, fileIsLittleEndian);
                f_MoveDirectionImpactFactor = dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_DIRECTION_IMPACT_FACTOR, fileIsLittleEndian);
            }

            // For these fields, their absolute position depends on whether AC/DIR fields are present (determined by version)
            // The c_ClassifierFormatCompatibilityOffset handles this adjustment.
            const u64_MeasuresSetBitfield = dataView.getBigUint64(CLASSIFIER_FILE_DATA_POSITION_MEASURES_SET_V7BASE - c_ClassifierFormatCompatibilityOffset, fileIsLittleEndian);
            const ul_CustomizationFlags = dataView.getUint32(CLASSIFIER_FILE_DATA_POSITION_CUSTOMIZATION_FLAGS_V7BASE - c_ClassifierFormatCompatibilityOffset, fileIsLittleEndian);
            // Energy measures count is read within bFillMoveClassifierStructFromFileData and stored in this.mpst_MoveClassifier.maf_EnergyMeans.length
            // We can derive mb_EnergyComputationIsRequired from that.
            this.mb_EnergyComputationIsRequired = this.mpst_MoveClassifier.maf_EnergyMeans.length > 0;


            if (u64_MeasuresSetBitfield === BigInt(0)) {
                msp_assert(false, "MeasuresSetBitfield is zero, nothing to score.");
                return false;
            }

            this.StartMoveAnalysis(
                u64_MeasuresSetBitfield,
                f_ClassifierMoveDuration,
                gameMoveDuration,
                f_MoveStatDistLowThreshold,
                f_MoveStatDistHighThreshold,
                f_MoveAutoCorrelationThreshold,
                f_MoveDirectionImpactFactor,
                ul_CustomizationFlags
            );
            return true;
        }


        StopMoveAnalysis() {
            if (!this.mb_MoveIsRunning) {
                msp_assert(false, "Movespace LIB : StopMoveAnalysis() has been called but no move is currently running. Should call StartMoveAnalysis() before.");
                return;
            }
            this.mb_MoveIsRunning = false;

            const ast_EnergyNeededMeasuresResultsAtMoveEnd = [];
            this.mast_NonAccelDirMeasuresResultsAtMoveEnd = [];

            for (const measureContainer of this.mast_Measures) {
                if (measureContainer.mb_UsedForScoringComputation) {
                    this.mast_NonAccelDirMeasuresResultsAtMoveEnd.push(
                        new stMeasuresResultAtMoveEnd(measureContainer.muc_Id, measureContainer.mp_Measure.fGetValue(), measureContainer.muc_PartPos)
                    );
                }
                if (measureContainer.mb_UsedForEnergyComputation) {
                    ast_EnergyNeededMeasuresResultsAtMoveEnd.push(
                        new stMeasuresResultAtMoveEnd(measureContainer.muc_Id, measureContainer.mp_Measure.fGetValue(), measureContainer.muc_PartPos)
                    );
                }
            }

            this.maf_EnergyMeansResultsAtMoveEnd = [];
            if (ast_EnergyNeededMeasuresResultsAtMoveEnd.length > 0) {
                let f_AccelNormAvgValuesSum = 0.0;
                let uc_AccelNormAvgValuesCount = 0;
                let f_AccelDevNormAvgValuesSum = 0.0;
                let uc_AccelDevNormAvgValuesCount = 0;

                for (const measureResult of ast_EnergyNeededMeasuresResultsAtMoveEnd) {
                    if (measureResult.muc_MeasureId === eMeasuresIds.eMeasureId_AccelNormAvg_NP) {
                        f_AccelNormAvgValuesSum += measureResult.mf_Value;
                        uc_AccelNormAvgValuesCount++;
                    } else if (measureResult.muc_MeasureId === eMeasuresIds.eMeasureId_AccelDevNormAvg_NP) {
                        f_AccelDevNormAvgValuesSum += measureResult.mf_Value;
                        uc_AccelDevNormAvgValuesCount++;
                    }
                }

                if (uc_AccelNormAvgValuesCount > 0) {
                    this.maf_EnergyMeansResultsAtMoveEnd.push(f_AccelNormAvgValuesSum / uc_AccelNormAvgValuesCount);
                } else {
                    this.maf_EnergyMeansResultsAtMoveEnd.push(0.0);
                }
                if (uc_AccelDevNormAvgValuesCount > 0) {
                    this.maf_EnergyMeansResultsAtMoveEnd.push(f_AccelDevNormAvgValuesSum / uc_AccelDevNormAvgValuesCount);
                } else {
                    this.maf_EnergyMeansResultsAtMoveEnd.push(0.0);
                }
            } else if (this.mb_EnergyComputationIsRequired) {
                this.maf_EnergyMeansResultsAtMoveEnd.push(0.0);
                this.maf_EnergyMeansResultsAtMoveEnd.push(0.0);
            }
        }

        bCanComputeDirectionStatDistsByPart(_b_DontComputeIfIgnored = false) {
            if (this.mpst_MoveClassifier.ml_ScoringAlgorithmType === 0) {
                msp_assert(false, "Movespace LIB : ComputeDirectionStatDistsByPart() can't compute anything as it has no useable classifier. Don't forget to call StopMoveAnalysis() before.");
                return false;
            }

            if (_b_DontComputeIfIgnored && (this.mul_CustomizationFlags & EClassifierCustomizationFlags.eCCF_IgnorePartsDirection)) {
                return false;
            }

            let iter_Means_idx = 0;
            let iter_InvertedCovariances_idx = 0;
            let uc_MeasuresCount = 0;

            const ast_PartAccelAvgs = Array(this.muc_MoveAnalysisPartsCount).fill(null).map(() => new stPartAccelAvg());

            for (const iter_MeasureResult of this.mast_NonAccelDirMeasuresResultsAtMoveEnd) {
                if (iter_MeasureResult.muc_MeasureId === eMeasuresIds.eMeasureId_AxDevAvg_Dir_NP ||
                    iter_MeasureResult.muc_MeasureId === eMeasuresIds.eMeasureId_AyDevAvg_Dir_NP ||
                    iter_MeasureResult.muc_MeasureId === eMeasuresIds.eMeasureId_AzDevAvg_Dir_NP) {

                    uc_MeasuresCount++;
                    const uc_PartAccelIndex = iter_MeasureResult.muc_PartPos - 1;
                    if (uc_PartAccelIndex < 0 || uc_PartAccelIndex >= this.muc_MoveAnalysisPartsCount ||
                        iter_Means_idx >= this.mpst_MoveClassifier.maf_Means.length ||
                        iter_InvertedCovariances_idx >= this.mpst_MoveClassifier.maf_InvertedCovariances.length) {
                        // Safety break, data mismatch
                        msp_assert(false, "Index out of bounds or insufficient classifier data in bCanComputeDirectionStatDistsByPart");
                        return false;
                    }


                    const currentPartAvg = ast_PartAccelAvgs[uc_PartAccelIndex];

                    switch (iter_MeasureResult.muc_MeasureId) {
                        case eMeasuresIds.eMeasureId_AxDevAvg_Dir_NP:
                            currentPartAvg.mv_PartAccelAvgResults.x = iter_MeasureResult.mf_Value;
                            currentPartAvg.mv_PartAccelAvgMeans.x = this.mpst_MoveClassifier.maf_Means[iter_Means_idx];
                            currentPartAvg.mv_PartAccelAvgInvertedCovariances.x = this.mpst_MoveClassifier.maf_InvertedCovariances[iter_InvertedCovariances_idx];
                            break;
                        case eMeasuresIds.eMeasureId_AyDevAvg_Dir_NP:
                            currentPartAvg.mv_PartAccelAvgResults.y = iter_MeasureResult.mf_Value;
                            currentPartAvg.mv_PartAccelAvgMeans.y = this.mpst_MoveClassifier.maf_Means[iter_Means_idx];
                            currentPartAvg.mv_PartAccelAvgInvertedCovariances.y = this.mpst_MoveClassifier.maf_InvertedCovariances[iter_InvertedCovariances_idx];
                            break;
                        case eMeasuresIds.eMeasureId_AzDevAvg_Dir_NP:
                            currentPartAvg.mv_PartAccelAvgResults.z = iter_MeasureResult.mf_Value;
                            currentPartAvg.mv_PartAccelAvgMeans.z = this.mpst_MoveClassifier.maf_Means[iter_Means_idx];
                            currentPartAvg.mv_PartAccelAvgInvertedCovariances.z = this.mpst_MoveClassifier.maf_InvertedCovariances[iter_InvertedCovariances_idx];
                            break;
                    }
                }
                iter_Means_idx++;
                iter_InvertedCovariances_idx++;
            }

            if (uc_MeasuresCount !== 3 * this.muc_MoveAnalysisPartsCount) {
                return false;
            }

            this.maf_PerformedDirectionStatDistByPart = [];
            this.maf_InvertedDirectionStatDistByPart = [];

            for (let uc_PartAccelIndex = 0; uc_PartAccelIndex < this.muc_MoveAnalysisPartsCount; ++uc_PartAccelIndex) {
                const partData = ast_PartAccelAvgs[uc_PartAccelIndex];
                if (partData.mv_PartAccelAvgMeans.x === undefined || partData.mv_PartAccelAvgResults.x === undefined || partData.mv_PartAccelAvgInvertedCovariances.x === undefined) {
                    this.maf_PerformedDirectionStatDistByPart.push(HUGE_POSITIVE_VALUE);
                    this.maf_InvertedDirectionStatDistByPart.push(HUGE_POSITIVE_VALUE);
                    continue;
                }

                this.maf_PerformedDirectionStatDistByPart.push(Math.sqrt(this.fComputeSqrDistFromAccelAvgResultAndClassifierData(partData)));

                const st_InvertedDirectionStatDist = new stPartAccelAvg();
                st_InvertedDirectionStatDist.mv_PartAccelAvgResults.x = -partData.mv_PartAccelAvgResults.x;
                st_InvertedDirectionStatDist.mv_PartAccelAvgResults.y = -partData.mv_PartAccelAvgResults.y;
                st_InvertedDirectionStatDist.mv_PartAccelAvgResults.z = -partData.mv_PartAccelAvgResults.z;
                st_InvertedDirectionStatDist.mv_PartAccelAvgMeans = partData.mv_PartAccelAvgMeans;
                st_InvertedDirectionStatDist.mv_PartAccelAvgInvertedCovariances = partData.mv_PartAccelAvgInvertedCovariances;

                this.maf_InvertedDirectionStatDistByPart.push(Math.sqrt(this.fComputeSqrDistFromAccelAvgResultAndClassifierData(st_InvertedDirectionStatDist)));
            }
            return true;
        }

        fGetSureRightDirectionPartsRatio() {
            if (this.muc_MoveAnalysisPartsCount === 0 || this.maf_PerformedDirectionStatDistByPart.length !== this.muc_MoveAnalysisPartsCount || this.maf_InvertedDirectionStatDistByPart.length !== this.muc_MoveAnalysisPartsCount) return 0.0;

            let uc_SureRightDirectionPartsCount = 0;
            for (let uc_PartIndex = 0; uc_PartIndex < this.muc_MoveAnalysisPartsCount; ++uc_PartIndex) {
                if (this.maf_InvertedDirectionStatDistByPart[uc_PartIndex] > this.maf_PerformedDirectionStatDistByPart[uc_PartIndex]) {
                    uc_SureRightDirectionPartsCount++;
                }
            }
            const f_SureRightDirectionPartsRatio = this.muc_MoveAnalysisPartsCount > 0 ? uc_SureRightDirectionPartsCount / this.muc_MoveAnalysisPartsCount : 0.0;
            return (this.mul_CustomizationFlags & EClassifierCustomizationFlags.eCCF_IgnorePartsDirection) ? -f_SureRightDirectionPartsRatio : f_SureRightDirectionPartsRatio;
        }

        fGetSureWrongDirectionPartsRatio() {
            if (this.muc_MoveAnalysisPartsCount === 0 || this.maf_PerformedDirectionStatDistByPart.length !== this.muc_MoveAnalysisPartsCount || this.maf_InvertedDirectionStatDistByPart.length !== this.muc_MoveAnalysisPartsCount) return 0.0;

            let uc_SureWrongDirectionPartsCount = 0;
            for (let uc_PartIndex = 0; uc_PartIndex < this.muc_MoveAnalysisPartsCount; ++uc_PartIndex) {
                if (this.maf_InvertedDirectionStatDistByPart[uc_PartIndex] < this.maf_PerformedDirectionStatDistByPart[uc_PartIndex]) {
                    uc_SureWrongDirectionPartsCount++;
                }
            }
            const f_SureWrongDirectionPartsRatio = this.muc_MoveAnalysisPartsCount > 0 ? uc_SureWrongDirectionPartsCount / this.muc_MoveAnalysisPartsCount : 0.0;
            return (this.mul_CustomizationFlags & EClassifierCustomizationFlags.eCCF_IgnorePartsDirection) ? -f_SureWrongDirectionPartsRatio : f_SureWrongDirectionPartsRatio;
        }

        fGetDirectionTendencyImpactOnScoreRatio() {
            if (this.muc_MoveAnalysisPartsCount === 0 || this.maf_PerformedDirectionStatDistByPart.length !== this.muc_MoveAnalysisPartsCount || this.maf_InvertedDirectionStatDistByPart.length !== this.muc_MoveAnalysisPartsCount) return 0.0;

            let c_DirectionTendency = 0;
            for (let uc_PartIndex = 0; uc_PartIndex < this.muc_MoveAnalysisPartsCount; ++uc_PartIndex) {
                const f_PartDirectionTendency = this.maf_InvertedDirectionStatDistByPart[uc_PartIndex] - this.maf_PerformedDirectionStatDistByPart[uc_PartIndex];
                if (f_PartDirectionTendency > 0.0) c_DirectionTendency++;
                else if (f_PartDirectionTendency < 0.0) c_DirectionTendency--;
            }
            return this.muc_MoveAnalysisPartsCount > 0 ? (c_DirectionTendency / this.muc_MoveAnalysisPartsCount) * this.mf_MoveDirectionImpactFactor : 0.0;
        }

        fGetLastMoveStatisticalDistance() {
            if (this.mpst_MoveClassifier.ml_ScoringAlgorithmType === 0) {
                msp_assert(false, "Movespace LIB : fGetLastMoveStatisticalDistance can't compute anything as it has no useable classifier. Don't forget to call StopMoveAnalysis() before.");
                return -1.0;
            }
            if (this.mf_LastMoveStatisticalDistance !== -1.0) {
                return this.mf_LastMoveStatisticalDistance;
            }

            let f_SqrStatisticalDistance = 0.0;
            let uc_MeasuresUsedForScoringCount = 0;

            let iter_Means_idx = 0;
            let iter_InvertedCovariances_idx = 0;

            if (this.mpst_MoveClassifier.ml_ScoringAlgorithmType > 0) { // Naive Bayes
                for (const iter_MeasureResult of this.mast_NonAccelDirMeasuresResultsAtMoveEnd) {
                    if (iter_MeasureResult.muc_MeasureId !== eMeasuresIds.eMeasureId_AxDevAvg_Dir_NP &&
                        iter_MeasureResult.muc_MeasureId !== eMeasuresIds.eMeasureId_AyDevAvg_Dir_NP &&
                        iter_MeasureResult.muc_MeasureId !== eMeasuresIds.eMeasureId_AzDevAvg_Dir_NP) {

                        if (iter_Means_idx >= this.mpst_MoveClassifier.maf_Means.length ||
                            iter_InvertedCovariances_idx >= this.mpst_MoveClassifier.maf_InvertedCovariances.length) {
                            msp_assert(false, "Classifier data missing for Naive Bayes calculation.");
                            this.mf_LastMoveStatisticalDistance = HUGE_POSITIVE_VALUE;
                            return this.mf_LastMoveStatisticalDistance;
                        }
                        const mean = this.mpst_MoveClassifier.maf_Means[iter_Means_idx];
                        const invCov = this.mpst_MoveClassifier.maf_InvertedCovariances[iter_InvertedCovariances_idx];

                        f_SqrStatisticalDistance += Math.pow(iter_MeasureResult.mf_Value - mean, 2) * invCov;
                        uc_MeasuresUsedForScoringCount++;
                    }
                    iter_Means_idx++;
                    iter_InvertedCovariances_idx++;
                }
            } else { // Mahalanobis (ml_ScoringAlgorithmType < 0)
                const af_Deviations = [];
                iter_Means_idx = 0;
                for (const iter_MeasureResult of this.mast_NonAccelDirMeasuresResultsAtMoveEnd) {
                    if (iter_MeasureResult.muc_MeasureId !== eMeasuresIds.eMeasureId_AxDevAvg_Dir_NP &&
                        iter_MeasureResult.muc_MeasureId !== eMeasuresIds.eMeasureId_AyDevAvg_Dir_NP &&
                        iter_MeasureResult.muc_MeasureId !== eMeasuresIds.eMeasureId_AzDevAvg_Dir_NP) {

                        if (iter_Means_idx >= this.mpst_MoveClassifier.maf_Means.length) {
                            msp_assert(false, "Classifier means data missing for Mahalanobis deviation calculation.");
                            this.mf_LastMoveStatisticalDistance = HUGE_POSITIVE_VALUE;
                            return this.mf_LastMoveStatisticalDistance;
                        }
                        const mean = this.mpst_MoveClassifier.maf_Means[iter_Means_idx];
                        af_Deviations.push(iter_MeasureResult.mf_Value - mean);
                        uc_MeasuresUsedForScoringCount++;
                    } else {
                        // For directional measures, push a deviation that corresponds to its position if it were part of the
                        // full deviation vector. Its actual value won't be used in the Mahalanobis sum if it's truly excluded,
                        // but the indexing for maf_Means needs to advance.
                        // However, the C++ code pushes 0.0f for these.
                        af_Deviations.push(0.0);
                    }
                    iter_Means_idx++;
                }

                // The C++ code iterates through af_Deviations for outer and inner loops.
                // iter_InvertedCovariances points to a flattened upper-triangular matrix of the inverted covariance matrix
                // *for non-directional measures only*.
                // The current JS loop structure for Mahalanobis seems to correctly map to this:
                // It iterates i and j over af_Deviations. af_Deviations[k] is 0 if measure k was directional.
                // The product af_Deviations[i] * af_Deviations[j] will be zero if either is directional.
                // iter_InvertedCovariances_idx should correctly index into the compacted inverted covariance matrix.

                iter_InvertedCovariances_idx = 0; // Reset for matrix traversal
                const numTotalMeasuresInDeviationVector = af_Deviations.length;

                // This reconstruction of Mahalanobis assumes maf_InvertedCovariances stores the
                // upper triangle of the inv-cov matrix for *all* measures considered (including placeholders).
                // The C++ code is subtle here.
                // Let's stick to the provided JS Mahalanobis loop if it was based on a closer interpretation
                // of the C++ iterators. The key is how iter_InvertedCovariances is advanced in C++.
                // "for (vec_Floats::iterator iter_Deviation = af_Deviations.begin(); ... )
                //   for (vec_Floats::iterator iter_TranspDeviation = af_Deviations.begin(); ... )
                //     if (uc_InvCovariancesMatrixColumnIndex >= uc_InvCovariancesMatrixRowIndex)
                //       ... ++iter_InvertedCovariances"
                // This implies iter_InvertedCovariances is advanced for each upper-triangular element of the *full* deviation vector space.
                // If af_Deviations[i] or [j] is 0 (because it was a directional measure), the term is 0.

                for (let i = 0; i < numTotalMeasuresInDeviationVector; ++i) {
                    for (let j = i; j < numTotalMeasuresInDeviationVector; ++j) {
                        if (iter_InvertedCovariances_idx >= this.mpst_MoveClassifier.maf_InvertedCovariances.length) {
                            msp_assert(false, "Ran out of inverted covariance elements during Mahalanobis calculation.");
                            this.mf_LastMoveStatisticalDistance = HUGE_POSITIVE_VALUE;
                            return this.mf_LastMoveStatisticalDistance;
                        }

                        let term = af_Deviations[i] * af_Deviations[j] * this.mpst_MoveClassifier.maf_InvertedCovariances[iter_InvertedCovariances_idx];
                        if (i !== j) {
                            term *= 2.0;
                        }
                        f_SqrStatisticalDistance += term;
                        iter_InvertedCovariances_idx++;
                    }
                }
            }


            if (uc_MeasuresUsedForScoringCount === 0) {
                this.mf_LastMoveStatisticalDistance = HUGE_POSITIVE_VALUE;
            } else {
                // Ensure f_SqrStatisticalDistance is non-negative before sqrt
                this.mf_LastMoveStatisticalDistance = Math.sqrt(Math.max(0, f_SqrStatisticalDistance) / uc_MeasuresUsedForScoringCount);
            }
            return this.mf_LastMoveStatisticalDistance;
        }

        fGetLastMoveRatioScore() {
            const f_LastMoveStatisticalDistance = this.fGetLastMoveStatisticalDistance();
            if (f_LastMoveStatisticalDistance < 0) return 0.0; // Error case from fGetLastMoveStatisticalDistance
            return ScoreManager.ToolsInterface.fGetRatioScoreFromStatisticalDistance(f_LastMoveStatisticalDistance, this.mf_MoveStatDistLowThreshold, this.mf_MoveStatDistHighThreshold);
        }

        fGetLastMovePercentageScore() {
            return 100.0 * this.fGetLastMoveRatioScore();
        }

        fGetLastMoveEnergyAmount(_f_AccelDevNormOverAccelNormUseRatio = 0.1) {
            if (this.maf_EnergyMeansResultsAtMoveEnd.length < 2) {
                msp_assert(false, "Movespace LIB : ScoreManager::fGetLastMoveEnergyAmount() called but some energy means results are missing.");
                return -1.0;
            }
            _f_AccelDevNormOverAccelNormUseRatio = Clamp(_f_AccelDevNormOverAccelNormUseRatio, 0.0, 1.0);

            let f_AccelNormAverageStartingFromZero = this.maf_EnergyMeansResultsAtMoveEnd[0] - 1.0;
            if (f_AccelNormAverageStartingFromZero < 0.0) {
                f_AccelNormAverageStartingFromZero = 0.0;
            }
            return (1.0 - _f_AccelDevNormOverAccelNormUseRatio) * f_AccelNormAverageStartingFromZero + _f_AccelDevNormOverAccelNormUseRatio * this.maf_EnergyMeansResultsAtMoveEnd[1];
        }

        fGetLastMoveEnergyFactor(_f_AccelDevNormOverAccelNormUseRatio = 0.5) {
            if (this.maf_EnergyMeansResultsAtMoveEnd.length < 2) {
                msp_assert(false, "Movespace LIB : ScoreManager::fGetLastMoveEnergyFactor() called but energy means results missing.");
                return -1.0;
            }
            if (this.mpst_MoveClassifier.maf_EnergyMeans.length < 2) {
                msp_assert(false, "Movespace LIB : ScoreManager::fGetLastMoveEnergyFactor() called but classifier lacks energy data.");
                return -1.0;
            }
            if (this.mpst_MoveClassifier.ml_ScoringAlgorithmType === 0) { // Already checked by maf_EnergyMeans.length usually
                msp_assert(false, "Movespace LIB : fGetLastMoveEnergyFactor() no useable classifier.");
                return -1.0;
            }
            _f_AccelDevNormOverAccelNormUseRatio = Clamp(_f_AccelDevNormOverAccelNormUseRatio, 0.0, 1.0);

            let factor1 = 0, factor2 = 0;
            if (this.mpst_MoveClassifier.maf_EnergyMeans[0] !== 0) {
                factor1 = this.maf_EnergyMeansResultsAtMoveEnd[0] / this.mpst_MoveClassifier.maf_EnergyMeans[0];
            }
            if (this.mpst_MoveClassifier.maf_EnergyMeans[1] !== 0) {
                factor2 = this.maf_EnergyMeansResultsAtMoveEnd[1] / this.mpst_MoveClassifier.maf_EnergyMeans[1];
            }
            return (1.0 - _f_AccelDevNormOverAccelNormUseRatio) * factor1 + _f_AccelDevNormOverAccelNormUseRatio * factor2;
        }

        fGetSignalValue(_uc_SignalId) {
            const p_Signal = this.pGetSignalById(_uc_SignalId);
            return p_Signal ? p_Signal.fGetValue() : HUGE_NEGATIVE_VALUE;
        }

        bUpdateFromProgressRatioAndAccels(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ) {
            let b_SignalsAndMeasuresHaveBeenUpdated = false;

            if (this.mf_CurrentSignalSmoothingFrequency <= 0) { // No smoothing or invalid
                this.UpdateSignalsAndMeasures(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ);
                b_SignalsAndMeasuresHaveBeenUpdated = true;
            } else {
                if (_f_ProgressRatio > this.mf_SignalSmoothingNextProgressRatio) {
                    const f_SignalSmoothingStepSizeInProgressRatio = 1.0 / (this.mf_GameMoveDuration * this.mf_CurrentSignalSmoothingFrequency);

                    if (_f_ProgressRatio > this.mf_SignalSmoothingNextProgressRatio + f_SignalSmoothingStepSizeInProgressRatio || this.mul_SignalSmoothing_UpdatesCount === 0) {
                        this.mf_CurrentSignalSmoothingFrequency = -1.0; // Cancel smoothing
                        this.UpdateSignalsAndMeasures(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ);
                    } else {
                        const smoothedProgressRatio = this.mf_SignalSmoothingNextProgressRatio - 0.5 * f_SignalSmoothingStepSizeInProgressRatio;
                        const smoothedAccelX = this.mf_SignalSmoothing_AccelXSum / this.mul_SignalSmoothing_UpdatesCount;
                        const smoothedAccelY = this.mf_SignalSmoothing_AccelYSum / this.mul_SignalSmoothing_UpdatesCount;
                        const smoothedAccelZ = this.mf_SignalSmoothing_AccelZSum / this.mul_SignalSmoothing_UpdatesCount;

                        this.UpdateSignalsAndMeasures(smoothedProgressRatio, smoothedAccelX, smoothedAccelY, smoothedAccelZ);

                        this.mf_SignalSmoothingNextProgressRatio += f_SignalSmoothingStepSizeInProgressRatio;
                        this.mul_SignalSmoothing_UpdatesCount = 0;
                        this.mf_SignalSmoothing_AccelXSum = 0.0;
                        this.mf_SignalSmoothing_AccelYSum = 0.0;
                        this.mf_SignalSmoothing_AccelZSum = 0.0;
                    }
                    b_SignalsAndMeasuresHaveBeenUpdated = true;
                }

                if (this.mf_CurrentSignalSmoothingFrequency > 0) {
                    this.mul_SignalSmoothing_UpdatesCount++;
                    this.mf_SignalSmoothing_AccelXSum += _f_AccelX;
                    this.mf_SignalSmoothing_AccelYSum += _f_AccelY;
                    this.mf_SignalSmoothing_AccelZSum += _f_AccelZ;
                }
            }
            return b_SignalsAndMeasuresHaveBeenUpdated;
        }

        fGetAutoCorrelationValidationTime(_f_StepTimeShift, _f_MaxTimeShift, _f_ValidationRatioThreshold, _b_DontComputeIfIgnored = false) {
            if ((_b_DontComputeIfIgnored && (this.mul_CustomizationFlags & EClassifierCustomizationFlags.eCCF_IgnoreAutoCorrelation)) || _f_ValidationRatioThreshold === -1.0) {
                return -6.0;
            }

            this.CenterAutoCorrelationSignalIfNotPerformedAlready();

            const f_NonShiftedAutoCorrelationNormalizedIntegral = this.fComputeAutoCorrelationNormalizedIntegral(0.0);
            if (f_NonShiftedAutoCorrelationNormalizedIntegral === -1.0 || f_NonShiftedAutoCorrelationNormalizedIntegral === 0.0) { // Check for 0 to avoid division by zero
                return -7.0;
            }

            let f_MinAutoCorrelationRatio = HUGE_POSITIVE_VALUE;
            const f_PermissiveMaxTimeShift = _f_MaxTimeShift + 0.001;

            for (let f_TimeShift = _f_StepTimeShift; f_TimeShift < f_PermissiveMaxTimeShift; f_TimeShift += _f_StepTimeShift) {
                const f_AutoCorrelationNormalizedIntegral = this.fComputeAutoCorrelationNormalizedIntegral(f_TimeShift);
                if (f_AutoCorrelationNormalizedIntegral === -1.0) {
                    return -8.0;
                }
                const f_AutoCorrelationRatio = f_AutoCorrelationNormalizedIntegral / f_NonShiftedAutoCorrelationNormalizedIntegral;

                if (f_AutoCorrelationRatio < f_MinAutoCorrelationRatio) {
                    f_MinAutoCorrelationRatio = f_AutoCorrelationRatio;
                }

                if (f_MinAutoCorrelationRatio < 0.0 && f_AutoCorrelationRatio > _f_ValidationRatioThreshold) {
                    return (this.mul_CustomizationFlags & EClassifierCustomizationFlags.eCCF_IgnoreAutoCorrelation) ? -f_TimeShift : f_TimeShift;
                }
            }
            return -9.0;
        }

        CreateSignalsAndMeasures(_u64_MeasuresSetBitfield) {
            _u64_MeasuresSetBitfield = BigInt(_u64_MeasuresSetBitfield);

            this.CreateBaseSignal(eSignalsIds.eSignalId_Base_ProgressRatio);
            this.CreateBaseSignal(eSignalsIds.eSignalId_Base_Ax);
            this.CreateBaseSignal(eSignalsIds.eSignalId_Base_Ay);
            this.CreateBaseSignal(eSignalsIds.eSignalId_Base_Az);

            const ast_SignalDefs = [
                new stSignalDefinition(eSignalsIds.eSignalId_AxDev, eSignalCalcIds.eSignalCalcId_Derivative, eSignalsIds.eSignalId_Base_Ax, eSignalsIds.eSignalId_Base_ProgressRatio),
                new stSignalDefinition(eSignalsIds.eSignalId_AyDev, eSignalCalcIds.eSignalCalcId_Derivative, eSignalsIds.eSignalId_Base_Ay, eSignalsIds.eSignalId_Base_ProgressRatio),
                new stSignalDefinition(eSignalsIds.eSignalId_AzDev, eSignalCalcIds.eSignalCalcId_Derivative, eSignalsIds.eSignalId_Base_Az, eSignalsIds.eSignalId_Base_ProgressRatio),
                new stSignalDefinition(eSignalsIds.eSignalId_AccelNorm, eSignalCalcIds.eSignalCalcId_Norm3D, eSignalsIds.eSignalId_Base_Ax, eSignalsIds.eSignalId_Base_Ay, eSignalsIds.eSignalId_Base_Az),
                new stSignalDefinition(eSignalsIds.eSignalId_AccelDevNorm, eSignalCalcIds.eSignalCalcId_Norm3D, eSignalsIds.eSignalId_AxDev, eSignalsIds.eSignalId_AyDev, eSignalsIds.eSignalId_AzDev),
                new stSignalDefinition(eSignalsIds.eSignalId_AccelNormAvg_NP, eSignalCalcIds.eSignalCalcId_Average, eSignalsIds.eSignalId_AccelNorm),
                new stSignalDefinition(eSignalsIds.eSignalId_AccelDevNormAvg_NP, eSignalCalcIds.eSignalCalcId_Average, eSignalsIds.eSignalId_AccelDevNorm),
                new stSignalDefinition(eSignalsIds.eSignalId_AxDevAvg_Dir_NP, eSignalCalcIds.eSignalCalcId_Average, eSignalsIds.eSignalId_AxDev),
                new stSignalDefinition(eSignalsIds.eSignalId_AyDevAvg_Dir_NP, eSignalCalcIds.eSignalCalcId_Average, eSignalsIds.eSignalId_AyDev),
                new stSignalDefinition(eSignalsIds.eSignalId_AzDevAvg_Dir_NP, eSignalCalcIds.eSignalCalcId_Average, eSignalsIds.eSignalId_AzDev),
            ];

            const ast_MeasureDefs = [
                new stMeasureDefinition(eMeasuresIds.eMeasureId_AccelNormAvg_NP, eMeasureCalcIds.eMeasureCalcId_SplitToNParts, eSignalsIds.eSignalId_AccelNormAvg_NP, eSignalsIds.eSignalId_Base_ProgressRatio),
                new stMeasureDefinition(eMeasuresIds.eMeasureId_AccelDevNormAvg_NP, eMeasureCalcIds.eMeasureCalcId_SplitToNParts, eSignalsIds.eSignalId_AccelDevNormAvg_NP, eSignalsIds.eSignalId_Base_ProgressRatio),
                new stMeasureDefinition(eMeasuresIds.eMeasureId_AxDevAvg_Dir_NP, eMeasureCalcIds.eMeasureCalcId_SplitToNParts, eSignalsIds.eSignalId_AxDevAvg_Dir_NP, eSignalsIds.eSignalId_Base_ProgressRatio),
                new stMeasureDefinition(eMeasuresIds.eMeasureId_AyDevAvg_Dir_NP, eMeasureCalcIds.eMeasureCalcId_SplitToNParts, eSignalsIds.eSignalId_AyDevAvg_Dir_NP, eSignalsIds.eSignalId_Base_ProgressRatio),
                new stMeasureDefinition(eMeasuresIds.eMeasureId_AzDevAvg_Dir_NP, eMeasureCalcIds.eMeasureCalcId_SplitToNParts, eSignalsIds.eSignalId_AzDevAvg_Dir_NP, eSignalsIds.eSignalId_Base_ProgressRatio),
            ];

            const ast_WishedMeasures = [];
            const u64_EnergyRequiredMeasuresBitfield = BigInt(ENERGY_REQUIRED_MEASURES_BITFIELD);

            for (let uc_MeasureId = 0; uc_MeasureId < eMeasuresIds.eMeasureId_COUNT; ++uc_MeasureId) {
                if ((_u64_MeasuresSetBitfield & (BigInt(1) << BigInt(uc_MeasureId))) !== BigInt(0)) {
                    const b_AlsoUsedForEnergy = this.mb_EnergyComputationIsRequired && ((u64_EnergyRequiredMeasuresBitfield & (BigInt(1) << BigInt(uc_MeasureId))) !== BigInt(0));
                    ast_WishedMeasures.push(new stWishedMeasures(uc_MeasureId, true, b_AlsoUsedForEnergy));
                }
            }

            if (this.mb_EnergyComputationIsRequired) {
                for (let uc_MeasureId = 0; uc_MeasureId < eMeasuresIds.eMeasureId_COUNT; ++uc_MeasureId) {
                    if ((u64_EnergyRequiredMeasuresBitfield & (BigInt(1) << BigInt(uc_MeasureId))) !== BigInt(0)) {
                        if (!((_u64_MeasuresSetBitfield & (BigInt(1) << BigInt(uc_MeasureId))) !== BigInt(0))) {
                            ast_WishedMeasures.push(new stWishedMeasures(uc_MeasureId, false, true));
                        }
                    }
                }
            }

            for (const wishedMeasure of ast_WishedMeasures) {
                for (const measureDef of ast_MeasureDefs) {
                    if (measureDef.muc_MeasureId === wishedMeasure.muc_Id) {
                        this.CreateMeasureAndNeededAdvancedSignals(measureDef, ast_SignalDefs, wishedMeasure.mb_UsedForScoringComputation, wishedMeasure.mb_UsedForEnergyComputation);
                    }
                }
            }
        }

        CreateBaseSignal(_uc_SignalId) {
            this.mast_Signals.push(new stSignal(_uc_SignalId, new BaseSignal()));
        }

        CreateAdvancedSignalIfNotDoneYet(_uc_SignalId, _ast_SignalDefs) {
            for (const signalDef of _ast_SignalDefs) {
                if (signalDef.muc_SignalId === _uc_SignalId) {
                    if (signalDef.mb_MarkedAsUsed) continue;

                    for (const sourceSignalId of signalDef.mauc_SourceSignalIds) {
                        if (sourceSignalId > eSignalsIds.eSignalId_Base_Az) {
                            this.CreateAdvancedSignalIfNotDoneYet(sourceSignalId, _ast_SignalDefs);
                        }
                    }

                    const sourceSignals = signalDef.mauc_SourceSignalIds.map(id => this.pGetSignalById(id));
                    if (sourceSignals.some(s => !s)) {
                        msp_assert(false, `Movespace LIB : Source signal not found for creating advanced signal ${_uc_SignalId}.`);
                        return;
                    }

                    let p_Signal = null;
                    switch (signalDef.me_CalculusId) {
                        case eSignalCalcIds.eSignalCalcId_Derivative:
                            p_Signal = new Signal_Derivative(sourceSignals[0], sourceSignals[1]);
                            break;
                        case eSignalCalcIds.eSignalCalcId_Norm3D:
                            p_Signal = new Signal_Norm3D(sourceSignals[0], sourceSignals[1], sourceSignals[2]);
                            break;
                        case eSignalCalcIds.eSignalCalcId_Average:
                            p_Signal = new Signal_Average(sourceSignals[0]);
                            break;
                        case eSignalCalcIds.eSignalCalcId_None: break;
                        default: msp_assert(false, `Unknown calculus ID ${signalDef.me_CalculusId}`); return;
                    }

                    if (p_Signal) {
                        if (sourceSignals.some(s => !s.bMustUpdateFirstTimeAsNextTimes())) {
                            p_Signal.SetMustUpdateFirstTimeAsNextTimes(false);
                        }
                        this.mast_Signals.push(new stSignal(_uc_SignalId, p_Signal));
                    }
                    signalDef.mb_MarkedAsUsed = true;
                    return;
                }
            }
        }

        CreateMeasureAndNeededAdvancedSignals(_st_MeasureDef, _ast_SignalDefs, _b_UsedForScoringComputation, _b_UsedForEnergyComputation) {
            for (const signalId of _st_MeasureDef.mauc_SourceSignalIds) {
                // Base signals (<= eSignalId_Base_Az) are already created.
                // eSignalId_Base_ProgressRatio (0) might be in mauc_SourceSignalIds for Measure_ValueInPart
                if (signalId > eSignalsIds.eSignalId_Base_Az || this.pGetSignalById(signalId) === null) {
                    this.CreateAdvancedSignalIfNotDoneYet(signalId, _ast_SignalDefs);
                }
            }

            const sourceSignals = _st_MeasureDef.mauc_SourceSignalIds.map(id => this.pGetSignalById(id));
            if (sourceSignals.some(s => !s)) {
                msp_assert(false, `Movespace LIB : Source signal not found for creating measure ${_st_MeasureDef.muc_MeasureId}. Required IDs: ${_st_MeasureDef.mauc_SourceSignalIds.join(',')}`);
                return;
            }

            switch (_st_MeasureDef.me_CalculusId) {
                case eMeasureCalcIds.eMeasureCalcId_SplitToNParts: {
                    // The source signal for this measure (sourceSignals[0]) is already an
                    // average signal (e.g., Signal_Average of AccelNorm). The C++ logic
                    // creates a measure that simply reads the *final value* of this running
                    // average signal within a specific time part.
                    const sourceSignalToRead = sourceSignals[0]; // This is the Signal_Average instance
                    const progressSignal = sourceSignals[1];     // This is the ProgressRatio signal

                    if (!sourceSignalToRead || !progressSignal) {
                        msp_assert(false, `Missing source signals for SplitToNParts measure ${_st_MeasureDef.muc_MeasureId}`);
                        return;
                    }
                    
                    for (let uc_PartIndex = 1; uc_PartIndex <= this.muc_MoveAnalysisPartsCount; ++uc_PartIndex) {
                        // We use Measure_ValueInPart, which is designed to grab the value of a source
                        // signal during a specific window. This correctly implements the C++ behavior.
                        const p_Measure = new Measure_ValueInPart(sourceSignalToRead, progressSignal, uc_PartIndex, this.muc_MoveAnalysisPartsCount);
                        this.mast_Measures.push(new stMeasure(_st_MeasureDef.muc_MeasureId, p_Measure, _b_UsedForScoringComputation, _b_UsedForEnergyComputation, uc_PartIndex));
                    }
                    break;
                }
                default: msp_assert(false, `Unknown measure calculus ID ${_st_MeasureDef.me_CalculusId}`); return;
            }
        }

        SetBaseSignalValue(_uc_SignalId, _f_Value) {
            const signalContainer = this.mast_Signals.find(s => s.muc_Id === _uc_SignalId);
            if (signalContainer && signalContainer.mp_Signal instanceof BaseSignal) {
                signalContainer.mp_Signal.SetValue(_f_Value);
            } else {
                msp_assert(false, `Movespace LIB : cannot set base signal value for ID ${_uc_SignalId}. Not found or not a BaseSignal.`);
            }
        }

        DestroySignalsAndMeasures() {
            this.mast_Signals = [];
            this.mast_Measures = [];
        }

        ResetSignalsAndMeasures() {
            for (const signalContainer of this.mast_Signals) {
                signalContainer.mp_Signal.ResetParams();
            }
            for (const measureContainer of this.mast_Measures) {
                measureContainer.mp_Measure.ResetParams();
            }
        }

        UpdateSignalsAndMeasures(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ) {
            this.SetBaseSignalValue(eSignalsIds.eSignalId_Base_ProgressRatio, _f_ProgressRatio);
            this.SetBaseSignalValue(eSignalsIds.eSignalId_Base_Ax, _f_AccelX);
            this.SetBaseSignalValue(eSignalsIds.eSignalId_Base_Ay, _f_AccelY);
            this.SetBaseSignalValue(eSignalsIds.eSignalId_Base_Az, _f_AccelZ);

            if (this.mb_FirstUpdateHasOccurred) {
                for (const signalContainer of this.mast_Signals) {
                    signalContainer.mp_Signal.Update();
                    if (signalContainer.muc_Id === eSignalsIds.eSignalId_AccelNorm) {
                        this.StoreAutoCorrelationAccelNormSample(_f_ProgressRatio, signalContainer.mp_Signal.fGetValue());
                    }
                }
                for (const measureContainer of this.mast_Measures) {
                    measureContainer.mp_Measure.Update();
                }
            } else {
                for (const signalContainer of this.mast_Signals) {
                    if (signalContainer.mp_Signal.bMustUpdateFirstTimeAsNextTimes()) {
                        signalContainer.mp_Signal.Update();
                    } else {
                        signalContainer.mp_Signal.UpdateSpeciallyForFirstTime();
                    }
                    if (signalContainer.muc_Id === eSignalsIds.eSignalId_AccelNorm) {
                        this.StoreAutoCorrelationAccelNormSample(_f_ProgressRatio, signalContainer.mp_Signal.fGetValue());
                    }
                }
                for (const measureContainer of this.mast_Measures) {
                    if (measureContainer.mp_Measure.bMustUpdateFirstTimeAsNextTimes()) {
                        measureContainer.mp_Measure.Update();
                    } else {
                        measureContainer.mp_Measure.UpdateSpeciallyForFirstTime();
                    }
                }
                this.mb_FirstUpdateHasOccurred = true;
            }
        }

        StoreAutoCorrelationAccelNormSample(_f_ProgressRatio, _f_AccelNorm) {
            if (this.mf_GameMoveDuration > 0) { // Only store if move duration is valid
                this.mast_AutoCorrelationSignal.push(new stAutoCorrelationAccelNormSample(_f_ProgressRatio * this.mf_GameMoveDuration, _f_AccelNorm));
                this.mf_AutoCorrelationAccelNormsSum += _f_AccelNorm;
            }
        }

        pGetSignalById(_uc_SignalId) {
            const signalContainer = this.mast_Signals.find(s => s.muc_Id === _uc_SignalId);
            return signalContainer ? signalContainer.mp_Signal : null;
        }

        ClearMoveClassifierStruct() {
            this.mpst_MoveClassifier = new stMoveClassifier();
        }

        bFillMoveClassifierStructFromFileData(dataView, fileIsLittleEndian, c_ClassifierFormatCompatibilityOffset) {
            // This method now takes an existing DataView and its properties
            let currentOffset = CLASSIFIER_FILE_DATA_POSITION_MEANS_COUNT_V7BASE - c_ClassifierFormatCompatibilityOffset;
            this.mpst_MoveClassifier.ml_ScoringAlgorithmType = dataView.getInt32(currentOffset, fileIsLittleEndian);
            if (this.mpst_MoveClassifier.ml_ScoringAlgorithmType === 0) {
                msp_assert(false, "ScoringAlgorithmType is 0 in classifier data.");
                return false;
            }
            currentOffset += 4;

            const uc_MeansCount = Math.abs(this.mpst_MoveClassifier.ml_ScoringAlgorithmType);
            const ui_InvertedCovariancesCount = (this.mpst_MoveClassifier.ml_ScoringAlgorithmType > 0) ? uc_MeansCount : (uc_MeansCount * (uc_MeansCount + 1) / 2);

            const uc_EnergyMeansCount = dataView.getUint32(currentOffset, fileIsLittleEndian);
            currentOffset += 4; // For energy means count
            // const uc_SubClassifiersCount = dataView.getUint32(currentOffset, fileIsLittleEndian); // Ignored
            currentOffset += 4; // For sub-classifiers count (advancing offset)

            // Check file size
            // currentOffset now points to the start of the actual data (Means array)
            const expectedDataSize = (uc_MeansCount + ui_InvertedCovariancesCount + uc_EnergyMeansCount) * 4; // 4 bytes per float
            const headerSize = CLASSIFIER_FILE_HEADER_SIZE_V7BASE - c_ClassifierFormatCompatibilityOffset;

            if (dataView.buffer.byteLength !== headerSize + expectedDataSize) {
                console.warn(`Classifier file size mismatch. Expected: ${headerSize + expectedDataSize}, Got: ${dataView.buffer.byteLength}. HeaderSize: ${headerSize}, DataSize: ${expectedDataSize}`);
                msp_assert(false, "Classifier file size mismatch.");
                return false;
            }

            this.mpst_MoveClassifier.maf_Means = [];
            for (let i = 0; i < uc_MeansCount; ++i) {
                if (currentOffset + 4 > dataView.buffer.byteLength) { msp_assert(false, "EOF reading means."); return false; }
                this.mpst_MoveClassifier.maf_Means.push(dataView.getFloat32(currentOffset, fileIsLittleEndian));
                currentOffset += 4;
            }

            this.mpst_MoveClassifier.maf_InvertedCovariances = [];
            for (let i = 0; i < ui_InvertedCovariancesCount; ++i) {
                if (currentOffset + 4 > dataView.buffer.byteLength) { msp_assert(false, "EOF reading inv covariances."); return false; }
                this.mpst_MoveClassifier.maf_InvertedCovariances.push(dataView.getFloat32(currentOffset, fileIsLittleEndian));
                currentOffset += 4;
            }

            this.mpst_MoveClassifier.maf_EnergyMeans = [];
            for (let i = 0; i < uc_EnergyMeansCount; ++i) {
                if (currentOffset + 4 > dataView.buffer.byteLength) { msp_assert(false, "EOF reading energy means."); return false; }
                this.mpst_MoveClassifier.maf_EnergyMeans.push(dataView.getFloat32(currentOffset, fileIsLittleEndian));
                currentOffset += 4;
            }
            return true;
        }


        fComputeSqrDistFromAccelAvgResultAndClassifierData(arg1, arg2, arg3) {
            let _v_AccelAvgResult, _v_AccelAvgMean, _v_AccelAvgInvertedCovariance;
            if (arg1 instanceof stPartAccelAvg) {
                const _st_PartAccelAvg = arg1;
                _v_AccelAvgResult = _st_PartAccelAvg.mv_PartAccelAvgResults;
                _v_AccelAvgMean = _st_PartAccelAvg.mv_PartAccelAvgMeans;
                _v_AccelAvgInvertedCovariance = _st_PartAccelAvg.mv_PartAccelAvgInvertedCovariances;
            } else {
                _v_AccelAvgResult = arg1;
                _v_AccelAvgMean = arg2;
                _v_AccelAvgInvertedCovariance = arg3;
            }

            const termX = Math.pow(_v_AccelAvgResult.x - _v_AccelAvgMean.x, 2) * _v_AccelAvgInvertedCovariance.x;
            const termY = Math.pow(_v_AccelAvgResult.y - _v_AccelAvgMean.y, 2) * _v_AccelAvgInvertedCovariance.y;
            const termZ = Math.pow(_v_AccelAvgResult.z - _v_AccelAvgMean.z, 2) * _v_AccelAvgInvertedCovariance.z;
            return (termX + termY + termZ) / 3.0;
        }

        ucGetMoveAnalysisPartsCounts(_f_MoveDuration) {
            if (this.mul_ClassifierFormatVersionNumberToUse === CLASSIFIER_FORMAT_VERSION_NUMBER_FORCE10PARTS) {
                return 10;
            }
            if (ACCEL_SAMPLES_MIN_COUNT_PER_PART_AT_30_FPS === 0) return 1;
            let parts = Math.floor(_f_MoveDuration * 30.0 / ACCEL_SAMPLES_MIN_COUNT_PER_PART_AT_30_FPS);
            return Math.max(1, parts);
        }

        CenterAutoCorrelationSignalIfNotPerformedAlready() {
            if (!this.mb_AutoCorrelationSignalHasAlreadyBeenCentered && this.mast_AutoCorrelationSignal.length > 0) {
                const f_TranslateToCenterOffset = this.mf_AutoCorrelationAccelNormsSum / this.mast_AutoCorrelationSignal.length;
                for (const sample of this.mast_AutoCorrelationSignal) {
                    sample.mf_AccelNorm -= f_TranslateToCenterOffset;
                }
                this.mb_AutoCorrelationSignalHasAlreadyBeenCentered = true;
            }
        }

        fComputeAutoCorrelationNormalizedIntegral(_f_TimeShift) {
            if (this.mast_AutoCorrelationSignal.length < 2) return -1.0;

            let iter_ShiftedAutoCorrelationSignal_idx = 0;
            if (_f_TimeShift > 0.0) {
                const iter_AutoCorrelationLastElement_idx = this.mast_AutoCorrelationSignal.length - 1;
                while (iter_ShiftedAutoCorrelationSignal_idx < iter_AutoCorrelationLastElement_idx) {
                    if (this.mast_AutoCorrelationSignal[iter_ShiftedAutoCorrelationSignal_idx].mf_Time > _f_TimeShift) break;
                    iter_ShiftedAutoCorrelationSignal_idx++;
                }
                if (iter_ShiftedAutoCorrelationSignal_idx >= this.mast_AutoCorrelationSignal.length - 1) return -1.0;
            }

            let iter_AutoCorrelationSignal_idx = 0;
            if (iter_ShiftedAutoCorrelationSignal_idx >= this.mast_AutoCorrelationSignal.length || iter_AutoCorrelationSignal_idx >= this.mast_AutoCorrelationSignal.length) return -1.0; // Not enough points after shift


            let f_PrevAccelNormProduct = this.mast_AutoCorrelationSignal[iter_AutoCorrelationSignal_idx].mf_AccelNorm * this.mast_AutoCorrelationSignal[iter_ShiftedAutoCorrelationSignal_idx].mf_AccelNorm;
            let f_PrevAccelTime = 0.5 * (this.mast_AutoCorrelationSignal[iter_AutoCorrelationSignal_idx].mf_Time + this.mast_AutoCorrelationSignal[iter_ShiftedAutoCorrelationSignal_idx].mf_Time);

            iter_AutoCorrelationSignal_idx++;
            iter_ShiftedAutoCorrelationSignal_idx++;

            let f_IntegralResult = 0.0;
            let f_IntegrationTotalTime = 0.0;

            while (iter_ShiftedAutoCorrelationSignal_idx < this.mast_AutoCorrelationSignal.length) {
                const curSample = this.mast_AutoCorrelationSignal[iter_AutoCorrelationSignal_idx];
                const shiftedSample = this.mast_AutoCorrelationSignal[iter_ShiftedAutoCorrelationSignal_idx];

                const f_CurAccelNormsProduct = curSample.mf_AccelNorm * shiftedSample.mf_AccelNorm;
                const f_CurAccelTime = 0.5 * (curSample.mf_Time + shiftedSample.mf_Time);
                const f_DeltaTime = f_CurAccelTime - f_PrevAccelTime;

                if (f_DeltaTime > 0) {
                    f_IntegralResult += 0.5 * (f_PrevAccelNormProduct + f_CurAccelNormsProduct) * f_DeltaTime;
                    f_IntegrationTotalTime += f_DeltaTime;
                }

                f_PrevAccelNormProduct = f_CurAccelNormsProduct;
                f_PrevAccelTime = f_CurAccelTime;

                iter_AutoCorrelationSignal_idx++;
                iter_ShiftedAutoCorrelationSignal_idx++;
            }
            return (f_IntegrationTotalTime === 0) ? 0.0 : (f_IntegralResult / f_IntegrationTotalTime);
        }

        ModifyTuningParam_LowDistanceTheshold(_f_LowDistanceThesholdModifier) { this.mf_LowDistanceThresholdModifier = _f_LowDistanceThesholdModifier; }
        ModifyTuningParam_HighDistanceTheshold(_f_HighDistanceThesholdModifier) { this.mf_HighDistanceThresholdModifier = _f_HighDistanceThesholdModifier; }
        ModifyTuningParam_ShakeSensitivity(_f_ShakeSensitivityModifier) { this.mf_ShakeSensitivityModifier = _f_ShakeSensitivityModifier; }
        ModifyTuningParam_DirectionSensitivity(_f_DirectionSensitivityModifier) { this.mf_DirectionSensitivityModifier = _f_DirectionSensitivityModifier; }

        static bIsEndiannessSwapRequired(dataViewInstance) {
            if (dataViewInstance.byteLength < 4) return true; // Not enough data to check, assume worst
            // If the int32 read as little-endian is NOT 1, a swap is required (file is Big Endian).
            return dataViewInstance.getInt32(CLASSIFIER_FILE_DATA_POSITION_ENDIANNESS, true) !== 1;
        }

        static cGetClassifierFormatCompatibilityOffset(dataViewInstance, formatVersion) {
            // Takes DataView and already parsed formatVersion
            let offset;
            switch (formatVersion) {
                case CLASSIFIER_FORMAT_VERSION_NUMBER_FORCE10PARTS:
                case CLASSIFIER_FORMAT_VERSION_NUMBER_WITHOUT_AC_AND_DIR_SETTINGS:
                    offset = 2 * 4; // Two float fields (AutoCorrelationThreshold, DirectionImpactFactor) are missing
                    break;
                case CLASSIFIER_FORMAT_VERSION_NUMBER_WITH_AC_AND_DIR_SETTINGS:
                case CLASSIFIER_FORMAT_VERSION_NUMBER_SUBCLASSIFIERS_SUPPORT: // Assuming subclassifier support doesn't change these specific offsets
                    offset = 0;
                    break;
                default:
                    console.warn("MSP_LIB: Unknown classifier format version: " + formatVersion);
                    return -1; // Unknown version
            }
            // Check against the size of the header structure that *would* exist for V7+
            if (dataViewInstance.buffer.byteLength < CLASSIFIER_FILE_HEADER_SIZE_V7BASE - offset) {
                console.warn("MSP_LIB: Classifier file too small for its version and compatibility offset.");
                return -1; // File too small
            }
            return offset;
        }
    }

    ScoreManager.GameInterface = class {
        constructor(_p_ParentScoreManager) { this.mp_ParentScoreManager = _p_ParentScoreManager; }
        Init(_f_DefaultStatDistLowThreshold = -1.0, _f_DefaultStatDistHighThreshold = -1.0, _f_DefaultAutoCorrelationThreshold = -1.0, _f_DefaultDirectionImpactFactor = -1.0, _f_SignalSmoothingFrequency = -1.0) { this.mp_ParentScoreManager.InitForScoring(_f_DefaultStatDistLowThreshold, _f_DefaultStatDistHighThreshold, _f_DefaultAutoCorrelationThreshold, _f_DefaultDirectionImpactFactor, _f_SignalSmoothingFrequency); }
        bStartMoveAnalysis(classifierFileData, gameMoveDuration) { return this.mp_ParentScoreManager.bStartMoveAnalysis(classifierFileData, gameMoveDuration); }
        StopMoveAnalysis() { this.mp_ParentScoreManager.StopMoveAnalysis(); }
        UpdateFromProgressRatioAndAccels(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ) { this.mp_ParentScoreManager.bUpdateFromProgressRatioAndAccels(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ); }
        fGetLastMoveRatioScore() { return this.mp_ParentScoreManager.fGetLastMoveRatioScore(); }
        fGetLastMovePercentageScore() { return this.mp_ParentScoreManager.fGetLastMovePercentageScore(); }
        fGetLastMoveEnergyAmount(_f_AccelDevNormOverAccelNormUseRatio = 0.1) { return this.mp_ParentScoreManager.fGetLastMoveEnergyAmount(_f_AccelDevNormOverAccelNormUseRatio); }
        fGetLastMoveEnergyFactor(_f_AccelDevNormOverAccelNormUseRatio = 0.5) { return this.mp_ParentScoreManager.fGetLastMoveEnergyFactor(_f_AccelDevNormOverAccelNormUseRatio); }
        fGetAutoCorrelationValidationTime(_f_StepTimeShift, _f_MaxTimeShift) { return this.mp_ParentScoreManager.fGetAutoCorrelationValidationTime(_f_StepTimeShift, _f_MaxTimeShift, this.mp_ParentScoreManager.mf_MoveAutoCorrelationThreshold, true); }
        bCanComputeDirectionTendency() { return this.mp_ParentScoreManager.bCanComputeDirectionStatDistsByPart(true); }
        fGetDirectionTendencyImpactOnScoreRatio() { return this.mp_ParentScoreManager.fGetDirectionTendencyImpactOnScoreRatio(); }
        ModifyTuningParam_LowDistanceTheshold(_f_LowDistanceThesholdModifier) { this.mp_ParentScoreManager.ModifyTuningParam_LowDistanceTheshold(_f_LowDistanceThesholdModifier); }
        ModifyTuningParam_HighDistanceTheshold(_f_HighDistanceThesholdModifier) { this.mp_ParentScoreManager.ModifyTuningParam_HighDistanceTheshold(_f_HighDistanceThesholdModifier); }
        ModifyTuningParam_ShakeSensitivity(_f_ShakeSensitivityModifier) { this.mp_ParentScoreManager.ModifyTuningParam_ShakeSensitivity(_f_ShakeSensitivityModifier); }
        ModifyTuningParam_DirectionSensitivity(_f_DirectionSensitivityModifier) { this.mp_ParentScoreManager.ModifyTuningParam_DirectionSensitivity(_f_DirectionSensitivityModifier); }
    };

    ScoreManager.ToolsInterface = class {
        constructor(_p_ParentScoreManager) { this.mp_ParentScoreManager = _p_ParentScoreManager; }
        Init(_b_EnergyComputationIsRequired = false, _f_SignalSmoothingFrequency = -1.0, _ul_ClassifierFormatVersionNumberToUse = CLASSIFIER_FORMAT_VERSION_NUMBER_LATEST_OFFICIAL) { this.mp_ParentScoreManager.InitForGeneration(_b_EnergyComputationIsRequired, _f_SignalSmoothingFrequency, _ul_ClassifierFormatVersionNumberToUse); }
        StartMoveAnalysis(_u64_MeasuresSetBitfield, _f_ClassifierMoveDuration, _f_GameMoveDuration) { this.mp_ParentScoreManager.StartMoveAnalysis(_u64_MeasuresSetBitfield, _f_ClassifierMoveDuration, _f_GameMoveDuration, -1.0, -1.0, -1.0, -1.0, 0); }
        StopMoveAnalysis() { this.mp_ParentScoreManager.StopMoveAnalysis(); }
        bUpdateFromProgressRatioAndAccels(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ) { return this.mp_ParentScoreManager.bUpdateFromProgressRatioAndAccels(_f_ProgressRatio, _f_AccelX, _f_AccelY, _f_AccelZ); }
        fGetLastMoveStatisticalDistance() { return this.mp_ParentScoreManager.fGetLastMoveStatisticalDistance(); }
        fGetSignalValue(_uc_SignalId) { return this.mp_ParentScoreManager.fGetSignalValue(_uc_SignalId); }
        CenterAutoCorrelationSignal() { this.mp_ParentScoreManager.CenterAutoCorrelationSignalIfNotPerformedAlready(); }
        fComputeAutoCorrelationNormalizedIntegral(_f_TimeShift) { return this.mp_ParentScoreManager.fComputeAutoCorrelationNormalizedIntegral(_f_TimeShift); }
        fGetAutoCorrelationValidationTime(_f_StepTimeShift, _f_MaxTimeShift, _f_ValidationRatioThreshold) {
            const threshold = (_f_ValidationRatioThreshold === undefined) ? this.mp_ParentScoreManager.mf_MoveAutoCorrelationThreshold : _f_ValidationRatioThreshold;
            return this.mp_ParentScoreManager.fGetAutoCorrelationValidationTime(_f_StepTimeShift, _f_MaxTimeShift, threshold, false);
        }
        bCanComputeDirectionStatDistsByPart() { return this.mp_ParentScoreManager.bCanComputeDirectionStatDistsByPart(false); }
        fGetSureRightDirectionPartsRatio() { return this.mp_ParentScoreManager.fGetSureRightDirectionPartsRatio(); }
        fGetSureWrongDirectionPartsRatio() { return this.mp_ParentScoreManager.fGetSureWrongDirectionPartsRatio(); }
        ucGetLastMoveAnalysisPartsCount() { return this.mp_ParentScoreManager.muc_MoveAnalysisPartsCount; }
        fGetLastMoveStatDistLowThreshold() { return this.mp_ParentScoreManager.mf_MoveStatDistLowThreshold; }
        fGetLastMoveStatDistHighThreshold() { return this.mp_ParentScoreManager.mf_MoveStatDistHighThreshold; }
        fGetLastMoveAutoCorrelationThreshold() { return this.mp_ParentScoreManager.mf_MoveAutoCorrelationThreshold; }
        fGetLastMoveDirectionImpactFactor() { return this.mp_ParentScoreManager.mf_MoveDirectionImpactFactor; }
        pstGetMoveClassifierStruct() { return this.mp_ParentScoreManager.mpst_MoveClassifier; }
        astGetLastMoveNonAccelDirMeasuresResults() { return this.mp_ParentScoreManager.mast_NonAccelDirMeasuresResultsAtMoveEnd; }
        afGetLastMoveEnergyMeansResults() { return this.mp_ParentScoreManager.maf_EnergyMeansResultsAtMoveEnd; }

        static ulGetLatestOfficialClassifierFormatVersionNumber() { return CLASSIFIER_FORMAT_VERSION_NUMBER_LATEST_OFFICIAL; }
        static ulGetHandledClassifierFormatVersionsMinNumber() { return HANDLED_CLASSIFIER_FORMAT_VERSIONS_MIN_NUMBER; }
        static ulGetHandledClassifierFormatVersionsMaxNumber() { return HANDLED_CLASSIFIER_FORMAT_VERSIONS_MAX_NUMBER; }

        static _getDataViewAndProps(classifierFileDataOrView) {
            if (!classifierFileDataOrView) return null;
            const dataView = (classifierFileDataOrView instanceof DataView) ? classifierFileDataOrView : new DataView(classifierFileDataOrView);
            if (dataView.byteLength === 0) return null;

            const b_EndiannessSwapRequired = ScoreManager.bIsEndiannessSwapRequired(dataView);
            const fileIsLittleEndian = !b_EndiannessSwapRequired;
            const formatVersion = dataView.getUint32(CLASSIFIER_FILE_DATA_POSITION_FORMAT_VERSION_NUMBER, fileIsLittleEndian);
            const c_ClassifierFormatCompatibilityOffset = ScoreManager.cGetClassifierFormatCompatibilityOffset(dataView, formatVersion);

            if (c_ClassifierFormatCompatibilityOffset === -1) return null;

            return { dataView, fileIsLittleEndian, formatVersion, c_ClassifierFormatCompatibilityOffset };
        }


        static ulGetClassifierFormatVersionNumberFromFileData(classifierFileDataOrView) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileDataOrView);
            return props ? props.formatVersion : 0; // Return 0 or handle error appropriately
        }

        static getStringFromFileData(dataView, offset, maxLength) {
            let str = "";
            for (let i = 0; i < maxLength; i++) {
                if (offset + i >= dataView.byteLength) break; // Bounds check
                const charCode = dataView.getUint8(offset + i);
                if (charCode === 0) break;
                str += String.fromCharCode(charCode);
            }
            return str;
        }

        static GetMoveNameFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return null;
            return ScoreManager.ToolsInterface.getStringFromFileData(props.dataView, CLASSIFIER_FILE_DATA_POSITION_MOVE_NAME, 64);
        }
        static GetSongNameFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return null;
            return ScoreManager.ToolsInterface.getStringFromFileData(props.dataView, CLASSIFIER_FILE_DATA_POSITION_SONG_NAME, 64);
        }
        static GetMoveMeasureSetBitfieldNameFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return null;
            return ScoreManager.ToolsInterface.getStringFromFileData(props.dataView, CLASSIFIER_FILE_DATA_POSITION_MEASURE_SET_NAME, 64);
        }
        static fGetMoveDurationFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return -1.0;
            return props.dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_DURATION, props.fileIsLittleEndian);
        }
        static fGetMoveStatDistLowThresholdFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return -1.0;
            return props.dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_STAT_DIST_LOW_THRESHOLD, props.fileIsLittleEndian);
        }
        static fGetMoveStatDistHighThresholdFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return -1.0;
            return props.dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_STAT_DIST_HIGH_THRESHOLD, props.fileIsLittleEndian);
        }
        static fGetMoveAutoCorrelationThresholdFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props || props.formatVersion < CLASSIFIER_FORMAT_VERSION_NUMBER_WITH_AC_AND_DIR_SETTINGS) return -1.0;
            return props.dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_AUTOCORRELATION_THRESHOLD, props.fileIsLittleEndian);
        }
        static fGetMoveDirectionImpactFactorFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props || props.formatVersion < CLASSIFIER_FORMAT_VERSION_NUMBER_WITH_AC_AND_DIR_SETTINGS) return -1.0;
            return props.dataView.getFloat32(CLASSIFIER_FILE_DATA_POSITION_DIRECTION_IMPACT_FACTOR, props.fileIsLittleEndian);
        }
        static u64GetMoveMeasureSetBitfieldFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return BigInt(0);
            return props.dataView.getBigUint64(CLASSIFIER_FILE_DATA_POSITION_MEASURES_SET_V7BASE - props.c_ClassifierFormatCompatibilityOffset, props.fileIsLittleEndian);
        }
        static ulGetMoveCustomizationFlagsFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return 0;
            return props.dataView.getUint32(CLASSIFIER_FILE_DATA_POSITION_CUSTOMIZATION_FLAGS_V7BASE - props.c_ClassifierFormatCompatibilityOffset, props.fileIsLittleEndian);
        }
        static ucGetMeasuresCountFromFileData(classifierFileData) { // This is abs(ml_ScoringAlgorithmType)
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return 0;
            const scoringAlgoType = props.dataView.getInt32(CLASSIFIER_FILE_DATA_POSITION_MEANS_COUNT_V7BASE - props.c_ClassifierFormatCompatibilityOffset, props.fileIsLittleEndian);
            return Math.abs(scoringAlgoType);
        }
        static ucGetEnergyMeasuresCountFromFileData(classifierFileData) {
            const props = ScoreManager.ToolsInterface._getDataViewAndProps(classifierFileData);
            if (!props) return 0;
            return props.dataView.getUint32(CLASSIFIER_FILE_DATA_POSITION_ENERGY_MEANS_COUNT_V7BASE - props.c_ClassifierFormatCompatibilityOffset, props.fileIsLittleEndian);
        }
        static fGetRatioScoreFromStatisticalDistance(_f_StatisticalDistance, _f_StatDistLowThreshold, _f_StatDistHighThreshold) {
            let f_RatioScore;
            if (_f_StatDistLowThreshold === -1.0 || _f_StatDistHighThreshold === -1.0 || _f_StatDistLowThreshold === _f_StatDistHighThreshold) {
                f_RatioScore = 0.0;
            } else {
                f_RatioScore = (_f_StatisticalDistance - _f_StatDistHighThreshold) / (_f_StatDistLowThreshold - _f_StatDistHighThreshold);
                f_RatioScore = Clamp(f_RatioScore, 0.0, 1.0);
            }
            return f_RatioScore;
        }
    };

    return {
        eSignalsIds, eMeasuresIds, eSignalCalcIds, eMeasureCalcIds, EClassifierCustomizationFlags,
        HUGE_POSITIVE_VALUE, HUGE_NEGATIVE_VALUE,
        AbstractSignal, BaseSignal, Signal_Derivative, Signal_Norm3D, Signal_Average,
        Measure_ValueInPart, ScoreManager,
        stVec3, stPartAccelAvg, stMoveClassifier, stAutoCorrelationAccelNormSample, stMeasuresResultAtMoveEnd,
        Clamp, msp_assert,
    };

})();

export default MSP_LIB;