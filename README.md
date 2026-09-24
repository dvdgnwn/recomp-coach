# Recomp Coach

> An AI coach that moves gym beginners off the bathroom scale and onto body composition — grounded in trusted fitness creator content and evidence-based nutrition principles. Built for the AI Builder Cup 2026.

---

## 1. Overview & Problem

Many gym beginners judge their physical progress solely by the bathroom scale. However, when beginning resistance training and consuming adequate protein, individuals can lose fat while simultaneously building muscle tissue. The scale may remain completely flat, yet waist measurements drop and body composition transforms dramatically. 

**Recomp Coach** provides:
- **Deterministic Biometric Evaluation**: US Navy body-fat calculation, Fat-Free Mass Index (FFMI), and evidence-based daily protein targets (1.6–2.2 g/kg).
- **Body Fat Range Visualization**: Always displayed as an estimated range ($\pm 3.5\%$) rather than an inaccurate single number.
- **Gemini Flash Reasoning**: Explains why scale weight alone misleads for the specific user's biometrics and recommends an appropriate pathway (`recomp`, `cut`, or `lean bulk`), citing the creator's video reels.
- **Safety & Non-Medical Guardrails**: Screening for underweight indicators ($\text{BMI} < 18.5$) or restrictive signals, bypassing target coaching to present a supportive, non-medical message encouraging consultation with a doctor or registered dietitian.
- **Privacy & In-Memory State**: Zero data persistence in Step 1 (no server storage, no database, no localStorage). The "Delete My Data" feature immediately clears all in-memory inputs.
- **Bilingual Interface**: Seamless instant toggle between Bahasa Indonesia (ID) and English (EN).

---

## 2. Project Architecture

```
recomp-coach/
├── app/
│   ├── api/
│   │   └── assess/
│   │       └── route.ts         # POST /api/assess (deterministic calculations + Gemini Flash)
│   ├── globals.css              # Mobile-first Tailwind styling
│   ├── layout.tsx               # Root layout & mobile viewport wrapper
│   └── page.tsx                 # Main application view (Consent -> Form -> Result)
├── components/
│   ├── AssessmentForm.tsx       # Biometric input form with real-time validation
│   ├── AssessmentResult.tsx     # Result dashboard (Range bar, FFMI, Protein, Citations)
│   ├── BodyFatRangeBar.tsx      # Visual horizontal range bar (±3.5%)
│   ├── Header.tsx               # App header, ID/EN toggle, in-memory data clear
│   └── SupportiveNotice.tsx     # Non-medical care notice for underweight signals
├── data/
│   └── creator_kb.json          # Creator knowledge base transcripts {id, title, text}
├── lib/
│   ├── calc.ts                  # Pure mathematical formulas (US Navy BF%, FFMI, Protein, BMI)
│   ├── calc.test.ts             # Comprehensive Vitest unit tests
│   └── i18n.ts                  # Bilingual ID/EN translations
├── .env.local                   # Local environment variables (GEMINI_API_KEY)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── SPEC.md                      # AI Builder Cup 2026 specification
```

---

## 3. Environment Variables

Create or maintain a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

> **Note:** Never commit `.env.local` or any `.env*` files to source control. They are strictly ignored in `.gitignore`.

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js 18.17+ or 20+ (tested on Node v24)
- npm 9+ or 11+

### Installation
Install the dependencies:
```bash
npm install
```

### Running the Development Server
Start the local Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Running Unit Tests

The deterministic calculation library is tested using Vitest:

```bash
npm test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

---

## 6. How Step 1 (F1) Works

1. **Consent Screen**:
   Users are greeted with a clear notice that this application provides educational guidance and does not replace medical advice. Users check the consent box to proceed.
2. **Measurement Form**:
   Users enter biological sex, age, weight (kg), height (cm), waist (cm), neck (cm), and hip (cm for females only). All inputs are validated against human physiological ranges.
3. **Assessment Calculation**:
   - `POST /api/assess` evaluates the measurements using `lib/calc.ts`.
   - If BMI $< 18.5$, coaching is skipped and a supportive message is returned immediately.
   - Otherwise, Gemini Flash analyzes the user's metrics against the creator's transcripts (`data/creator_kb.json`) and produces a structured JSON response with the chosen path (`recomp`, `cut`, `lean bulk`), a 4–6 sentence personalized explanation, and cited reel IDs.
4. **Results View**:
   Displays the visual body-fat range bar, FFMI, daily protein target ($1.6\text{–}2.2\text{ g/kg}$), path recommendation badge, coach explanation, and cited creator reels.