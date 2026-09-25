/**
 * LIVE tests: call the real Gemini API with the key in .env.local.
 * Not part of `npm test`. Run manually with: npm run test:live
 * They use quota and can fail during Google-side demand spikes.
 */
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

describe('LIVE: POST /api/assess with real Gemini', () => {
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
    expect(['recomp', 'cut', 'lean_bulk']).toContain(data.assessment.path);
    expect(typeof data.assessment.borderline).toBe('boolean');
    expect(data.assessment.explanation).toBeDefined();
    expect(data.assessment.citations).toBeInstanceOf(Array);
    expect(data.assessment.explanation.length).toBeGreaterThan(20);
    expect(data.referencedReels?.[0]?.placeholder).toBe(true);
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
