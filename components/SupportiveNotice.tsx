'use client';

import React from 'react';
import { Language, translations } from '@/lib/i18n';
import { HeartHandshake, ArrowLeft } from 'lucide-react';

interface SupportiveNoticeProps {
  lang: Language;
  onReset: () => void;
}

export function SupportiveNotice({ lang, onReset }: SupportiveNoticeProps) {
  const t = translations[lang];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl max-w-md mx-auto my-4">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
        <HeartHandshake className="w-6 h-6" />
      </div>

      <h2 className="text-xl font-bold text-slate-100 mb-3 tracking-tight">
        {t.supportiveNoticeTitle}
      </h2>

      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 mb-6">
        <p className="text-sm text-slate-300 leading-relaxed">
          {t.supportiveNoticeMessage}
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-all border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'id' ? 'Kembali & Bersihkan Data' : 'Return & Clear Data'}</span>
        </button>
      </div>
    </div>
  );
}
