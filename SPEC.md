# Recomp Coach — Build Spec (AI Builder Cup 2026)

> Working name. Theme: **Sustainability & Social Impact**.
> One-liner: *An AI coach that moves gym beginners off the bathroom scale and onto body composition — grounded in a trusted creator's content and in local food data.*

---

## 1. Problem (why this exists)

- Gym beginners judge their body by scale weight. Same weight, different body shape is the #1 confusion in the creator's audience (his "berat badan ideal" reel: 2.3M views).
- Result: insecurity, wrong decisions (crash cutting, quitting when the scale doesn't move).
- Existing apps are weight- and calorie-centric and weak on Indonesian/JAPAC home food.

## 2. MVP scope — 3 features only

| # | Feature | GenAI role | Deterministic part |
|---|---------|-----------|--------------------|
| F1 | **"Is my weight ideal?" check** — input weight, height, sex, waist, neck (+hip for women). Output: body-fat range, FFMI, recommended path (recomp / cut / lean bulk) and an explanation why scale weight alone misleads. | Explanation + path reasoning, grounded in creator transcripts, with citations to reel IDs. | US Navy body-fat formula, FFMI, protein target. |
| F2 | **Food photo → protein** — user photographs a plate; app returns detected items, estimated grams (range), protein vs daily target, one concrete suggestion. | Gemini vision: identify items, pick from the food list, estimate grams. Structured JSON output. | Nutrient lookup from local food table (TKPI subset). Model never invents nutrient values. |
| F3 | **Weekly check-in agent** — reads last weeks of measurements, protein logs, training log; tells user what is actually happening ("weight flat, waist −2 cm, squat up → recomp is working"). | Agent with function calling over the tools below; reframing message in creator's voice. | Trend calculations. |

**Out of MVP:** creator dashboard (one mockup slide in the deck only), accounts beyond anonymous auth, body-photo analysis (explicitly excluded — inaccurate, invasive, triggers insecurity).

## 3. Architecture

```
[Mobile-first web app (Next.js, bilingual ID/EN)]
        │
        ▼
[Next.js API routes on Firebase App Hosting (runs on Cloud Run)]
   ├── Gemini (Flash tier, via Vertex AI / Google Gen AI SDK)
   │     ├── F1 explain + path       (grounded on creator KB)
   │     ├── F2 vision → JSON        (constrained to food list)
   │     └── F3 agent                (function calling)
   ├── Tools (TypeScript, deterministic)
   │     ├── computeBodyFatNavy(sex, heightCm, waistCm, neckCm, hipCm?)
   │     ├── computeFFMI(weightKg, heightCm, bodyFatPct)
   │     ├── proteinTarget(weightKg)            // 1.6–2.2 g/kg
   │     ├── lookupFood(foodId, grams)          // from food table
   │     └── weeklyTrend(userId)
   ├── Creator KB: transcripts of 20–30 reels as JSON {id, title, text}
   │     → small enough to pass in context (no vector DB needed)
   └── Firestore: anonymous user profile, measurements, logs
       (no photos stored — processed in memory, then discarded)
```

### Formulas (metric)
- Navy body fat, men: `495 / (1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450`
- Navy body fat, women: `495 / (1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450`
- Always display as a **range (±3–4 %)**, never a single "true" number.
- FFMI = lean mass (kg) / height (m)²; lean mass = weight × (1 − BF%).
- Protein target: 1.6–2.2 g/kg bodyweight/day.

### Food data
- Subset of ~150 common Indonesian dishes/ingredients from TKPI (Tabel Komposisi Pangan Indonesia), stored as `data/foods.json` {id, name_id, name_en, protein_per_100g, kcal_per_100g, typical_portion_g}.
- Check the source's license/terms before publishing in the public repo; cite the source in README.
- The vision prompt passes the list of food names; the model must return IDs from that list or `unknown`.

## 4. Guardrails (design, not disclaimers)

1. No extreme targets: never recommend a deficit > 20 % of maintenance; no target body-fat below healthy ranges.
2. Underweight / restrictive signals (low BMI, repeatedly very low logged intake, language about skipping meals or guilt) → stop coaching numbers, show supportive message and suggest a professional.
3. No body photos, no body rankings, no comparisons with other users.
4. Every health explanation cites a creator reel ID or states it's general guidance; "not medical advice" shown once in onboarding.
5. Consent screen before data entry; "delete my data" button.

## 5. Evaluation (goes into the deck)

- **Food photo accuracy:** 30–50 plates, weighed manually → report mean absolute error of protein (grams) and item-recognition accuracy. Script in `eval/food_eval.ts`.
- **Grounding check:** 20 test questions → % answers citing a valid reel ID, % with unsupported claims (manual review).
- **Comprehension pilot:** 15–30 users (Basra Gym / followers) → pre/post quiz on "why same weight, different body".
- **Trend demo:** 2–3 synthetic personas, clearly labelled "simulated data".

## 6. Competition compliance checklist

- [ ] Public GitHub repo created **now** (first commit after 1 Sept 2026)
- [ ] Uses Gemini; deployed on Firebase / Cloud Run
- [ ] All code, docs, deck in **English**; app UI bilingual (ID/EN toggle)
- [ ] Deployed live URL works without login friction (anonymous auth)
- [ ] Demo video < 3 min, public link
- [ ] Deck as PDF
- [ ] Team registered before 4 Oct; both members 21+, not students

## 7. Schedule

| Dates | Deliverable |
|------|-------------|
| 23–29 Sep | Repo + deploy skeleton (day 1). F1 done. Creator collects 20–30 reel transcripts. |
| 30 Sep–6 Oct | F2 done. Start weighing plates for eval. Register team (deadline 4 Oct). |
| 7–12 Oct | F3 agent, guardrails, pilot running. |
| 13–16 Oct | Eval numbers, video (creator), deck + README. **Submit 16 Oct** (2-day buffer). |

---

## 8. First prompt for Antigravity (paste as-is)

> Build step 1 only. Do not build F2 or F3 yet.
>
> Read `SPEC.md` in this repo. Create a mobile-first Next.js (TypeScript, App Router) app called "Recomp Coach" with an ID/EN language toggle, deployable to Firebase App Hosting.
>
> Implement:
> 1. `lib/calc.ts` with pure functions `computeBodyFatNavy`, `computeFFMI`, `proteinTarget` exactly as in SPEC §3, plus unit tests. Body fat returns `{low, mid, high}` with ±3.5 %.
> 2. An onboarding page with consent checkbox, then a form: sex, age, weight (kg), height (cm), waist (cm), neck (cm), hip (cm, women only). Validate ranges.
> 3. API route `POST /api/assess` that computes the numbers with `lib/calc.ts`, then calls Gemini (Flash tier, Google Gen AI SDK, Vertex AI, credentials from environment — never hardcode keys) with: the numbers, the creator knowledge base from `data/creator_kb.json`, and an instruction to (a) pick one path: recomp / cut / lean bulk, (b) explain in 4–6 short sentences why scale weight alone misleads for this user, (c) cite reel IDs used, (d) follow the guardrails in SPEC §4. Use structured JSON output: `{path, explanation, citations[], safety_flag}`.
> 4. If BMI < 18.5 or inputs suggest restriction, skip coaching and return the supportive message from SPEC §4.
> 5. A result page showing body-fat range (as a range bar, not a single number), FFMI, protein target, path, explanation, and cited reels.
> 6. Create `data/creator_kb.json` with 3 placeholder entries in the format `{id, title, text}` — I will replace them with real transcripts.
> 7. README in English with setup, env vars, and deploy steps.
>
> Stop after this and show me how to run it locally and deploy it.
