import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock Gemini SDK — same pattern as lib/api.test.ts ───────────────────────
// This ensures `npm test` NEVER calls the real Gemini API.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
      constructor(_opts: unknown) {}
    },
  };
});

// ─── Mock fs so tests don't read from disk ────────────────────────────────────
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn((_path: unknown, _encoding: unknown) => {
      return JSON.stringify({
        foods: [
          { id: 'tkpi_0022', name_id: 'Nasi', category: 'Serealia', per_100g: { protein_g: 3.0, energy_kcal: 180, fat_g: 0.3, carbohydrate_g: 39.8 } },
          { id: 'tkpi_0379', name_id: 'Tempe pasar goreng', category: 'Kacang-Kacangan', per_100g: { protein_g: 20.0, energy_kcal: 336, fat_g: 28.0, carbohydrate_g: 7.8 } },
          { id: 'tkpi_0358', name_id: 'Tahu goreng', category: 'Kacang-Kacangan', per_100g: { protein_g: 9.7, energy_kcal: 115, fat_g: 8.5, carbohydrate_g: 2.5 } },
          { id: 'tkpi_0800', name_id: 'Ayam goreng pasundan, dada', category: 'Daging', per_100g: { protein_g: 37.9, energy_kcal: 246, fat_g: 9.0, carbohydrate_g: 0.7 } },
          { id: 'tkpi_1039', name_id: 'Telur ayam ras, segar', category: 'Telur', per_100g: { protein_g: 12.4, energy_kcal: 154, fat_g: 10.8, carbohydrate_g: 0.7 } },
        ],
      });
    }),
  };
});

// ─── Also clear the nutrition module's food cache between tests ───────────────
import { _clearFoodsCache } from '../lib/nutrition';

import { POST } from '../app/api/food/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const apiError = (status: number) => Object.assign(new Error(`API error ${status}`), { status });

/**
 * Build a small valid JPEG base64 string.
 * Real size: ~100 bytes decoded (well under 4 MB limit).
 */
const SMALL_IMAGE_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
  'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
  'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA' +
  'AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA' +
  '/9oADAMBAAIRAxEAPwCwABmX/9k=';

