'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Language, translations } from '@/lib/i18n';
import { Header } from '@/components/Header';
import { AlertCircle, Camera, Loader2, Info } from 'lucide-react';
import { FoodResponseBody, DetectedItem } from '@/app/api/food/route';

// ─── Client-side protein recalc helper ──────────────────────────────────────
// (computeMealProtein reads fs on server; on the client we inline the math
//  using protein_per_100g values that the API already returned in each item)

type PortionScale = 0.75 | 1 | 1.25;

function clientProtein(item: DetectedItem, scale: PortionScale) {
  const gramsLow = item.grams_low * scale;
  const gramsHigh = item.grams_high * scale;
  return {
    low: Math.round((item.protein_per_100g * gramsLow) / 100 * 10) / 10,
    high: Math.round((item.protein_per_100g * gramsHigh) / 100 * 10) / 10,
  };
}

// ─── Image resize helper (client-side canvas, no libraries) ─────────────────

async function resizeImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(img, 0, 0, width, height);
      // Always output JPEG for consistency
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

// ─── Protein range bar ───────────────────────────────────────────────────────

function ProteinBar({
  low,
  high,
  targetMin,
  targetMax,
  lang,
}: {
  low: number;
  high: number;
  targetMin: number;
  targetMax: number;
  lang: Language;
}) {
  const t = translations[lang];
  const scale = targetMax > 0 ? targetMax * 1.4 : 1;
  const clamp = (v: number) => Math.min(100, (v / scale) * 100);

  const lowPct = clamp(low);
  const highPct = clamp(high);
  const minPct = clamp(targetMin);
  const maxPct = clamp(targetMax);

  const meetsTarget = high >= targetMin;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t.proteinVsTarget}</p>
      <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden">
        {/* Target zone */}
        <div
          className="absolute h-full bg-emerald-500/20 border-x border-emerald-500/40"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        {/* Protein range */}
        <div
          className={`absolute h-full rounded-full ${meetsTarget ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ left: `${lowPct}%`, width: `${Math.max(highPct - lowPct, 1)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>{low}–{high} g</span>
        <span>{t.perMealTargetLabel}: {targetMin}–{targetMax} g</span>
      </div>
    </div>
  );
}

// ─── Detected item card ───────────────────────────────────────────────────────

