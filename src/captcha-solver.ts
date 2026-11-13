// Enhanced CAPTCHA classifier with improved features, edge case handling, and ensemble approach
/** The pinned linear model in captcha-model.json: 528 binary features per letter, 32 labels. */
interface VtopCaptchaModel { labels: string; biases: number[]; weights: number[][] }

/** One reading of a six-letter CAPTCHA with per-letter softmax scores and top-two margins. */
interface VtopCaptchaReading {
  text: string;
  scores: number[];
  margins: number[];
  meanScore: number;
  confidence: number[]; // Per-character confidence (high/medium/low)
  method?: string; // Which enhancement method succeeded
}

interface VtopCaptchaSolverApi {
  validate(model: Partial<VtopCaptchaModel> | null | undefined): VtopCaptchaModel;
  features(rgba: ArrayLike<number>): number[][] | null;
  featuresEnhanced(rgba: ArrayLike<number>): number[][] | null;
  predict(rgba: ArrayLike<number>, model: VtopCaptchaModel): VtopCaptchaReading | null;
  predictWithEnsemble(rgba: ArrayLike<number>, model: VtopCaptchaModel): VtopCaptchaReading | null;
  read(rgba: ArrayLike<number>): Promise<VtopCaptchaReading | null>;
  labels: string;
}
declare var VtopCaptchaSolver: VtopCaptchaSolverApi;

/* Enhanced VTOP saturation classifier
 * Base implementation adapted from levyashvin/VTOP-Captcha-Solver.
 * Copyright (c) 2025 Yuva Yashvin. MIT license: licenses/vtop-captcha-solver.txt.
 * Training/logic credited upstream to ViBoot and VITrendz.
 * Enhancements: multi-scale features, edge detection, preprocessing, ensemble methods.
 */