function makeFoodRequest(overrides: Record<string, unknown> = {}) {
  const body = {
    imageBase64: SMALL_IMAGE_B64,
    mimeType: 'image/jpeg',
    lang: 'en',
    weightKg: 70,
    mealsPerDay: 3,
    ...overrides,
  };
  return new NextRequest('http://localhost:3000/api/food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A happy-path Gemini vision response: Nasi 200g + Ayam dada 100g */
const happyVisionResponse = {
  text: JSON.stringify({
    is_food: true,
    items: [
      { food_id: 'tkpi_0022', label: 'nasi putih', grams_low: 180, grams_high: 220, confidence: 0.9 },
      { food_id: 'tkpi_0800', label: 'ayam goreng', grams_low: 90, grams_high: 110, confidence: 0.85 },
    ],
  }),
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  generateContent.mockReset();
  _clearFoodsCache();
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'primary-model';
  process.env.GEMINI_FALLBACK_MODELS = 'backup-model';
  process.env.GEMINI_RETRY_BASE_MS = '1';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/food', () => {
  // ── Happy path ──────────────────────────────────────────────────────────────

  it('happy path: returns protein math, target, gap, suggestion', async () => {
    generateContent.mockResolvedValueOnce(happyVisionResponse);
    const res = await POST(makeFoodRequest());
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.is_food).toBe(true);
    expect(data.is_fallback).toBe(false);
    expect(data.model_used).toBe('primary-model');

    // Nasi low: 3.0×180/100=5.4, Ayam low: 37.9×90/100=34.1 → total low=39.5
    expect(data.protein.low).toBeCloseTo(39.5, 1);
    // Nasi high: 3.0×220/100=6.6, Ayam high: 37.9×110/100=41.7 → total high=48.3
    expect(data.protein.high).toBeCloseTo(48.3, 1);

    expect(data.target).toBeDefined();
    expect(data.target.min).toBeGreaterThan(0);
    expect(data.suggestion).toBeDefined();
    expect(data.items).toHaveLength(2);
  });

  it('happy path: response items contain name_id from foods.json (not from model)', async () => {
    generateContent.mockResolvedValueOnce(happyVisionResponse);
    const res = await POST(makeFoodRequest());
    const data = await res.json();
    const nasiItem = data.items.find((i: { food_id: string }) => i.food_id === 'tkpi_0022');
    expect(nasiItem.name_id).toBe('Nasi'); // from foods.json, not model's "nasi putih"
  });

  it('response includes protein_per_100g for client-side portion recalc', async () => {
    generateContent.mockResolvedValueOnce(happyVisionResponse);
    const res = await POST(makeFoodRequest());
    const data = await res.json();
    expect(data.items[0].protein_per_100g).toBeDefined();
    expect(typeof data.items[0].protein_per_100g).toBe('number');
  });

  // ── Unknown food_id → notCounted ────────────────────────────────────────────

  it('model returns food_id not in foods.json → moved to notCounted', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        is_food: true,
        items: [
          { food_id: 'tkpi_0022', label: 'nasi', grams_low: 200, grams_high: 200, confidence: 0.9 },
          { food_id: 'hallucinated_pizza_id', label: 'pizza', grams_low: 200, grams_high: 200, confidence: 0.5 },
        ],
      }),
    });
    const res = await POST(makeFoodRequest());
    const data = await res.json();
    expect(data.notCounted).toContain('pizza'); // label of the unknown item
    expect(data.items).toHaveLength(1); // only Nasi counted
  });

  it('model returns "unknown" food_id → moved to notCounted', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        is_food: true,
        items: [
          { food_id: 'unknown', label: 'mysterious sauce', grams_low: 50, grams_high: 80, confidence: 0.3 },
        ],
      }),
    });
    const res = await POST(makeFoodRequest());
    const data = await res.json();
    expect(data.notCounted).toContain('mysterious sauce');
    expect(data.protein.low).toBe(0);
  });

  // ── is_food=false ────────────────────────────────────────────────────────────

  it('is_food=false → friendly response with no protein numbers', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ is_food: false, items: [] }),
    });
    const res = await POST(makeFoodRequest());
    const data = await res.json();
    expect(data.is_food).toBe(false);
    expect(data.protein.low).toBe(0);
    expect(data.protein.high).toBe(0);
    expect(data.items).toHaveLength(0);
  });

  // ── MIME type validation ─────────────────────────────────────────────────────

  it('rejects unsupported MIME type with 400', async () => {
    const res = await POST(makeFoodRequest({ mimeType: 'image/gif' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Unsupported image type');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('accepts image/png', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ is_food: false, items: [] }) });
    const res = await POST(makeFoodRequest({ mimeType: 'image/png' }));
    expect(res.status).toBe(200);
  });

  it('accepts image/webp', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ is_food: false, items: [] }) });
    const res = await POST(makeFoodRequest({ mimeType: 'image/webp' }));
    expect(res.status).toBe(200);
  });

  // ── 4 MB size limit ──────────────────────────────────────────────────────────

  it('rejects image > 4 MB with 413', async () => {
    // base64 that decodes to > 4 MB: base64 length > 4*1024*1024*(4/3) ≈ 5.5 million chars
    const bigBase64 = 'A'.repeat(5_600_000);
    const res = await POST(makeFoodRequest({ imageBase64: bigBase64 }));
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toContain('4 MB');
    expect(generateContent).not.toHaveBeenCalled();
  });

  // ── weightKg validation ──────────────────────────────────────────────────────

  it('rejects weightKg out of range with 400', async () => {
    const res = await POST(makeFoodRequest({ weightKg: 20 }));
    expect(res.status).toBe(400);
  });

  it('rejects weightKg=300 with 400', async () => {
    const res = await POST(makeFoodRequest({ weightKg: 300 }));
    expect(res.status).toBe(400);
  });

  // ── mealsPerDay validation ───────────────────────────────────────────────────

  it('rejects mealsPerDay=2 with 400', async () => {
    const res = await POST(makeFoodRequest({ mealsPerDay: 2 }));
    expect(res.status).toBe(400);
  });

  it('rejects mealsPerDay=5 with 400', async () => {
    const res = await POST(makeFoodRequest({ mealsPerDay: 5 }));
    expect(res.status).toBe(400);
  });

  it('accepts mealsPerDay=4', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ is_food: false, items: [] }) });
    const res = await POST(makeFoodRequest({ mealsPerDay: 4 }));
    expect(res.status).toBe(200);
  });

  // ── Gemini failure → error (no fake protein numbers) ────────────────────────

  it('Gemini fails all retries → is_fallback true and no fake protein numbers', async () => {
    generateContent.mockRejectedValue(apiError(503));
    const res = await POST(makeFoodRequest());
    const data = await res.json();
    expect(data.is_fallback).toBe(true);
    // No protein numbers should be returned (not invented)
    expect(data.protein.low).toBe(0);
    expect(data.protein.high).toBe(0);
    expect(data.items).toHaveLength(0);
    expect(data.error).toBeDefined();
  });

  it('Gemini fails with 404 → switches to backup model', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(404))
      .mockResolvedValueOnce({ text: JSON.stringify({ is_food: false, items: [] }) });
    const res = await POST(makeFoodRequest());
    const data = await res.json();
    expect(data.is_fallback).toBe(false);
    expect(data.model_used).toBe('backup-model');
  });

  // ── No API key ───────────────────────────────────────────────────────────────

  it('no GEMINI_API_KEY → 503 with is_fallback true', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(makeFoodRequest());
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.is_fallback).toBe(true);
    expect(generateContent).not.toHaveBeenCalled();
  });

  // ── Gemini multimodal call structure ─────────────────────────────────────────

  it('Gemini is called with multimodal contents (text + inlineData)', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ is_food: false, items: [] }) });
    await POST(makeFoodRequest());
    const call = generateContent.mock.calls[0][0];
    // contents should be an array (multimodal), not a string
    expect(Array.isArray(call.contents)).toBe(true);
    const parts = call.contents as Array<Record<string, unknown>>;
    expect(parts.some((p) => 'text' in p)).toBe(true);
    expect(parts.some((p) => 'inlineData' in p)).toBe(true);
  });

  it('image base64 is NOT included in any console.log calls', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ is_food: false, items: [] }) });
    await POST(makeFoodRequest());
    const allLogged = logSpy.mock.calls.map((c) => JSON.stringify(c)).join('');
    expect(allLogged).not.toContain(SMALL_IMAGE_B64.slice(0, 50));
    logSpy.mockRestore();
  });
});
