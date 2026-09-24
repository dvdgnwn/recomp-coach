'use client';

import React from 'react';
import { BodyFatResult, Sex } from '@/lib/calc';
import { Language } from '@/lib/i18n';
import { Info } from 'lucide-react';

interface BodyFatRangeBarProps {
  bodyFat: BodyFatResult;
  sex: Sex;
  lang: Language;
}

export function BodyFatRangeBar({ bodyFat, sex, lang }: BodyFatRangeBarProps) {
  // Chart bounds based on sex
  const minScale = sex === 'male' ? 5 : 10;
  const maxScale = sex === 'male' ? 40 : 48;
  const totalSpan = maxScale - minScale;

  // Calculate percentage positions on the bar
  const leftPercent = Math.max(0, Math.min(100, ((bodyFat.low - minScale) / totalSpan) * 100));
  const rightPercent = Math.max(0, Math.min(100, ((bodyFat.high - minScale) / totalSpan) * 100));
  const barWidth = Math.max(8, rightPercent - leftPercent);

  const categories =
    sex === 'male'
      ? [
          { label: lang === 'id' ? 'Atletis' : 'Athletic', range: '6–13%' },
          { label: lang === 'id' ? 'Bugar' : 'Fitness', range: '14–17%' },
          { label: lang === 'id' ? 'Rata-rata' : 'Average', range: '18–24%' },
          { label: lang === 'id' ? 'Tinggi' : 'Higher', range: '25%+' },
        ]
      : [
          { label: lang === 'id' ? 'Atletis' : 'Athletic', range: '14–20%' },
          { label: lang === 'id' ? 'Bugar' : 'Fitness', range: '21–24%' },
          { label: lang === 'id' ? 'Rata-rata' : 'Average', range: '25–31%' },
          { label: lang === 'id' ? 'Tinggi' : 'Higher', range: '32%+' },
        ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {lang === 'id' ? 'Rentang Lemak Tubuh' : 'Body Fat Range'}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          ±3.5% Precision
        </span>
      </div>

      <div className="flex items-baseline space-x-2 my-2">
        <span className="text-3xl font-extrabold text-white tracking-tight">
          {bodyFat.low}% – {bodyFat.high}%
        </span>
        <span className="text-xs text-slate-400 font-medium">
          ({lang === 'id' ? 'estimasi US Navy' : 'US Navy estimate'})
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        {lang === 'id'
          ? 'Komposisi tubuh alami selalu berada dalam rentang fluktuatif, bukan satu angka mati.'
          : 'Natural body composition always exists within an estimated range, never a single static number.'}
      </p>

      {/* Visual Range Bar */}
      <div className="relative pt-6 pb-2">
        {/* Floating Range Indicator Tag */}
        <div
          className="absolute -top-1 transition-all duration-500 transform -translate-x-1/2 flex flex-col items-center"
          style={{ left: `${Math.min(92, Math.max(8, leftPercent + barWidth / 2))}%` }}
        >
          <div className="bg-emerald-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shadow-lg shadow-emerald-500/30 whitespace-nowrap">
            {bodyFat.low}% – {bodyFat.high}%
          </div>
          <div className="w-1.5 h-1.5 bg-emerald-500 rotate-45 -mt-0.5"></div>
        </div>

        {/* Base Track */}
        <div className="h-4 w-full bg-slate-800 rounded-full relative overflow-hidden flex">
          <div className="h-full w-1/4 bg-blue-500/30 border-r border-slate-900" />
          <div className="h-full w-1/4 bg-emerald-500/30 border-r border-slate-900" />
          <div className="h-full w-1/4 bg-amber-500/30 border-r border-slate-900" />
          <div className="h-full w-1/4 bg-rose-500/30" />
        </div>

        {/* Highlighted Range Span */}
        <div
          className="absolute top-6 h-4 bg-emerald-400/90 rounded-full border-2 border-emerald-200 shadow-md shadow-emerald-500/50 transition-all duration-700"
          style={{
            left: `${leftPercent}%`,
            width: `${barWidth}%`,
          }}
        />

        {/* Category Labels */}
        <div className="grid grid-cols-4 gap-1 mt-3 pt-1 border-t border-slate-800/80 text-center">
          {categories.map((c, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-medium">{c.label}</span>
              <span className="text-[9px] text-slate-500">{c.range}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          {lang === 'id'
            ? 'Metode lingkar US Navy memiliki margin error wajar ±3–4%. Jangan terpaku pada desimal, pantau tren ukuran lingkar pinggang dari waktu ke waktu.'
            : 'US Navy circumference methods carry a standard ±3–4% margin of error. Track longitudinal changes in waist circumference rather than obsessing over decimals.'}
        </span>
      </div>
    </div>
  );
}
