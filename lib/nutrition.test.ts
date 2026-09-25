import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeMealProtein,
  perMealTarget,
  suggestAddOn,
  FoodItem,
  _clearFoodsCache,
} from './nutrition';

// ─── Mock loadFoods so tests never touch the filesystem ───────────────────────
// We define known test foods inline and pass them explicitly to each function.

const TEST_FOODS: FoodItem[] = [
  { id: 'tkpi_0022', name_id: 'Nasi', protein_per_100g: 3.0 },
  { id: 'tkpi_0379', name_id: 'Tempe pasar goreng', protein_per_100g: 20.0 },
  { id: 'tkpi_0358', name_id: 'Tahu goreng', protein_per_100g: 9.7 },
  { id: 'tkpi_0800', name_id: 'Ayam goreng pasundan, dada', protein_per_100g: 37.9 },
  { id: 'tkpi_1039', name_id: 'Telur ayam ras, segar', protein_per_100g: 12.4 },
];

beforeEach(() => {
  _clearFoodsCache();
  vi.restoreAllMocks();
});

// ─── computeMealProtein ───────────────────────────────────────────────────────

describe('computeMealProtein', () => {
  it('computes protein correctly for known foods', () => {
    // Nasi 200g: 3.0 × 200 / 100 = 6.0
    // Ayam dada 100g: 37.9 × 100 / 100 = 37.9
    const result = computeMealProtein(
      [
        { foodId: 'tkpi_0022', gramsLow: 200, gramsHigh: 200 },
        { foodId: 'tkpi_0800', gramsLow: 100, gramsHigh: 100 },
      ],
      TEST_FOODS
    );
    expect(result.low).toBe(43.9);
    expect(result.high).toBe(43.9);
    expect(result.perItem).toHaveLength(2);
    expect(result.notCounted).toHaveLength(0);
  });

  it('uses gramsLow and gramsHigh independently', () => {
    // Tempe 50–75g: low = 20.0×50/100 = 10.0, high = 20.0×75/100 = 15.0
    const result = computeMealProtein(
      [{ foodId: 'tkpi_0379', gramsLow: 50, gramsHigh: 75 }],
      TEST_FOODS
    );
    expect(result.low).toBe(10.0);
    expect(result.high).toBe(15.0);
    expect(result.perItem[0].proteinLow).toBe(10.0);
    expect(result.perItem[0].proteinHigh).toBe(15.0);
  });

  it('rounds protein values to 1 decimal place', () => {
    // Telur 55g: 12.4 × 55 / 100 = 6.82 → 6.8
    const result = computeMealProtein(
      [{ foodId: 'tkpi_1039', gramsLow: 55, gramsHigh: 55 }],
      TEST_FOODS
    );
    expect(result.low).toBe(6.8);
    expect(result.high).toBe(6.8);
  });

  it('excludes unknown foodId into notCounted', () => {
    const result = computeMealProtein(
      [
        { foodId: 'tkpi_0022', gramsLow: 200, gramsHigh: 200 },
        { foodId: 'unknown_xyz', gramsLow: 100, gramsHigh: 100 },
      ],
      TEST_FOODS
    );
    expect(result.notCounted).toContain('unknown_xyz');
    expect(result.perItem).toHaveLength(1); // only Nasi counted
  });

  it('returns zero totals and empty perItem for all-unknown items', () => {
    const result = computeMealProtein(
      [{ foodId: 'model_hallucinated_food', gramsLow: 100, gramsHigh: 100 }],
      TEST_FOODS
    );
    expect(result.low).toBe(0);
    expect(result.high).toBe(0);
    expect(result.perItem).toHaveLength(0);
    expect(result.notCounted).toContain('model_hallucinated_food');
  });

  it('returns zero totals for empty items array', () => {
    const result = computeMealProtein([], TEST_FOODS);
    expect(result.low).toBe(0);
    expect(result.high).toBe(0);
    expect(result.perItem).toHaveLength(0);
    expect(result.notCounted).toHaveLength(0);
  });

  it('accumulates multiple items correctly', () => {
    // Tahu 100g: 9.7g  +  Tempe 50g: 10.0g  = 19.7g
    const result = computeMealProtein(
      [
        { foodId: 'tkpi_0358', gramsLow: 100, gramsHigh: 100 },
        { foodId: 'tkpi_0379', gramsLow: 50, gramsHigh: 50 },
      ],
      TEST_FOODS
    );
    expect(result.low).toBe(19.7);
    expect(result.high).toBe(19.7);
  });
});

