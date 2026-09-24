import { describe, it, expect } from 'vitest';
import {
  computeBodyFatNavy,
  computeFFMI,
  proteinTarget,
  computeBMI,
} from './calc';

describe('computeBodyFatNavy', () => {
  it('computes body fat range correctly for male', () => {
    // 175cm, waist 85cm, neck 38cm
    const result = computeBodyFatNavy('male', 175, 85, 38);
    expect(result.mid).toBeCloseTo(16.9, 0);
    expect(result.low).toBeCloseTo(result.mid - 3.5, 1);
    expect(result.high).toBeCloseTo(result.mid + 3.5, 1);
  });

  it('computes body fat range correctly for female', () => {
    // 160cm, waist 72cm, neck 33cm, hip 96cm
    const result = computeBodyFatNavy('female', 160, 72, 33, 96);
    expect(result.mid).toBeCloseTo(27.2, 0);
    expect(result.low).toBeCloseTo(result.mid - 3.5, 1);
    expect(result.high).toBeCloseTo(result.mid + 3.5, 1);
  });

  it('throws error when female hip is missing or non-positive', () => {
    expect(() => computeBodyFatNavy('female', 160, 72, 33)).toThrow(
      'Hip circumference is required'
    );
    expect(() => computeBodyFatNavy('female', 160, 72, 33, 0)).toThrow(
      'Hip circumference is required'
    );
  });

  it('throws error when waist <= neck for male', () => {
    expect(() => computeBodyFatNavy('male', 175, 38, 38)).toThrow(
      'Waist circumference must be greater than neck'
    );
  });

  it('throws error for negative or zero measurements', () => {
    expect(() => computeBodyFatNavy('male', 0, 80, 36)).toThrow(
      'Measurements must be positive numbers'
    );
  });
});

describe('computeFFMI', () => {
  it('computes FFMI correctly for standard male', () => {
    // 70 kg, 175 cm, 17% BF -> lean mass = 58.1 kg -> 58.1 / (1.75^2) = 19.0
    const ffmi = computeFFMI(70, 175, 17);
    expect(ffmi).toBe(19.0);
  });

  it('computes FFMI correctly for athletic female', () => {
    // 55 kg, 162 cm, 22% BF -> lean mass = 42.9 kg -> 42.9 / (1.62^2) = 16.3
    const ffmi = computeFFMI(55, 162, 22);
    expect(ffmi).toBe(16.3);
  });

  it('throws error on non-positive height or weight', () => {
    expect(() => computeFFMI(0, 170, 15)).toThrow();
    expect(() => computeFFMI(70, -170, 15)).toThrow();
  });
});

describe('proteinTarget', () => {
  it('returns 1.6 - 2.2 g/kg range', () => {
    // 70 kg -> 112g - 154g
    const target = proteinTarget(70);
    expect(target.min).toBe(112);
    expect(target.max).toBe(154);
    expect(target.text).toBe('112–154 g/day');
  });

  it('throws error for non-positive weight', () => {
    expect(() => proteinTarget(0)).toThrow();
  });
});

describe('computeBMI', () => {
  it('computes BMI accurately', () => {
    // 70 kg, 175 cm -> 22.9
    expect(computeBMI(70, 175)).toBe(22.9);
    // 45 kg, 170 cm -> 15.6 (underweight)
    expect(computeBMI(45, 170)).toBe(15.6);
  });
});