function DetectedItemCard({
  item,
  lang,
  scale,
  onScaleChange,
}: {
  item: DetectedItem;
  lang: Language;
  scale: PortionScale;
  onScaleChange: (s: PortionScale) => void;
}) {
  const t = translations[lang];
  const protein = clientProtein(item, scale);
  const scales: { label: string; value: PortionScale }[] = [
    { label: t.portionSmall, value: 0.75 },
    { label: t.portionMedium, value: 1 },
    { label: t.portionLarge, value: 1.25 },
  ];

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{item.name_id}</p>
          {item.label !== item.name_id && (
            <p className="text-[11px] text-slate-500 italic">{item.label}</p>
          )}
        </div>
        <span className="text-[11px] text-slate-500 shrink-0">
          {Math.round(item.grams_low * scale)}–{Math.round(item.grams_high * scale)} g
        </span>
      </div>

      {/* Portion toggle — recalculates protein client-side, no new AI call */}
      <div className="flex gap-1.5">
        {scales.map((s) => (
          <button
            key={s.value}
            onClick={() => onScaleChange(s.value)}
            className={`flex-1 text-xs py-1 rounded-lg border transition-colors ${
              scale === s.value
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-right text-sm font-bold text-emerald-400">
        {protein.low}–{protein.high} g protein
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FoodPage() {
  const [lang, setLang] = useState<Language>('id');
  const t = translations[lang];

  // Form state
  const [weightKg, setWeightKg] = useState<string>('');
  const [mealsPerDay, setMealsPerDay] = useState<3 | 4>(3);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result state
  const [result, setResult] = useState<FoodResponseBody | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portion scales per item (keyed by food_id)
  const [scales, setScales] = useState<Record<string, PortionScale>>({});

  // ── Image selection + resize ───────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    setScales({});

    try {
      const resized = await resizeImage(file);
      setImageData(resized);
      // Create object URL for preview (revoked on cleanup)
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    } catch {
      setError(lang === 'id' ? 'Gagal memproses gambar.' : 'Failed to process image.');
    }
  }, [lang]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!imageData) return;
    const weight = parseFloat(weightKg);
    if (!weight || weight < 30 || weight > 250) {
      setError(lang === 'id' ? 'Masukkan berat badan yang valid (30–250 kg).' : 'Enter a valid weight (30–250 kg).');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // imageBase64 never stored or logged — passed in-memory only
        body: JSON.stringify({
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          lang,
          weightKg: weight,
          mealsPerDay,
        }),
      });

      const data: FoodResponseBody = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Error analysing photo');
      }

      setResult(data);
      // Initialise all portion scales to 1 (medium)
      const initialScales: Record<string, PortionScale> = {};
      for (const item of data.items ?? []) {
        initialScales[item.food_id] = 1;
      }
      setScales(initialScales);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.aiUnavailable);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Live protein totals (client recalc based on portion scales) ───────────
  const scaledProtein = result?.items
    ? result.items.reduce(
        (acc, item) => {
          const scale = scales[item.food_id] ?? 1;
          const p = clientProtein(item, scale as PortionScale);
          return { low: acc.low + p.low, high: acc.high + p.high };
        },
        { low: 0, high: 0 }
      )
    : null;

  const displayProtein = scaledProtein
    ? {
        low: Math.round(scaledProtein.low * 10) / 10,
        high: Math.round(scaledProtein.high * 10) / 10,
      }
    : result?.protein;

  return (
    <div className="flex flex-col min-h-full">
      <Header lang={lang} onLanguageChange={setLang} onClearData={() => {
        setResult(null);
        setError(null);
        setPreviewUrl(null);
        setImageData(null);
        setScales({});
        setWeightKg('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }} hasData={!!result || !!previewUrl} />

      <div className="mt-6 flex-1 space-y-5">
        {/* Page title */}
        <div>
          <h2 className="text-xl font-bold text-white">{t.foodPageTitle}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t.foodPageSubtitle}</p>
        </div>

        {/* Input form */}
        {!result && (
          <div className="space-y-4">
            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {t.weightInputLabel}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={30}
                max={250}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="70"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Meals per day */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {t.mealsPerDayLabel}
              </label>
              <div className="flex gap-3">
                {([3, 4] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setMealsPerDay(n)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      mealsPerDay === n
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {n}×
                  </button>
                ))}
              </div>
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {t.photoLabel}
              </label>
              <label className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-emerald-500/60 transition-colors bg-slate-900/50">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Food preview"
                    className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-80"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Camera className="w-8 h-8" />
                    <span className="text-sm">{lang === 'id' ? 'Tap untuk foto' : 'Tap to take photo'}</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {previewUrl && (
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {t.photoPrivacy}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={!imageData || isLoading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t.analyzeButton}
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm">{t.analyzing}</p>
            <p className="text-xs text-slate-500">
              {lang === 'id' ? '(Gemini sedang menganalisis foto Anda...)' : '(Gemini is analysing your photo...)'}
            </p>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="space-y-5">
            {/* Photo preview thumbnail */}
            {previewUrl && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Food"
                  className="w-full max-h-48 object-cover rounded-xl"
                />
                <span className="absolute bottom-2 right-2 text-[10px] bg-slate-900/80 text-slate-400 px-2 py-0.5 rounded-full">
                  {t.photoPrivacy}
                </span>
              </div>
            )}

            {/* Not food message */}
            {!result.is_food && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-sm">
                {t.notFood}
              </div>
            )}

            {/* AI unavailable */}
            {result.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {result.error}
              </div>
            )}

            {/* Protein + items (only shown when is_food=true) */}
            {result.is_food && (
              <>
                {/* Protein bar */}
                {displayProtein && result.target && (
                  <ProteinBar
                    low={displayProtein.low}
                    high={displayProtein.high}
                    targetMin={result.target.min}
                    targetMax={result.target.max}
                    lang={lang}
                  />
                )}

                {/* Detected items with portion toggle */}
                {result.items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      {t.detectedItemsTitle}
                    </p>
                    {result.items.map((item) => (
                      <DetectedItemCard
                        key={item.food_id}
                        item={item}
                        lang={lang}
                        scale={scales[item.food_id] ?? 1}
                        onScaleChange={(s) =>
                          setScales((prev) => ({ ...prev, [item.food_id]: s }))
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Not counted */}
                {result.notCounted && result.notCounted.length > 0 && (
                  <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                    <p className="text-xs font-semibold text-slate-400 mb-1">{t.notCountedTitle}</p>
                    <p className="text-[11px] text-slate-500 mb-2">{t.notCountedNote}</p>
                    <ul className="space-y-0.5">
                      {result.notCounted.map((label) => (
                        <li key={label} className="text-xs text-slate-400">• {label}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Add-on suggestion */}
                {result.suggestion && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      {t.suggestionTitle}
                    </p>
                    <p className="text-sm text-emerald-200">{result.suggestion.text}</p>
                  </div>
                )}
              </>
            )}

            {/* Disclaimers */}
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                {t.estimateDisclaimer}
              </span>
              <span>·</span>
              <span>{t.photoPrivacy}</span>
            </div>

            {/* Retry button */}
            <button
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:border-slate-500 transition-colors"
            >
              {lang === 'id' ? '← Foto Lain' : '← Try Another Photo'}
            </button>
          </div>
        )}
      </div>

      <footer className="mt-8 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
        <p>Recomp Coach — Built for AI Builder Cup 2026</p>
      </footer>
    </div>
  );
}
