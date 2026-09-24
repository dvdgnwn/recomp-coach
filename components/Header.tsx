'use client';

import React from 'react';
import { Language } from '@/lib/i18n';
import { Dumbbell, Globe, Trash2 } from 'lucide-react';

interface HeaderProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onClearData: () => void;
  hasData: boolean;
}

export function Header({
  lang,
  onLanguageChange,
  onClearData,
  hasData,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Dumbbell className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              Recomp Coach
            </h1>
            <p className="text-[10px] text-emerald-400 font-medium">
              Body Composition AI
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasData && (
            <button
              onClick={onClearData}
              title={lang === 'id' ? 'Hapus Data (Bersihkan Memori)' : 'Clear Data (In-Memory)'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors text-xs flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">
                {lang === 'id' ? 'Hapus Data' : 'Clear'}
              </span>
            </button>
          )}

          <button
            onClick={() => onLanguageChange(lang === 'id' ? 'en' : 'id')}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-200 transition-all"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className={lang === 'id' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              ID
            </span>
            <span className="text-slate-600">/</span>
            <span className={lang === 'en' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              EN
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
