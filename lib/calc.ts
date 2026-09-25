/**
 * Deterministic body composition and nutrition calculations
 * Grounded in US Navy Body Fat formula, FFMI, and evidence-based protein targets (SPEC §3).
 */

export type Sex = 'male' | 'female';

export interface BodyFatResult {
  low: number;
  mid: number;
  high: number;
}

export interface ProteinTargetResult {
  min: number;
  max: number;
  text: string;
}

/**
 * Computes body fat percentage range using the metric US Navy formula.
 * Men: 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
 * Women: 495 / (1.29579 - 0.35004 * log10(waist + hip - neck) + 0.22100 * log10(height)) - 450
 * 
 * Always returns a ±3.5% range { low, mid, high } to reflect formula accuracy.
 */
export function computeBodyFatNavy(
  sex: Sex,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number
): BodyFatResult {
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) {
    throw new Error('Measurements must be positive numbers');
  }

  let mid: number;

  if (sex === 'male') {
    const diff = waistCm - neckCm;
    if (diff <= 0) {
      throw new Error('Waist circumference must be greater than neck circumference');
    }
    const denom = 1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm);
    if (denom <= 0) {
      throw new Error('Invalid calculation values result in non-positive denominator');
    }
    mid = 495 / denom - 450;
  } else {
    if (hipCm === undefined || hipCm <= 0) {
      throw new Error('Hip circumference is required for females and must be positive');
    }
    const diff = waistCm + hipCm - neckCm;
    if (diff <= 0) {
      throw new Error('Waist + hip circumference must be greater than neck circumference');
    }
    const denom = 1.29579 - 0.35004 * Math.log10(diff) + 0.22100 * Math.log10(heightCm);
    if (denom <= 0) {
      throw new Error('Invalid calculation values result in non-positive denominator');
    }
    mid = 495 / denom - 450;
  }

  // Clamp mid to reasonable human physiological bounds (3% - 65%)
  const boundedMid = Math.max(3, Math.min(65, mid));
  const low = Math.max(1, Number((boundedMid - 3.5).toFixed(1)));
  const high = Number((boundedMid + 3.5).toFixed(1));
  const roundedMid = Number(boundedMid.toFixed(1));

  return { low, mid: roundedMid, high };
}

/**
 * Computes Fat-Free Mass Index (FFMI).
 * Lean mass = weight (kg) * (1 - bodyFatPct / 100)
 * FFMI = lean mass (kg) / height (m)^2
 */
export function computeFFMI(
  weightKg: number,
  heightCm: number,
  bodyFatPct: number
): number {
  if (weightKg <= 0 || heightCm <= 0) {
    throw new Error('Weight and height must be positive numbers');
  }
  const heightM = heightCm / 100;
  const leanMassKg = weightKg * (1 - Math.max(0, Math.min(100, bodyFatPct)) / 100);
  const ffmi = leanMassKg / (heightM * heightM);
  return Number(ffmi.toFixed(1));
}

/**
 * Computes daily protein target range (1.6 - 2.2 g/kg bodyweight/day).
 */
export function proteinTarget(weightKg: number): ProteinTargetResult {
  if (weightKg <= 0) {
    throw new Error('Weight must be a positive number');
  }
  const min = Math.round(weightKg * 1.6);
  const max = Math.round(weightKg * 2.2);
  return {
    min,
    max,
    text: `${min}–${max} g/day`,
  };
}

/**
 * Computes Body Mass Index (BMI).
 * BMI = weight (kg) / height (m)^2
 */
export function computeBMI(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) {
    throw new Error('Weight and height must be positive numbers');
  }
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export type FitnessPath = 'recomp' | 'cut' | 'lean_bulk';

export interface PathDecision {
  path: FitnessPath;
  borderline: boolean;
}

/**
 * Determines the fitness path (recomp, cut, or lean_bulk) based on sex, body fat range, and FFMI.
 * 
 * Rules:
 * - Men: bfMid >= 25 -> "cut"; bfMid <= 15 -> "lean_bulk"; otherwise -> "recomp".
 * - Women: bfMid >= 32 -> "cut"; bfMid <= 22 -> "lean_bulk"; otherwise -> "recomp".
 * - If the range [bfLow, bfHigh] crosses a threshold, choose "recomp" and set borderline=true.
 */
export function decidePath(
  sex: Sex,
  bfLow: number,
  bfMid: number,
  bfHigh: number,
  ffmi: number
): PathDecision {
  const lowerThreshold = sex === 'male' ? 15 : 22;
  const upperThreshold = sex === 'male' ? 25 : 32;

  // Check if range [bfLow, bfHigh] crosses either threshold
  const crossesLower = bfLow <= lowerThreshold && bfHigh >= lowerThreshold;
  const crossesUpper = bfLow <= upperThreshold && bfHigh >= upperThreshold;

  if (crossesLower || crossesUpper) {
    return { path: 'recomp', borderline: true };
  }

  if (bfMid >= upperThreshold) {
    return { path: 'cut', borderline: false };
  }

  if (bfMid <= lowerThreshold) {
    return { path: 'lean_bulk', borderline: false };
  }

  return { path: 'recomp', borderline: false };
}

