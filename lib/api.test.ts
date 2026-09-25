import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Gemini SDK so default tests never call the real API (no quota, no flakiness).
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

import { POST } from '../app/api/assess/route';

beforeEach(() => {
  generateContent.mockReset();
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'primary-model';
  process.env.GEMINI_FALLBACK_MODELS = 'backup-model';
  process.env.GEMINI_RETRY_BASE_MS = '1';
});

const okResponse = (citations: string[] = ['reel_01']) => ({
  text: JSON.stringify({
    explanation: 'Scale weight alone misleads because it mixes fat, muscle and water.',
    citations,
    safety_flag: false,
  }),
});
const apiError = (status: number) => Object.assign(new Error(`status ${status}`), { status });

// Male 70 kg, 170 cm, waist 88, neck 38 -> body fat ~16.6–23.6% -> recomp (not borderline)
const recompInput = { sex: 'male', age: 28, weight: 70, height: 170, waist: 88, neck: 38, lang: 'en' };

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assess API Route', () => {
  it('returns supportive notice and safety_flag: true when BMI < 18.5', async () => {
    // 45 kg, 175 cm -> BMI = 14.7 (<18.5)
    const req = createMockRequest({
      sex: 'male',
      age: 22,
      weight: 45,
      height: 175,
      waist: 65,
      neck: 35,
      lang: 'en',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.safety_flag).toBe(true);
    expect(data.supportive_message).toContain('physician or registered dietitian');
    expect(data.assessment).toBeUndefined(); // skips normal coaching
  });

  it('rejects invalid measurements with 400', async () => {
    // waist <= neck
    const req = createMockRequest({
      sex: 'male',
      age: 25,
      weight: 75,
      height: 175,
      waist: 35,
      neck: 40,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('rejects female without hip measurement', async () => {
    const req = createMockRequest({
      sex: 'female',
      age: 25,
      weight: 60,
      height: 165,
      waist: 70,
      neck: 32,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Hip');
  });


  it('rejects users under 18', async () => {
    const res = await POST(createMockRequest({ ...recompInput, age: 16 }));
    expect(res.status).toBe(400);
  });

  it('uses Gemini output and the code-decided path', async () => {
    generateContent.mockResolvedValueOnce(okResponse(['reel_01']));
    const data = await (await POST(createMockRequest(recompInput))).json();
    expect(data.is_fallback).toBe(false);
    expect(data.model_used).toBe('primary-model');
    expect(data.assessment.path).toBe('recomp');
    expect(data.assessment.borderline).toBe(false);
    expect(data.referencedReels.map((r: { id: string }) => r.id)).toEqual(['reel_01']);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('never passes a single body-fat number to Gemini as an example', async () => {
    generateContent.mockResolvedValueOnce(okResponse());
    await POST(createMockRequest(recompInput));
    const prompt: string = generateContent.mock.calls[0][0].contents;
    expect(prompt).toContain('around 17–24%');
    expect(prompt).not.toMatch(/exact bounds/);
  });

  it('retries a transient 503 and succeeds on the same model', async () => {
    generateContent.mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce(okResponse());
    const data = await (await POST(createMockRequest(recompInput))).json();
    expect(data.is_fallback).toBe(false);
    expect(data.model_used).toBe('primary-model');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('switches to the backup model when the primary model is not found (404)', async () => {
    generateContent.mockRejectedValueOnce(apiError(404)).mockResolvedValueOnce(okResponse());
    const data = await (await POST(createMockRequest(recompInput))).json();
    expect(data.is_fallback).toBe(false);
    expect(data.model_used).toBe('backup-model');
    expect(generateContent.mock.calls[1][0].model).toBe('backup-model');
  });

  it('shows a visible fallback when every model keeps failing', async () => {
    generateContent.mockRejectedValue(apiError(503));
    const data = await (await POST(createMockRequest(recompInput))).json();
    expect(data.is_fallback).toBe(true);
    expect(data.model_used).toBeNull();
    expect(data.assessment.explanation).toContain('AI Offline');
    expect(generateContent).toHaveBeenCalledTimes(6); // 3 attempts x 2 models
  });

  it('does not retry non-transient errors such as 400', async () => {
    generateContent.mockRejectedValue(apiError(400));
    const data = await (await POST(createMockRequest(recompInput))).json();
    expect(data.is_fallback).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback when no API key is set', async () => {
    delete process.env.GEMINI_API_KEY;
    const data = await (await POST(createMockRequest(recompInput))).json();
    expect(data.is_fallback).toBe(true);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
