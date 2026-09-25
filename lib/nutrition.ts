/**
 * lib/nutrition.ts — Pure deterministic nutrition functions for F2 (food photo → protein).
 *
 * CRITICAL RULE: This module is the ONLY place protein values are computed.
 * The Gemini model identifies foods and estimates grams; it never produces nutrient numbers.
 * All protein arithmetic uses data/foods.json (TKPI subset, per 100 g edible portion).
 */

import fs from 'fs';
import path from 'path';
import { Language } from './i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string;
  name_id: string;
  protein_per_100g: number;
}

export interface MealItem {
  foodId: string;
  gramsLow: number;
  gramsHigh: number;
}

export interface PerItemProtein {
  foodId: string;
  name_id: string;
  gramsLow: number;
  gramsHigh: number;
  proteinLow: number;
  proteinHigh: number;
}

export interface MealProteinResult {
  low: number;
  high: number;
  perItem: PerItemProtein[];
  notCounted: string[];
}

export interface MealTarget {
  min: number;
  max: number;
}

export interface AddOnSuggestion {
  text: string;
  proteinAdded: number;
}

// ─── Fixed add-on shelf (spec §1 suggestAddOn) ────────────────────────────────

interface AddOnOption {
  foodId: string;
  portionG: number;
  labelId: string;
  labelEn: string;
}

const ADD_ON_SHELF: AddOnOption[] = [
  { foodId: 'tkpi_1039', portionG: 55, labelId: '1 butir telur ayam', labelEn: '1 egg' },
  { foodId: 'tkpi_0379', portionG: 50, labelId: 'Tempe goreng (50 g)', labelEn: 'Fried tempeh (50 g)' },
  { foodId: 'tkpi_0358', portionG: 100, labelId: 'Tahu goreng (100 g)', labelEn: 'Fried tofu (100 g)' },
  { foodId: 'tkpi_0800', portionG: 100, labelId: 'Dada ayam goreng (100 g)', labelEn: 'Fried chicken breast (100 g)' },
];

// ─── loadFoods ─────────────────────────────────────────────────────────────────

let _foodCache: FoodItem[] | null = null;

/**
 * Loads and caches foods from data/foods.json.
 * Returns a typed array mapping TKPI entries to {id, name_id, protein_per_100g}.
 * Server-side only (uses fs).
 */
export function loadFoods(): FoodItem[] {
  if (_foodCache) return _foodCache;
  const filePath = path.join(process.cwd(), 'data', 'foods.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as {
    foods: Array<{ id: string; name_id: string; per_100g: { protein_g: number } }>;
  };
  _foodCache = parsed.foods.map((f) => ({
    id: f.id,
    name_id: f.name_id,
    protein_per_100g: f.per_100g.protein_g,
  }));
  return _foodCache;
}

/** Exposed for tests to clear the module-level cache. */
export function _clearFoodsCache(): void {
  _foodCache = null;
}

// ─── computeMealProtein ────────────────────────────────────────────────────────

/**
 * Computes protein range for a list of detected food items.
 * Unknown or invalid foodIds are excluded and listed in notCounted.
 * Protein values are rounded to 1 decimal place.
 */
export function computeMealProtein(
  items: MealItem[],
  foods?: FoodItem[]
): MealProteinResult {
  const foodList = foods ?? loadFoods();
  const foodMap = new Map(foodList.map((f) => [f.id, f]));

  const perItem: PerItemProtein[] = [];
  const notCounted: string[] = [];
  let totalLow = 0;
  let totalHigh = 0;

  for (const item of items) {
    const food = foodMap.get(item.foodId);
    if (!food) {
      notCounted.push(item.foodId);
      continue;
    }
    const proteinLow = Math.round((food.protein_per_100g * item.gramsLow) / 100 * 10) / 10;
    const proteinHigh = Math.round((food.protein_per_100g * item.gramsHigh) / 100 * 10) / 10;
    perItem.push({
      foodId: item.foodId,
      name_id: food.name_id,
      gramsLow: item.gramsLow,
      gramsHigh: item.gramsHigh,
      proteinLow,
      proteinHigh,
    });
    totalLow += proteinLow;
    totalHigh += proteinHigh;
  }

  return {
    low: Math.round(totalLow * 10) / 10,
    high: Math.round(totalHigh * 10) / 10,
    perItem,
    notCounted,
  };
}