(() => {
  'use strict';
  const LABELS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // === ENHANCEMENT 1: Advanced Preprocessing ===

  /** Apply contrast enhancement using adaptive histogram equalization */
  function enhanceContrast(rgba: ArrayLike<number>, width: number, height: number): Float64Array {
    const enhanced = new Float64Array(width * height * 4);
    const histogram = new Array(256).fill(0);

    // Build histogram of grayscale values
    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      const gray = Math.round(0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]);
      histogram[gray]++;
    }

    // Calculate cumulative distribution
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + histogram[i];

    // Normalize and apply equalization
    const cdfMin = cdf.find(v => v > 0) || 0;
    const totalPixels = width * height;

    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      for (let c = 0; c < 3; c++) {
        const gray = Math.round(0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]);
        const equalized = Math.round(((cdf[gray] - cdfMin) / (totalPixels - cdfMin)) * 255);
        const factor = equalized / (gray || 1);
        enhanced[offset + c] = Math.min(255, rgba[offset + c] * factor);
      }
      enhanced[offset + 3] = rgba[offset + 3];
    }

    return enhanced;
  }

  /** Apply median filter for noise reduction */
  function medianFilter(rgba: ArrayLike<number>, width: number, height: number): Float64Array {
    const filtered = new Float64Array(rgba.length);
    const window = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // For each color channel
        for (let c = 0; c < 3; c++) {
          window.length = 0;

          // Collect 3x3 neighborhood
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy, nx = x + dx;
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                window.push(rgba[((ny * width + nx) * 4) + c]);
              }
            }
          }

          // Get median
          window.sort((a, b) => a - b);
          filtered[idx + c] = window[Math.floor(window.length / 2)];
        }
        filtered[idx + 3] = rgba[idx + 3];
      }
    }

    return filtered;
  }

  /** Apply adaptive thresholding */
  function adaptiveThreshold(saturation: Float64Array, width: number, height: number): Float64Array {
    const binary = new Float64Array(saturation.length);
    const windowSize = 5;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let sum = 0, count = 0;

        // Calculate local mean
        for (let dy = -windowSize; dy <= windowSize; dy++) {
          for (let dx = -windowSize; dx <= windowSize; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += saturation[ny * width + nx];
              count++;
            }
          }
        }

        const localMean = sum / count;
        binary[idx] = saturation[idx] > localMean * 0.9 ? 1 : 0;
      }
    }

    return binary;
  }

  // === ENHANCEMENT 2: Multi-Scale & Edge Features ===

  /** Extract edge features using Sobel operator */
  function extractEdgeFeatures(saturation: Float64Array, width: number, height: number): Float64Array {
    const edges = new Float64Array(width * height);

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;

        // Apply kernels
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            gx += saturation[idx] * sobelX[kernelIdx];
            gy += saturation[idx] * sobelY[kernelIdx];
          }
        }

        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    return edges;
  }

  /** Detect character boundaries dynamically */
  function detectCharacterBounds(saturation: Float64Array, width: number, height: number): Array<{x: number, width: number}> {
    // Project horizontally to find character separations
    const projection = new Array(width).fill(0);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        projection[x] += saturation[y * width + x];
      }
    }

    // Find valleys (character separations)
    const threshold = projection.reduce((a, b) => a + b) / width * 0.3;
    const bounds: Array<{x: number, width: number}> = [];
    let inChar = false, startX = 0;

    for (let x = 0; x < width; x++) {
      if (!inChar && projection[x] > threshold) {
        inChar = true;
        startX = x;
      } else if (inChar && projection[x] <= threshold) {
        if (x - startX > 10) { // Minimum character width
          bounds.push({ x: startX, width: x - startX });
        }
        inChar = false;
      }
    }

    // Handle last character
    if (inChar && width - startX > 10) {
      bounds.push({ x: startX, width: width - startX });
    }

    // If detection failed, fall back to fixed positions
    if (bounds.length !== 6) {
      return Array.from({ length: 6 }, (_, i) => ({ x: (i + 1) * 25 + 2, width: 23 }));
    }

    return bounds;
  }

  // === ENHANCEMENT 3: Enhanced Feature Extraction ===

  /** Original feature extraction (for compatibility) */
  function features(rgba: ArrayLike<number>) {
    if (rgba.length !== 200 * 40 * 4) throw Error('Expected 200×40 pixels');
    const saturation = new Float64Array(8000);
    for (let i = 0; i < saturation.length; i++) {
      const offset = i * 4;
      const max = Math.max(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
      const min = Math.min(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
      saturation[i] = max && rgba[offset + 3] >= 128 ? Math.round((max - min) * 255 / max) : 0;
    }
    const blocks: number[][] = [];
    for (let position = 0; position < 6; position++) {
      const values: number[] = [];
      for (let y = 8 + 5 * (position % 2); y < 35 - 5 * ((position + 1) % 2); y++)
        for (let x = (position + 1) * 25 + 2; x < (position + 2) * 25 + 1; x++) values.push(saturation[y * 200 + x]);
      const mean = values.reduce((a, b) => a + b, 0) / 528;
      // Blank/neutral blocks are outside this model's colored-letter format.
      if (Math.max(...values) - Math.min(...values) < 20) return null;
      blocks.push(values.map(value => value > mean ? 1 : 0));
    }
    return blocks;
  }

  /** Enhanced feature extraction with preprocessing and multi-scale features */
  function featuresEnhanced(rgba: ArrayLike<number>) {
    if (rgba.length !== 200 * 40 * 4) throw Error('Expected 200×40 pixels');

    // Step 1: Preprocessing
    const denoised = medianFilter(rgba, 200, 40);
    const enhanced = enhanceContrast(denoised, 200, 40);

    // Step 2: Extract saturation
    const saturation = new Float64Array(8000);
    for (let i = 0; i < saturation.length; i++) {
      const offset = i * 4;
      const max = Math.max(enhanced[offset], enhanced[offset + 1], enhanced[offset + 2]);
      const min = Math.min(enhanced[offset], enhanced[offset + 1], enhanced[offset + 2]);
      saturation[i] = max && enhanced[offset + 3] >= 128 ? Math.round((max - min) * 255 / max) : 0;
    }

    // Step 3: Extract edge features
    const edges = extractEdgeFeatures(saturation, 200, 40);

    // Step 4: Detect character boundaries
    const bounds = detectCharacterBounds(saturation, 200, 40);
    if (bounds.length !== 6) {
      // Fall back to standard feature extraction
      return features(rgba);
    }

    // Step 5: Extract features for each character
    const blocks: number[][] = [];
    for (let position = 0; position < 6; position++) {
      const bound = bounds[position];
      const values: number[] = [];
      const edgeValues: number[] = [];

      // Extract from detected bounds with slight padding
      const yStart = 8 + 5 * (position % 2);
      const yEnd = 35 - 5 * ((position + 1) % 2);

      for (let y = yStart; y < yEnd; y++) {
        for (let x = bound.x; x < Math.min(bound.x + bound.width, 200) && values.length < 264; x++) {
          const idx = y * 200 + x;
          values.push(saturation[idx]);
          edgeValues.push(edges[idx]);
        }
      }

      // Pad to 264 if needed
      while (values.length < 264) {
        values.push(0);
        edgeValues.push(0);
      }

      // Truncate to 264
      values.length = 264;
      edgeValues.length = 264;

      // Compute thresholds
      const satMean = values.reduce((a, b) => a + b, 0) / 264;
      const edgeMean = edgeValues.reduce((a, b) => a + b, 0) / 264;

      // Check if block has sufficient contrast
      if (Math.max(...values) - Math.min(...values) < 15 && Math.max(...edgeValues) < 10) {
        return null; // Blank block
      }

      // Create 528-feature vector: 264 saturation + 264 edge features
      const combined = [
        ...values.map(v => v > satMean ? 1 : 0),
        ...edgeValues.map(e => e > edgeMean ? 1 : 0)
      ];

      blocks.push(combined);
    }

    return blocks;
  }

  // === ENHANCEMENT 4: Validation & Model Management ===

  function validate(model: Partial<VtopCaptchaModel> | null | undefined) {
    if (model?.labels !== LABELS || model.biases?.length !== 32 || model.weights?.length !== 528 ||
        !model.biases.every(Number.isFinite) || model.weights.some(row => row.length !== 32 || !row.every(Number.isFinite)))
      throw Error('Invalid CAPTCHA model');
    return model as VtopCaptchaModel;
  }

  // === ENHANCEMENT 5: Ensemble Prediction ===

  /** Standard prediction (original algorithm) */
  function predict(rgba: ArrayLike<number>, model: VtopCaptchaModel): VtopCaptchaReading | null {
    validate(model);
    const blocks = features(rgba);
    if (!blocks) return null;

    const scores: number[] = [], margins: number[] = [], confidence: number[] = [];
    let text = '';

    for (const block of blocks) {
      const logits = model.biases.slice();
      for (let feature = 0; feature < 528; feature++) {
        if (block[feature]) {
          for (let label = 0; label < 32; label++) {
            logits[label] += model.weights[feature][label];
          }
        }
      }

      const max = Math.max(...logits);
      const exp = logits.map(value => Math.exp(value - max));
      const sum = exp.reduce((a, b) => a + b, 0);
      const probabilities = exp.map(value => value / sum);
      const ranked = probabilities.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);

      text += LABELS[ranked[0].index];
      scores.push(ranked[0].value);
      margins.push(ranked[0].value - ranked[1].value);

      // Classify confidence level
      const score = ranked[0].value;
      const margin = ranked[0].value - ranked[1].value;
      if (score > 0.9 && margin > 0.5) confidence.push(2); // High
      else if (score > 0.7 && margin > 0.25) confidence.push(1); // Medium
      else confidence.push(0); // Low
    }

    const meanScore = Math.exp(scores.reduce((sum, value) => sum + Math.log(value), 0) / 6);
    return { text, scores, margins, meanScore, confidence, method: 'standard' };
  }

  /** Ensemble prediction using multiple strategies */
  function predictWithEnsemble(rgba: ArrayLike<number>, model: VtopCaptchaModel): VtopCaptchaReading | null {
    validate(model);

    // Strategy 1: Standard features
    let result1: VtopCaptchaReading | null = null;
    try {
      result1 = predict(rgba, model);
    } catch (e) {
      // Continue to next strategy
    }

    // Strategy 2: Enhanced features
    let result2: VtopCaptchaReading | null = null;
    try {
      const blocks = featuresEnhanced(rgba);
      if (blocks) {
        const scores: number[] = [], margins: number[] = [], confidence: number[] = [];
        let text = '';

        for (const block of blocks) {
          const logits = model.biases.slice();
          for (let feature = 0; feature < Math.min(528, block.length); feature++) {
            if (block[feature]) {
              for (let label = 0; label < 32; label++) {
                logits[label] += model.weights[feature][label];
              }
            }
          }

          const max = Math.max(...logits);
          const exp = logits.map(value => Math.exp(value - max));
          const sum = exp.reduce((a, b) => a + b, 0);
          const probabilities = exp.map(value => value / sum);
          const ranked = probabilities.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);

          text += LABELS[ranked[0].index];
          scores.push(ranked[0].value);
          margins.push(ranked[0].value - ranked[1].value);

          const score = ranked[0].value;
          const margin = ranked[0].value - ranked[1].value;
          if (score > 0.9 && margin > 0.5) confidence.push(2);
          else if (score > 0.7 && margin > 0.25) confidence.push(1);
          else confidence.push(0);
        }

        const meanScore = Math.exp(scores.reduce((sum, value) => sum + Math.log(value), 0) / 6);
        result2 = { text, scores, margins, meanScore, confidence, method: 'enhanced' };
      }
    } catch (e) {
      // Enhanced method failed
    }

    // Strategy 3: Try with slight brightness adjustments
    let result3: VtopCaptchaReading | null = null;
    try {
      const adjusted = new Float64Array(rgba.length);
      const brightnessBoost = 1.2;
      for (let i = 0; i < rgba.length; i += 4) {
        adjusted[i] = Math.min(255, rgba[i] * brightnessBoost);
        adjusted[i + 1] = Math.min(255, rgba[i + 1] * brightnessBoost);
        adjusted[i + 2] = Math.min(255, rgba[i + 2] * brightnessBoost);
        adjusted[i + 3] = rgba[i + 3];
      }

      const blocks = features(adjusted);
      if (blocks) {
        const scores: number[] = [], margins: number[] = [], confidence: number[] = [];
        let text = '';

        for (const block of blocks) {
          const logits = model.biases.slice();
          for (let feature = 0; feature < 528; feature++) {
            if (block[feature]) {
              for (let label = 0; label < 32; label++) {
                logits[label] += model.weights[feature][label];
              }
            }
          }

          const max = Math.max(...logits);
          const exp = logits.map(value => Math.exp(value - max));
          const sum = exp.reduce((a, b) => a + b, 0);
          const probabilities = exp.map(value => value / sum);
          const ranked = probabilities.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);

          text += LABELS[ranked[0].index];
          scores.push(ranked[0].value);
          margins.push(ranked[0].value - ranked[1].value);

          const score = ranked[0].value;
          const margin = ranked[0].value - ranked[1].value;
          if (score > 0.9 && margin > 0.5) confidence.push(2);
          else if (score > 0.7 && margin > 0.25) confidence.push(1);
          else confidence.push(0);
        }

        const meanScore = Math.exp(scores.reduce((sum, value) => sum + Math.log(value), 0) / 6);
        result3 = { text, scores, margins, meanScore, confidence, method: 'adjusted' };
      }
    } catch (e) {
      // Adjusted method failed
    }

    // Choose best result based on mean score
    const results = [result1, result2, result3].filter(r => r !== null) as VtopCaptchaReading[];
    if (results.length === 0) return null;

    // Sort by mean score, prefer enhanced methods when scores are similar
    results.sort((a, b) => {
      const scoreDiff = b.meanScore - a.meanScore;
      if (Math.abs(scoreDiff) < 0.05) {
        // Prefer enhanced over standard
        const methodScore = (m: string) => m === 'enhanced' ? 2 : m === 'adjusted' ? 1 : 0;
        return methodScore(b.method || '') - methodScore(a.method || '');
      }
      return scoreDiff;
    });

    return results[0];
  }

  // === ENHANCEMENT 6: Smart Read with Fallback ===

  let modelPromise: Promise<VtopCaptchaModel> | null | undefined;

  async function read(rgba: ArrayLike<number>): Promise<VtopCaptchaReading | null> {
    if (!modelPromise) {
      modelPromise = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const response = await fetch(chrome.runtime.getURL('captcha-model.json'), { signal: controller.signal });
          if (!response.ok) throw Error('Model unavailable');
          return validate(await response.json());
        } finally {
          clearTimeout(timeout);
        }
      })().catch(error => {
        modelPromise = null;
        throw error;
      });
    }

    const model = await modelPromise;

    // Try ensemble prediction first
    const ensembleResult = predictWithEnsemble(rgba, model);
    if (ensembleResult && ensembleResult.meanScore > 0.75) {
      return ensembleResult;
    }

    // Fall back to standard prediction
    return predict(rgba, model);
  }

  const api: VtopCaptchaSolverApi = {
    validate,
    features,
    featuresEnhanced,
    predict,
    predictWithEnsemble,
    read,
    labels: LABELS
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.VtopCaptchaSolver = api;
})();
