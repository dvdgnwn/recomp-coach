import { NextRequest, NextResponse } from 'next/server';
import {
  computeBodyFatNavy,
  computeFFMI,
  proteinTarget,
  computeBMI,
  decidePath,
  Sex,
  FitnessPath,
  PathDecision,
} from '@/lib/calc';
import creatorKb from '@/data/creator_kb.json';
import { GoogleGenAI, Type } from '@google/genai';
import { generateJsonWithRetry } from '@/lib/gemini';
import { translations, Language } from '@/lib/i18n';

export interface AssessRequestBody {
  sex: Sex;
  age: number;
  weight: number;
  height: number;
  waist: number;
  neck: number;
  hip?: number;
  lang?: Language;
}

export interface AssessResponseBody {
  safety_flag: boolean;
  is_fallback?: boolean;
  model_used?: string | null;
  supportive_message?: string;
  metrics: {
    bmi: number;
    bodyFat: {
      low: number;
      mid: number;
      high: number;
    };
    ffmi: number;
    proteinTarget: {
      min: number;
      max: number;
      text: string;
    };
  };
  assessment?: {
    path: FitnessPath;
    borderline: boolean;
    explanation: string;
    citations: string[];
    safety_flag: boolean;
  };
  referencedReels?: Array<{
    id: string;
    title: string;
    text: string;
    placeholder?: boolean;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AssessRequestBody;
    const { sex, age, weight, height, waist, neck, hip, lang = 'id' } = body;

    // Basic validation
    if (!sex || !['male', 'female'].includes(sex)) {
      return NextResponse.json(
        { error: 'Valid sex (male or female) is required' },
        { status: 400 }
      );
    }
    if (!age || age < 18 || age > 100) {
      return NextResponse.json(
        { error: 'Age must be between 18 and 100' },
        { status: 400 }
      );
    }
    if (!weight || weight < 30 || weight > 250) {
      return NextResponse.json(
        { error: 'Weight must be between 30 and 250 kg' },
        { status: 400 }
      );
    }
    if (!height || height < 100 || height > 250) {
      return NextResponse.json(
        { error: 'Height must be between 100 and 250 cm' },
        { status: 400 }
      );
    }
    if (!waist || waist < 40 || waist > 200) {
      return NextResponse.json(
        { error: 'Waist must be between 40 and 200 cm' },
        { status: 400 }
      );
    }
    if (!neck || neck < 20 || neck > 70) {
      return NextResponse.json(
        { error: 'Neck must be between 20 and 70 cm' },
        { status: 400 }
      );
    }
    if (sex === 'female' && (!hip || hip < 50 || hip > 200)) {
      return NextResponse.json(
        { error: 'Hip measurement (50-200 cm) is required for females' },
        { status: 400 }
      );
    }

    // Anatomical validation
    if (sex === 'male' && waist <= neck) {
      return NextResponse.json(
        { error: 'Waist circumference must be greater than neck circumference' },
        { status: 400 }
      );
    }
    if (sex === 'female' && waist + (hip ?? 0) <= neck) {
      return NextResponse.json(
        { error: 'Waist + hip circumference must be greater than neck circumference' },
        { status: 400 }
      );
    }

    // Deterministic calculations
    const bmi = computeBMI(weight, height);
    const bodyFat = computeBodyFatNavy(sex, height, waist, neck, hip);
    const ffmi = computeFFMI(weight, height, bodyFat.mid);
    const protein = proteinTarget(weight);

    // Guardrail Check: BMI < 18.5 (underweight / restrictive signals)
    if (bmi < 18.5) {
      const supportiveMsg =
        translations[lang]?.supportiveNoticeMessage ||
        translations.en.supportiveNoticeMessage;

      const response: AssessResponseBody = {
        safety_flag: true,
        is_fallback: false,
        supportive_message: supportiveMsg,
        metrics: {
          bmi,
          bodyFat,
          ffmi,
          proteinTarget: protein,
        },
      };

      return NextResponse.json(response);
    }

    // Requirement 1: Deterministic path decision moved into code
    const pathDecision = decidePath(
      sex,
      bodyFat.low,
      bodyFat.mid,
      bodyFat.high,
      ffmi
    );

    // Proceed to Gemini Flash Assessment via Google Gen AI SDK (@google/genai)
    const apiKey = process.env.GEMINI_API_KEY;
    let modelUsed: string | null = null;

    let geminiExplanation: {
      explanation: string;
      citations: string[];
      safety_flag: boolean;
    };
    let isFallback = false;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
You are the AI Recomp Coach for a fitness creator. Your purpose is to move gym beginners off the bathroom scale and onto body composition.

User Biometric Profile:
- Biological Sex: ${sex}
- Age: ${age}
- Weight: ${weight} kg
- Height: ${height} cm
- BMI: ${bmi}
- Estimated Body Fat Range: around ${Math.round(bodyFat.low)}–${Math.round(bodyFat.high)}%
- Fat-Free Mass Index (FFMI): ${ffmi}
- Recommended Protein Target: ${protein.text}
- Decided Fitness Path: "${pathDecision.path}"${pathDecision.borderline ? ' (borderline threshold crossed, defaulting to recomp for safety)' : ''}
- User's Selected Language: ${lang === 'id' ? 'Bahasa Indonesia (Indonesian)' : 'English'}

Creator Knowledge Base:
${JSON.stringify(creatorKb, null, 2)}

CRITICAL PROMPT RULES:
1. The fitness path has ALREADY been decided by deterministic formula: "${pathDecision.path}". Do NOT choose or propose another path. Your explanation MUST be strictly consistent with the decided path: "${pathDecision.path}".
2. NEVER state a single body-fat number or any decimal percentage. ALWAYS refer to the range (e.g. "around ${Math.round(bodyFat.low)}–${Math.round(bodyFat.high)}%").
3. Explain in 4–6 short sentences why scale weight alone misleads for this specific user and why the "${pathDecision.path}" path makes sense for their body composition. Speak in a warm, encouraging, science-grounded tone.
4. Cite relevant creator reel IDs (e.g. "reel_01", "reel_02", "reel_03") from the creator knowledge base in the citations array.
5. Follow SPEC §4 guardrails (no extreme deficits >20%, no body fat below healthy ranges, not medical advice).
6. LANGUAGE REQUIREMENT: You MUST write the explanation entirely in ${lang === 'id' ? 'Bahasa Indonesia (Indonesian)' : 'English'}.
`;

        // Path is removed from the Gemini response schema; Gemini only explains the decided path.
        // Retries transient errors (503/429) and falls back to backup models (see lib/gemini.ts).
        const result = await generateJsonWithRetry<typeof geminiExplanation>(
          ai,
          prompt,
          {
              type: Type.OBJECT,
              properties: {
                explanation: {
                  type: Type.STRING,
                  description:
                    '4 to 6 short sentences explaining why scale weight alone misleads for this user and why this decided path is appropriate, referring to body fat strictly as a range.',
                },
                citations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description:
                    'Array of reel IDs cited from creator knowledge base (e.g. reel_01, reel_02)',
                },
                safety_flag: {
                  type: Type.BOOLEAN,
                  description:
                    'False for standard coaching; true if restrictive/unhealthy trends detected',
                },
              },
              required: ['explanation', 'citations', 'safety_flag'],
            }
        );
        geminiExplanation = result.data;
        modelUsed = result.model;
      } catch (geminiError) {
        // Never hide failures. Log full error on the server!
        console.error('[Gemini API Call Failed] Full error:', geminiError);
        isFallback = true;
        geminiExplanation = generateDeterministicFallback(
          pathDecision,
          bodyFat.low,
          bodyFat.high,
          lang
        );
      }
    } else {
      console.warn('GEMINI_API_KEY is not set on server. Using deterministic fallback.');
      isFallback = true;
      geminiExplanation = generateDeterministicFallback(
        pathDecision,
        bodyFat.low,
        bodyFat.high,
        lang
      );
    }

    // Filter cited reels to include their title, snippet, and placeholder flag
    const referencedReels = creatorKb.filter((r) =>
      geminiExplanation.citations?.includes(r.id)
    );

    const responsePayload: AssessResponseBody = {
      safety_flag: geminiExplanation.safety_flag,
      is_fallback: isFallback,
      model_used: modelUsed,
      metrics: {
        bmi,
        bodyFat,
        ffmi,
        proteinTarget: protein,
      },
      assessment: {
        path: pathDecision.path,
        borderline: pathDecision.borderline,
        explanation: geminiExplanation.explanation,
        citations: geminiExplanation.citations,
        safety_flag: geminiExplanation.safety_flag,
      },
      referencedReels, // only reels Gemini actually cited
    };

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Deterministic fallback that clearly indicates it is a static rule-based guide,
 * consistent with decided path, and refers strictly to body fat range.
 */
function generateDeterministicFallback(
  pathDecision: PathDecision,
  bfLow: number,
  bfHigh: number,
  lang: Language
): {
  explanation: string;
  citations: string[];
  safety_flag: boolean;
} {
  const rangeStrId = `sekitar ${Math.round(bfLow)}–${Math.round(bfHigh)}%`;
  const rangeStrEn = `around ${Math.round(bfLow)}–${Math.round(bfHigh)}%`;

  if (lang === 'id') {
    return {
      explanation: `[Panduan Statis Standar — AI Offline] Berdasarkan kalkulasi komposisi tubuh: estimasi lemak tubuh Anda berada pada rentang ${rangeStrId}. Fluktuasi cairan dan massa otot sering membuat angka timbangan tampak tidak berubah meski pembakaran cadangan lemak sedang berlangsung. Berdasarkan indikator ini, jalur yang direkomendasikan adalah ${pathDecision.path}${pathDecision.borderline ? ' (karena berada pada batas ambang, recomposition dipilih sebagai opsi paling seimbang)' : ''}. Pertahankan asupan protein harian yang konsisten dan catat perkembangan lingkar tubuh Anda alih-alih hanya berpatokan pada timbangan.`,
      citations: ['reel_01', 'reel_02'],
      safety_flag: false,
    };
  } else {
    return {
      explanation: `[Standard Static Guidance — AI Offline] Based on standard body composition calculations: your estimated body fat falls within the range of ${rangeStrEn}. Fluid shifts and muscle growth frequently keep scale weight flat even while body fat decreases. Based on your metrics, the decided path is ${pathDecision.path}${pathDecision.borderline ? ' (since your range spans category thresholds, recomposition was assigned as the most balanced approach)' : ''}. Focus on hitting your daily protein target consistently and monitor waist measurements rather than relying solely on the bathroom scale.`,
      citations: ['reel_01', 'reel_02'],
      safety_flag: false,
    };
  }
}
