import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from '../app/api/assess/route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

beforeAll(() => {
  // Ensure .env.local variables are loaded for testing
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const keyMatch = envContent.match(/GEMINI_API_KEY\s*=\s*(.+)/);
    if (keyMatch) {
      process.env.GEMINI_API_KEY = keyMatch[1].trim();
    }
    const modelMatch = envContent.match(/GEMINI_MODEL\s*=\s*(.+)/);
    if (modelMatch) {
      process.env.GEMINI_MODEL = modelMatch[1].trim();
    }
  }
});

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

  // Requirement 5: Test that FAILS if fallback path is used when GEMINI_API_KEY is set
  it('fails if the fallback path is used when GEMINI_API_KEY is set', async () => {
    expect(process.env.GEMINI_API_KEY).toBeTruthy();

    const req = createMockRequest({
      sex: 'male',
      age: 26,
      weight: 75,
      height: 175,
      waist: 82,
      neck: 38,
      lang: 'en',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Must NOT be a fallback; must be real Gemini Flash output
    expect(data.is_fallback).toBe(false);
    expect(data.assessment).toBeDefined();
    expect(data.assessment.explanation).toBeDefined();
    expect(data.assessment.citations).toBeInstanceOf(Array);
    expect(data.assessment.explanation.length).toBeGreaterThan(20);
  }, 30000);

  // Requirement 4: Test that explanation language follows the ID/EN toggle
  it('follows the ID toggle and generates explanation in Indonesian', async () => {
    expect(process.env.GEMINI_API_KEY).toBeTruthy();

    const req = createMockRequest({
      sex: 'male',
      age: 28,
      weight: 78,
      height: 178,
      waist: 86,
      neck: 39,
      lang: 'id',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.is_fallback).toBe(false);
    expect(data.assessment).toBeDefined();
    // Verify explanation contains Indonesian words
    expect(data.assessment.explanation).toMatch(/(komposisi|lemak|otot|timbangan|berat|tubuh|massa)/i);
  }, 30000);
});
