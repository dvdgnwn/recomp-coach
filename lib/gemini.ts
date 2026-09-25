/**
 * Gemini call wrapper with retry + model fallback.
 *
 * Why: the primary Flash model can return transient 503 ("high demand") or 429.
 * A live demo must not fail because of a short spike, so we:
 *   1. retry the same model with exponential backoff on transient errors,
 *   2. move to the next model in the chain if a model is unavailable (404) or keeps failing,
 *   3. throw the last error if everything fails (the route then shows a visible fallback).
 *
 * Config (.env.local):
 *   GEMINI_MODEL            primary model (default: gemini-3.5-flash)
 *   GEMINI_FALLBACK_MODELS  comma-separated backup models (default: gemini-2.5-flash)
 *   GEMINI_RETRY_BASE_MS    base backoff delay in ms (default: 800)
 */

export interface GenerateContentClient {
  models: {
    generateContent(args: {
      model: string;
      contents: GeminiContents;
      config?: Record<string, unknown>;
    }): Promise<{ text?: string | null }>;
  };
}

/** Plain text prompt, or multimodal parts, e.g. [{ text }, { inlineData: { mimeType, data } }]. */
export type GeminiContents =
  | string
  | Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;

export interface GenerateJsonResult<T> {
  data: T;
  model: string;
  attempts: number;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRIES_PER_MODEL = 2; // => up to 3 attempts per model

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; code?: unknown } | null;
  const s = e?.status ?? e?.code;
  return typeof s === 'number' ? s : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function modelChain(): string[] {
  const primary = (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-2.5-flash')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && m !== primary);
  return [primary, ...fallbacks];
}

export async function generateJsonWithRetry<T>(
  ai: GenerateContentClient,
  contents: GeminiContents,
  responseSchema: unknown
): Promise<GenerateJsonResult<T>> {
  const baseDelay = Number(process.env.GEMINI_RETRY_BASE_MS ?? 800);
  let lastError: unknown = new Error('No Gemini model configured');
  let attempts = 0;

  for (const model of modelChain()) {
    for (let i = 0; i <= RETRIES_PER_MODEL; i++) {
      attempts++;
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: { responseMimeType: 'application/json', responseSchema },
        });
        if (!res.text) throw new Error('Empty response received from Gemini API');
        const data = JSON.parse(res.text) as T; // malformed JSON is retried too
        return { data, model, attempts };
      } catch (err) {
        lastError = err;
        const status = statusOf(err);
        console.warn(`[Gemini] model=${model} attempt=${i + 1} failed${status ? ` (status ${status})` : ''}`);
        if (status === 404) break; // model not available for this key -> next model
        if (status !== undefined && !RETRYABLE_STATUS.has(status)) throw err; // e.g. 400/401/403: do not retry
        if (i < RETRIES_PER_MODEL) await sleep(baseDelay * 2 ** i);
      }
    }
  }
  throw lastError;
}
