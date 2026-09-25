import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { generateJsonWithRetry } from '@/lib/gemini';
import { loadFoods, computeMealProtein, perMealTarget, suggestAddOn } from '@/lib/nutrition';
import { proteinTarget } from '@/lib/calc';
import { Language } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by Gemini vision (constrained via responseSchema). */
interface GeminiVisionResult {
  is_food: boolean;
  items: Array<{
    food_id: string;
    label: string;
    grams_low: number;
    grams_high: number;
    confidence: number;
  }>;
}

/** An item as returned to the client — always uses name_id from foods.json, never from the model. */
export interface DetectedItem {
  food_id: string;
  name_id: string;           // sourced from foods.json, not from the model
  label: string;             // model's free-text description (display only)
  grams_low: number;
  grams_high: number;
  confidence: number;
  protein_per_100g: number;  // passed to client so it can do local portion recalc
  protein_low: number;
  protein_high: number;
}

export interface FoodResponseBody {
  is_food: boolean;
  items: DetectedItem[];
  notCounted: string[];      // labels that didn't map to foods.json
  protein: { low: number; high: number };
  target: { min: number; max: number };
  gap: number;               // target.min - protein.high (negative = target exceeded)
  suggestion: { text: string; proteinAdded: number };
  model_used: string | null;
  is_fallback: boolean;
  error?: string;
}

// ─── Accepted MIME types ──────────────────────────────────────────────────────

const ACCEPTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

// ─── Gemini response schema ───────────────────────────────────────────────────