// ─── perMealTarget ────────────────────────────────────────────────────────────

describe('perMealTarget', () => {
  it('divides daily range by meals per day (3)', () => {
    const result = perMealTarget(112, 154, 3); // 70kg × 1.6 and 70kg × 2.2
    expect(result.min).toBeCloseTo(37.3, 1);
    expect(result.max).toBeCloseTo(51.3, 1);
  });

  it('divides daily range by meals per day (4)', () => {
    const result = perMealTarget(112, 154, 4);
    expect(result.min).toBe(28.0);
    expect(result.max).toBe(38.5);
  });

  it('rounds to 1 decimal place', () => {
    const result = perMealTarget(100, 200, 3);
    // 100/3 = 33.333... → 33.3, 200/3 = 66.666... → 66.7
    expect(result.min).toBe(33.3);
    expect(result.max).toBe(66.7);
  });
});

// ─── suggestAddOn ─────────────────────────────────────────────────────────────

describe('suggestAddOn', () => {
  it('returns target met message when gap <= 0', () => {
    const result = suggestAddOn(0, 'id', TEST_FOODS);
    expect(result.text).toContain('Target terpenuhi');
    expect(result.proteinAdded).toBe(0);
  });

  it('returns target met message in English when gap <= 0', () => {
    const result = suggestAddOn(-5, 'en', TEST_FOODS);
    expect(result.text).toContain('Target met');
    expect(result.proteinAdded).toBe(0);
  });

  it('picks the smallest single add-on that covers the gap', () => {
    // Gap = 7g. Options: Telur=6.8g (not enough), Tahu=9.7g ✓, Tempe=10.0g, Ayam=37.9g
    // Smallest single covering 7g = Tahu goreng (9.7g)
    const result = suggestAddOn(7, 'en', TEST_FOODS);
    expect(result.proteinAdded).toBe(9.7);
    expect(result.text).toContain('Fried tofu');
  });

  it('picks the smallest single add-on when gap exactly equals add-on protein', () => {
    // Gap = 9.7g → Tahu covers exactly
    const result = suggestAddOn(9.7, 'id', TEST_FOODS);
    expect(result.proteinAdded).toBe(9.7);
    expect(result.text).toContain('Tahu goreng');
  });

  it('uses two-item combo when no single add-on covers the gap', () => {
    // Gap = 15g. Single options: Telur=6.8 (no), Tahu=9.7 (no), Tempe=10.0 (no), Ayam=37.9 (yes!)
    // Actually gap=15 → Ayam covers it (37.9). Let's use gap=11 where no single covers.
    // Telur=6.8, Tahu=9.7, Tempe=10.0 are all < 11. Ayam=37.9 >= 11.
    // Hmm, gap=11 → Ayam covers. Use gap=11 and a foods list without Ayam to force pair.
    const limitedFoods: FoodItem[] = [
      { id: 'tkpi_1039', name_id: 'Telur ayam ras, segar', protein_per_100g: 12.4 },  // 6.8g at 55g
      { id: 'tkpi_0358', name_id: 'Tahu goreng', protein_per_100g: 9.7 },              // 9.7g at 100g
      { id: 'tkpi_0379', name_id: 'Tempe pasar goreng', protein_per_100g: 20.0 },      // 10.0g at 50g
    ];
    // Gap = 11g: no single covers (max=10.0). Pairs: Telur+Tahu=16.5, Telur+Tempe=16.8, Tahu+Tempe=19.7
    // Smallest covering pair = Telur+Tahu = 16.5
    const result = suggestAddOn(11, 'en', limitedFoods);
    expect(result.proteinAdded).toBeCloseTo(16.5, 1);
    expect(result.text).toContain('egg');
    expect(result.text).toContain('tofu');
  });

  it('returns bilingual text (Indonesian)', () => {
    const result = suggestAddOn(7, 'id', TEST_FOODS);
    expect(result.text).toContain('Tambahkan');
  });

  it('returns bilingual text (English)', () => {
    const result = suggestAddOn(7, 'en', TEST_FOODS);
    expect(result.text).toContain('Add');
  });
});