// ─── perMealTarget ─────────────────────────────────────────────────────────────

/**
 * Divides the daily protein target range by meals per day.
 * Values rounded to 1 decimal place.
 */
export function perMealTarget(
  dailyMin: number,
  dailyMax: number,
  mealsPerDay: number
): MealTarget {
  return {
    min: Math.round((dailyMin / mealsPerDay) * 10) / 10,
    max: Math.round((dailyMax / mealsPerDay) * 10) / 10,
  };
}

// ─── suggestAddOn ─────────────────────────────────────────────────────────────

/**
 * Picks the smallest single add-on from the fixed shelf that closes `gapGrams`,
 * else the two-item combination with the smallest total protein.
 * If gap ≤ 0, returns a "target met" message with proteinAdded = 0.
 *
 * Protein values for add-ons are read from the live foods list so they stay
 * consistent with the same TKPI data as all other calculations.
 */
export function suggestAddOn(
  gapGrams: number,
  lang: Language,
  foods?: FoodItem[]
): AddOnSuggestion {
  if (gapGrams <= 0) {
    return {
      text: lang === 'id' ? 'Target terpenuhi! 🎉' : 'Target met! 🎉',
      proteinAdded: 0,
    };
  }

  const foodList = foods ?? loadFoods();
  const foodMap = new Map(foodList.map((f) => [f.id, f]));

  // Compute protein each add-on provides
  const withProtein = ADD_ON_SHELF.map((opt) => {
    const food = foodMap.get(opt.foodId);
    const protein = food
      ? Math.round((food.protein_per_100g * opt.portionG) / 100 * 10) / 10
      : 0;
    return { ...opt, protein };
  }).filter((o) => o.protein > 0);

  // Try single items: pick smallest protein that covers the gap
  const singles = withProtein.filter((o) => o.protein >= gapGrams);
  if (singles.length > 0) {
    const best = singles.reduce((a, b) => (a.protein < b.protein ? a : b));
    const label = lang === 'id' ? best.labelId : best.labelEn;
    return {
      text: lang === 'id'
        ? `Tambahkan ${label} (+${best.protein} g protein)`
        : `Add ${label} (+${best.protein} g protein)`,
      proteinAdded: best.protein,
    };
  }

  // Try all pairs: pick the one with smallest total protein that still covers the gap
  let bestPair: { a: typeof withProtein[0]; b: typeof withProtein[0]; total: number } | null = null;
  for (let i = 0; i < withProtein.length; i++) {
    for (let j = i + 1; j < withProtein.length; j++) {
      const total = Math.round((withProtein[i].protein + withProtein[j].protein) * 10) / 10;
      if (total >= gapGrams) {
        if (!bestPair || total < bestPair.total) {
          bestPair = { a: withProtein[i], b: withProtein[j], total };
        }
      }
    }
  }

  if (bestPair) {
    const labelA = lang === 'id' ? bestPair.a.labelId : bestPair.a.labelEn;
    const labelB = lang === 'id' ? bestPair.b.labelId : bestPair.b.labelEn;
    return {
      text: lang === 'id'
        ? `Tambahkan ${labelA} dan ${labelB} (+${bestPair.total} g protein)`
        : `Add ${labelA} and ${labelB} (+${bestPair.total} g protein)`,
      proteinAdded: bestPair.total,
    };
  }

  // Gap is larger than any single or pair can cover — suggest the highest-protein item
  const best = withProtein.reduce((a, b) => (a.protein > b.protein ? a : b));
  const label = lang === 'id' ? best.labelId : best.labelEn;
  return {
    text: lang === 'id'
      ? `Tambahkan ${label} (+${best.protein} g protein) sebagai langkah pertama`
      : `Add ${label} (+${best.protein} g protein) as a first step`,
    proteinAdded: best.protein,
  };
}
