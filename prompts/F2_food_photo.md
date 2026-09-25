# F2 — Food photo → protein (build brief)

Build F2 only. Do not change F1 behaviour, `lib/calc.ts` formulas, or `decidePath`.

## Hard rules
- The model identifies foods and estimates grams. It NEVER produces nutrient numbers. All protein math is deterministic code using `data/foods.json` (TKPI subset, per 100 g edible portion).
- Reuse `generateJsonWithRetry` from `lib/gemini.ts` for the Gemini call (it already supports multimodal `contents` and retry/fallback). Do not create a second Gemini client wrapper.
- Photos are processed in memory only: never write them to disk, logs, localStorage or any storage. Do not log base64 data.
- Do not show calories or any weight-loss/deficit message on this page. Protein only (guardrail: this audience is weight-insecure).
- All new UI text goes through `lib/i18n.ts` (ID and EN).
- Default `npm test` must not call the real Gemini API (mock `@google/genai` the same way `lib/api.test.ts` does).

## 1. `lib/nutrition.ts` (pure functions + unit tests in `lib/nutrition.test.ts`)
- `loadFoods()` → typed list from `data/foods.json`.
- `computeMealProtein(items: {foodId: string; gramsLow: number; gramsHigh: number}[])` → `{ low, high, perItem: [...] }`, protein = protein_per_100g × grams / 100, rounded to 0.1 g. Unknown or invalid `foodId` → excluded and returned in `notCounted`.
- `perMealTarget(dailyMin, dailyMax, mealsPerDay)` → `{ min, max }`.
- `suggestAddOn(gapGrams, lang)` → the smallest single add-on from this fixed list that closes the gap, else the two-item combination with the smallest total: 1 egg = `tkpi_1039` × 55 g; tempe goreng = `tkpi_0379` × 50 g; tahu goreng = `tkpi_0358` × 100 g; ayam goreng dada = `tkpi_0800` × 100 g. Return text + protein it adds. If gap ≤ 0 return a "target met" message.

## 2. `POST /api/food`
- Body JSON: `{ imageBase64, mimeType, lang, weightKg, mealsPerDay }`. Accept only image/jpeg, image/png, image/webp. Reject > 4 MB decoded with 413. Validate weightKg 30–250, mealsPerDay 3 or 4.
- Prompt Gemini with the image plus the list of allowed foods (`id` + `name_id` only). Ask it to: identify each visible food item; choose `food_id` from the list or `"unknown"` with a short `label`; estimate edible grams as a range (`grams_low`, `grams_high`); give `confidence` 0–1; set `is_food=false` if the photo is not a meal. Soups/soto: estimate the whole bowl weight.
- Structured output schema: `{ is_food: boolean, items: [{ food_id, label, grams_low, grams_high, confidence }] }`. Treat any `food_id` not in `foods.json` as unknown (never trust the model blindly).
- Response: detected items (with names from foods.json), protein range, per-meal target, gap, suggestion, `notCounted`, `model_used`, `is_fallback`. If Gemini fails after retries: return a clear "AI unavailable, please retry" error — there is no deterministic fallback for vision.

## 3. UI `/food` (link from header: "Cek Komposisi" | "Foto Makanan")
- Inputs: weight (kg), meals per day (3/4), photo via `<input type="file" accept="image/*" capture="environment">`.
- Resize on the client to max 1024 px (JPEG, quality 0.8) before upload.
- Show: photo preview; list of detected items, each with a portion control (Kecil / Sedang / Besar = ×0.75 / ×1 / ×1.25 of the estimate) that recalculates protein on the client with `computeMealProtein` (no new AI call); "not counted" items listed with a note; protein range vs per-meal target bar; the add-on suggestion; small notes: "Estimasi dari foto, bukan penimbangan" and "Foto tidak disimpan".
- Loading state with text while Gemini runs (it takes several seconds).

## 4. Tests (mocked Gemini)
- nutrition: math, rounding, unknown ids excluded, suggestion picks smallest sufficient add-on, gap ≤ 0 message.
- api/food: happy path; model returns an id not in foods.json → notCounted; `is_food=false` → friendly message, no protein; wrong mime → 400; >4 MB → 413; Gemini fails on all models → error with `is_fallback` true and no fake numbers.

Show me your plan first. After building, run `npm test` and report results. Do not deploy. Do not touch `.env.local`.