const VISION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_food: {
      type: Type.BOOLEAN,
      description: 'true if the image shows a meal/food plate; false otherwise',
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          food_id: {
            type: Type.STRING,
            description: 'ID from the allowed food list, or "unknown" if not in the list',
          },
          label: {
            type: Type.STRING,
            description: 'Short description of what you see (e.g. "nasi putih", "tempe goreng")',
          },
          grams_low: {
            type: Type.NUMBER,
            description: 'Low estimate of edible portion in grams',
          },
          grams_high: {
            type: Type.NUMBER,
            description: 'High estimate of edible portion in grams',
          },
          confidence: {
            type: Type.NUMBER,
            description: 'Confidence score 0–1',
          },
        },
        required: ['food_id', 'label', 'grams_low', 'grams_high', 'confidence'],
      },
    },
  },
  required: ['is_food', 'items'],
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      imageBase64: string;
      mimeType: string;
      lang?: Language;
      weightKg: number;
      mealsPerDay: number;
    };

    const { imageBase64, mimeType, lang = 'id', weightKg, mealsPerDay } = body;

    // ── Validate MIME type ──────────────────────────────────────────────────
    if (!ACCEPTED_MIMES.has(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported image type "${mimeType}". Use JPEG, PNG, or WebP.` },
        { status: 400 }
      );
    }

    // ── Validate payload size (4 MB decoded) ───────────────────────────────
    // base64 encodes ~4/3 bytes, so decoded size ≈ base64Length × 0.75
    const decodedBytes = Math.ceil(imageBase64.length * 0.75);
    if (decodedBytes > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Image exceeds 4 MB limit. Please use a smaller photo.' },
        { status: 413 }
      );
    }

    // ── Validate weightKg ──────────────────────────────────────────────────
    if (!weightKg || weightKg < 30 || weightKg > 250) {
      return NextResponse.json(
        { error: 'Weight must be between 30 and 250 kg.' },
        { status: 400 }
      );
    }

    // ── Validate mealsPerDay ───────────────────────────────────────────────
    if (mealsPerDay !== 3 && mealsPerDay !== 4) {
      return NextResponse.json(
        { error: 'Meals per day must be 3 or 4.' },
        { status: 400 }
      );
    }

    // ── Deterministic: load foods and compute daily protein target ─────────
    const foods = loadFoods();
    const foodMap = new Map(foods.map((f) => [f.id, f]));
    const daily = proteinTarget(weightKg); // { min, max, text }

    // ── Build Gemini prompt with allowed food list (id + name_id only) ─────
    const foodListText = foods
      .map((f) => `${f.id}: ${f.name_id}`)
      .join('\n');

    const systemPrompt = `You are a food-recognition assistant for a fitness app.
Analyze the provided meal photo.

RULES (CRITICAL):
1. Set is_food=false if the photo is not a meal (e.g. a face, scenery, object).
2. For each visible food item, choose the food_id from this allowed list ONLY.
   If an item is not in the list, use food_id="unknown".
3. Estimate edible portion weight as a range (grams_low, grams_high).
   For soups/soto: estimate the whole bowl weight.
4. Give a confidence score 0–1.
5. DO NOT invent or produce any nutrition numbers. Only identify and estimate grams.

Allowed food list (id: name):
${foodListText}`;

    // ── Call Gemini with the image (multimodal) ────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    let visionResult: GeminiVisionResult;
    let modelUsed: string | null = null;
    let isFallback = false;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'AI unavailable, please retry.',
          is_fallback: true,
          is_food: false,
          items: [],
          notCounted: [],
          protein: { low: 0, high: 0 },
          target: { min: 0, max: 0 },
          gap: 0,
          suggestion: { text: '', proteinAdded: 0 },
          model_used: null,
        } satisfies FoodResponseBody,
        { status: 503 }
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Multimodal contents: text system prompt + image inline data
      const contents = [
        { text: systemPrompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ];

      const result = await generateJsonWithRetry<GeminiVisionResult>(
        ai,
        contents,
        VISION_SCHEMA
      );

      visionResult = result.data;
      modelUsed = result.model;
    } catch (err) {
      // Log structured error (never the base64 payload)
      console.error('[food route] Gemini failed after all retries:', (err as Error).message);
      isFallback = true;

      const mealTarget = perMealTarget(daily.min, daily.max, mealsPerDay);
      return NextResponse.json(
        {
          error: lang === 'id'
            ? 'AI tidak tersedia, silakan coba lagi.'
            : 'AI unavailable, please retry.',
          is_fallback: true,
          is_food: false,
          items: [],
          notCounted: [],
          protein: { low: 0, high: 0 },
          target: mealTarget,
          gap: mealTarget.min,
          suggestion: { text: '', proteinAdded: 0 },
          model_used: null,
        } satisfies FoodResponseBody
      );
    }

    // ── is_food=false: friendly message, no protein numbers ───────────────
    if (!visionResult.is_food) {
      const mealTarget = perMealTarget(daily.min, daily.max, mealsPerDay);
      return NextResponse.json(
        {
          is_food: false,
          items: [],
          notCounted: [],
          protein: { low: 0, high: 0 },
          target: mealTarget,
          gap: mealTarget.min,
          suggestion: { text: '', proteinAdded: 0 },
          model_used: modelUsed,
          is_fallback: isFallback,
        } satisfies FoodResponseBody
      );
    }

    // ── Validate model-returned food_ids against foods.json ───────────────
    // Any food_id not in our map → treated as unknown (never trust the model blindly)
    const mealItems = visionResult.items
      .filter((item) => item.food_id !== 'unknown' && foodMap.has(item.food_id))
      .map((item) => {
        // Sanitize model estimates: finite, 0–1500 g, low <= high
        const clamp = (g: number) => (Number.isFinite(g) ? Math.min(1500, Math.max(0, g)) : 0);
        const a = clamp(item.grams_low);
        const b = clamp(item.grams_high);
        return { foodId: item.food_id, gramsLow: Math.min(a, b), gramsHigh: Math.max(a, b) };
      })
      .filter((item) => item.gramsHigh > 0);

    const notCountedLabels = visionResult.items
      .filter((item) => item.food_id === 'unknown' || !foodMap.has(item.food_id))
      .map((item) => item.label);

    // ── Deterministic protein computation ─────────────────────────────────
    const mealProtein = computeMealProtein(mealItems, foods);
    const mealTarget = perMealTarget(daily.min, daily.max, mealsPerDay);
    const gap = Math.round((mealTarget.min - mealProtein.high) * 10) / 10;
    const suggestion = suggestAddOn(gap, lang, foods);

    // ── Build rich DetectedItem list for the client ───────────────────────
    const detectedItems: DetectedItem[] = visionResult.items
      .filter((item) => item.food_id !== 'unknown' && foodMap.has(item.food_id))
      .map((item) => {
        const food = foodMap.get(item.food_id)!;
        const perItemResult = mealProtein.perItem.find((p) => p.foodId === item.food_id);
        return {
          food_id: item.food_id,
          name_id: food.name_id,        // always from foods.json
          label: item.label,            // model's description (display only)
          grams_low: item.grams_low,
          grams_high: item.grams_high,
          confidence: item.confidence,
          protein_per_100g: food.protein_per_100g,
          protein_low: perItemResult?.proteinLow ?? 0,
          protein_high: perItemResult?.proteinHigh ?? 0,
        };
      });

    const response: FoodResponseBody = {
      is_food: true,
      items: detectedItems,
      notCounted: [...notCountedLabels, ...mealProtein.notCounted],
      protein: { low: mealProtein.low, high: mealProtein.high },
      target: mealTarget,
      gap,
      suggestion,
      model_used: modelUsed,
      is_fallback: isFallback,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
