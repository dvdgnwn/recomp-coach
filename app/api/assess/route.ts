import { NextRequest, NextResponse } from 'next/server';
import {
  computeBodyFatNavy,
  computeFFMI,
  proteinTarget,
  computeBMI,
  Sex,
} from '@/lib/calc';
import creatorKb from '@/data/creator_kb.json';
import { GoogleGenAI, Type } from '@google/genai';
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
    path: 'recomp' | 'cut' | 'lean bulk';
    explanation: string;
    citations: string[];
    safety_flag: boolean;
  };
  referencedReels?: Array<{
    id: string;
    title: string;
    text: string;
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
    if (!age || age < 15 || age > 100) {
      return NextResponse.json(
        { error: 'Age must be between 15 and 100' },
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

    // Proceed to Gemini Flash Assessment via Google Gen AI SDK (@google/genai)
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

    let assessmentResult: {
      path: 'recomp' | 'cut' | 'lean bulk';
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
- Estimated Body Fat: ${bodyFat.low}% - ${bodyFat.high}% (Midpoint: ${bodyFat.mid}%)
- Fat-Free Mass Index (FFMI): ${ffmi}
- Recommended Protein Target: ${protein.text}
- User's Selected Language: ${lang === 'id' ? 'Bahasa Indonesia (Indonesian)' : 'English'}

Creator Knowledge Base:
${JSON.stringify(creatorKb, null, 2)}

Instructions:
1. Pick exactly ONE path: "recomp", "cut", or "lean bulk".
   - Guide: If body fat is high (>22% male, >30% female), suggest "cut". If body fat is very low (<12% male, <20% female), suggest "lean bulk". Otherwise or for beginners, suggest "recomp".
2. Explain in 4–6 short sentences why scale weight alone misleads for this specific user. Speak in a warm, encouraging, science-grounded tone.
3. Cite the relevant creator reel IDs (e.g. "reel_01", "reel_02", "reel_03") from the creator knowledge base in the citations array.
4. Follow SPEC §4 guardrails:
   - Never recommend extreme calorie deficits (>20%).
   - Never recommend body fat below healthy ranges.
   - Do NOT give medical advice or clinical diagnosis.
   - If language indicates extreme restriction, set safety_flag: true.
5. LANGUAGE REQUIREMENT: You MUST write the explanation entirely in ${lang === 'id' ? 'Bahasa Indonesia (Indonesian)' : 'English'}.
`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                path: {
                  type: Type.STRING,
                  enum: ['recomp', 'cut', 'lean bulk'],
                },
                explanation: {
                  type: Type.STRING,
                },
                citations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                safety_flag: {
                  type: Type.BOOLEAN,
                },
              },
              required: ['path', 'explanation', 'citations', 'safety_flag'],
            },
          },
        });

        const text = response.text;
        if (!text) {
          throw new Error('Empty response received from Gemini API');
        }
        assessmentResult = JSON.parse(text);
      } catch (geminiError) {
        // Requirement 3: Never hide failures. Log full error on the server!
        console.error('[Gemini API Call Failed] Full error:', geminiError);
        isFallback = true;
        assessmentResult = generateDeterministicFallback(sex, bodyFat.mid, lang);
      }
    } else {
      console.warn('GEMINI_API_KEY is not set on server. Using deterministic fallback.');
      isFallback = true;
      assessmentResult = generateDeterministicFallback(sex, bodyFat.mid, lang);
    }

    // Filter cited reels to include their title and snippet
    const referencedReels = creatorKb.filter((r) =>
      assessmentResult.citations?.includes(r.id)
    );

    const responsePayload: AssessResponseBody = {
      safety_flag: assessmentResult.safety_flag,
      is_fallback: isFallback,
      metrics: {
        bmi,
        bodyFat,
        ffmi,
        proteinTarget: protein,
      },
      assessment: assessmentResult,
      referencedReels: referencedReels.length > 0 ? referencedReels : creatorKb.slice(0, 2),
    };

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Deterministic fallback that clearly indicates it is a static rule-based guide,
 * ensuring it never pretends to be an AI-generated answer (Requirement 3).
 */
function generateDeterministicFallback(
  sex: Sex,
  bfMid: number,
  lang: Language
): {
  path: 'recomp' | 'cut' | 'lean bulk';
  explanation: string;
  citations: string[];
  safety_flag: boolean;
} {
  let path: 'recomp' | 'cut' | 'lean bulk' = 'recomp';
  if ((sex === 'male' && bfMid > 22) || (sex === 'female' && bfMid > 30)) {
    path = 'cut';
  } else if ((sex === 'male' && bfMid < 12) || (sex === 'female' && bfMid < 20)) {
    path = 'lean bulk';
  }

  if (lang === 'id') {
    return {
      path,
      explanation:
        '[Panduan Statis Standar — AI Offline] Berdasarkan rumus baku komposisi tubuh: fluktuasi air, glikogen, dan massa otot sering membuat berat timbangan tampak tidak berubah meski pembakaran lemak sedang berlangsung. Pembentukan massa otot membutuhkan asupan protein yang konsisten serta beban latihan bertahap. Jangan menggunakan angka timbangan sebagai satu-satunya tolak ukur keberhasilan fisik Anda. Catat ukuran lingkar pinggang dan tingkat kekuatan latihan Anda secara berkala.',
      citations: ['reel_01', 'reel_02'],
      safety_flag: false,
    };
  } else {
    return {
      path,
      explanation:
        '[Standard Static Guidance — AI Offline] Based on standard biometric thresholds: fluctuations in water, muscle glycogen, and lean tissue frequently keep total scale weight stationary even while body fat decreases. Muscle retention and growth depend on consistent protein intake and progressive overload in resistance training. Do not rely solely on bathroom scale numbers to gauge your fitness progress. Track changes in waist circumference and gym performance over time.',
      citations: ['reel_01', 'reel_02'],
      safety_flag: false,
    };
  }
}
