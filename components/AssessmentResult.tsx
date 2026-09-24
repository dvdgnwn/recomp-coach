'use client';

import React from 'react';
import { AssessResponseBody } from '@/app/api/assess/route';
import { Language, translations } from '@/lib/i18n';
import { Sex } from '@/lib/calc';
import { BodyFatRangeBar } from './BodyFatRangeBar';
import {
  RotateCcw,
  Sparkles,
  Zap,
  Flame,
  TrendingUp,
  BookOpen,
  AlertTriangle,
  FileText,
} from 'lucide-react';

interface AssessmentResultProps {
  data: AssessResponseBody;
  sex: Sex;
  lang: Language;
  onRecalculate: () => void;
  onClear: () => void;
}

export function AssessmentResult({
  data,
  sex,
  lang,
  onRecalculate,
  onClear,
}: AssessmentResultProps) {
  const t = translations[lang];
  const { metrics, assessment, referencedReels, is_fallback } = data;

  const pathConfig = {
    recomp: {
      label: t.pathRecomp,
      desc:
        lang === 'id'
          ? 'Turunkan persentase lemak sambil membentuk massa otot secara bersamaan.'
          : 'Drop body fat while simultaneously building lean muscle mass.',
      color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      badge: 'bg-emerald-500 text-slate-950',
      icon: Zap,
    },
    cut: {
      label: t.pathCut,
      desc:
        lang === 'id'
          ? 'Fokus pada defisit kalori moderat (10-15%) untuk kesehatan metabolik.'
          : 'Focus on a moderate calorie deficit (10-15%) to improve metabolic health.',
      color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      badge: 'bg-amber-500 text-slate-950',
      icon: Flame,
    },
    'lean bulk': {
      label: t.pathLeanBulk,
      desc:
        lang === 'id'
          ? 'Fokus surplus kalori ringan (200-300 kcal) untuk memaksimalkan hipertrofi.'
          : 'Focus on a slight calorie surplus (200-300 kcal) to maximize hypertrophy.',
      color: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      badge: 'bg-blue-500 text-slate-950',
      icon: TrendingUp,
    },
  };

  const currentPath = assessment?.path || 'recomp';
  const pathInfo = pathConfig[currentPath];
  const PathIcon = pathInfo.icon;

  // FFMI Context interpretation
  const getFfmiContext = (ffmi: number, s: Sex) => {
    if (s === 'male') {
      if (ffmi < 18) return lang === 'id' ? 'Pemula / Massa otot awal' : 'Untrained / Starting base';
      if (ffmi < 20) return lang === 'id' ? 'Massa otot rata-rata' : 'Average muscularity';
      if (ffmi < 22) return lang === 'id' ? 'Massa otot di atas rata-rata' : 'Above average / Athletic';
      return lang === 'id' ? 'Perkembangan otot sangat baik' : 'Well-developed muscularity';
    } else {
      if (ffmi < 15) return lang === 'id' ? 'Pemula / Massa otot awal' : 'Untrained / Starting base';
      if (ffmi < 17) return lang === 'id' ? 'Massa otot rata-rata' : 'Average muscularity';
      if (ffmi < 19) return lang === 'id' ? 'Massa otot di atas rata-rata' : 'Above average / Athletic';
      return lang === 'id' ? 'Perkembangan otot sangat baik' : 'Well-developed muscularity';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Title & Fallback Alert Banner */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-black text-white tracking-tight">
            {t.resultsTitle}
          </h2>
          {is_fallback && (
            <span
              id="ai-unavailable-badge"
              className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold inline-flex items-center gap-1.5 shadow-sm"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              AI unavailable – showing fallback
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {t.resultsSubtitle}
        </p>
      </div>

      {/* Path Recommendation Card */}
      <div className={`rounded-2xl border p-4.5 ${pathInfo.color}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PathIcon className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-bold">
              {t.pathLabel}
            </span>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pathInfo.badge}`}>
            {pathInfo.label}
          </span>
        </div>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          {pathInfo.desc}
        </p>
      </div>

      {/* Body Fat Visual Range Bar */}
      <BodyFatRangeBar bodyFat={metrics.bodyFat} sex={sex} lang={lang} />

      {/* Metrics Row: FFMI & Protein Target */}
      <div className="grid grid-cols-2 gap-3">
        {/* FFMI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t.ffmiLabel}
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {metrics.ffmi}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] text-emerald-400 font-medium">
              {getFfmiContext(metrics.ffmi, sex)}
            </span>
          </div>
        </div>

        {/* Protein Target */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t.proteinLabel}
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {metrics.proteinTarget.min}–{metrics.proteinTarget.max} <span className="text-sm font-semibold text-slate-400">g/d</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium">
              1.6 – 2.2 g/kg /day
            </span>
          </div>
        </div>
      </div>

      {/* Explanation Section */}
      {assessment?.explanation && (
        <div
          className={`rounded-2xl p-4 text-white border ${
            is_fallback
              ? 'bg-slate-900/90 border-amber-500/30'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {is_fallback ? (
                <>
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    {lang === 'id' ? 'Panduan Standar (Statis)' : 'Standard Reference Guidance'}
                  </h3>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {t.coachExplanationTitle}
                  </h3>
                </>
              )}
            </div>

            {is_fallback ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                Static Formula Fallback
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Gemini Flash AI
              </span>
            )}
          </div>

          <div
            className={`relative pl-3 my-2 border-l-2 ${
              is_fallback ? 'border-amber-500/50' : 'border-emerald-500/60'
            }`}
          >
            <p className="text-xs text-slate-300 leading-relaxed">
              {assessment.explanation}
            </p>
          </div>

          {is_fallback && (
            <p className="text-[11px] text-slate-500 mt-2 italic">
              {lang === 'id'
                ? '*Catatan: Ini adalah teks rujukan statis standar karena model AI sedang tidak tersedia.'
                : '*Note: This is standard static reference text because the AI model is temporarily unavailable.'}
            </p>
          )}
        </div>
      )}

      {/* Cited Creator Reels */}
      {referencedReels && referencedReels.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 text-slate-300">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              {t.citedReelsTitle}
            </h3>
          </div>
          <div className="space-y-2.5">
            {referencedReels.map((reel) => (
              <div
                key={reel.id}
                className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-semibold text-slate-100 line-clamp-1">
                    {reel.title}
                  </h4>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono shrink-0">
                    {reel.id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                  "{reel.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-2">
        <button
          onClick={onRecalculate}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{t.recalculateButton}</span>
        </button>
        <button
          onClick={onClear}
          className="w-full py-2.5 px-4 text-center text-xs text-slate-400 hover:text-rose-400 transition-colors"
        >
          {t.clearDataButton}
        </button>
      </div>
    </div>
  );
}
