'use client';

import React, { useState } from 'react';
import { Language, translations } from '@/lib/i18n';
import { Header } from '@/components/Header';
import { AssessmentForm } from '@/components/AssessmentForm';
import { AssessmentResult } from '@/components/AssessmentResult';
import { SupportiveNotice } from '@/components/SupportiveNotice';
import { AssessRequestBody, AssessResponseBody } from './api/assess/route';
import { Sex } from '@/lib/calc';
import { AlertCircle } from 'lucide-react';

export default function Home() {
  const [lang, setLang] = useState<Language>('id');
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [lastSex, setLastSex] = useState<Sex>('male');
  const [assessmentData, setAssessmentData] = useState<AssessResponseBody | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const t = translations[lang];

  // In-memory data deletion (clears state, no persistence)
  const handleClearData = () => {
    setAssessmentData(null);
    setHasConsented(false);
    setApiError(null);
    setToastMessage(t.clearDataConfirm);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleFormSubmit = async (formData: AssessRequestBody) => {
    setIsLoading(true);
    setApiError(null);
    setLastSex(formData.sex);

    try {
      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate assessment');
      }

      setAssessmentData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header
        lang={lang}
        onLanguageChange={setLang}
        onClearData={handleClearData}
        hasData={hasConsented || assessmentData !== null}
      />

      {toastMessage && (
        <div className="mt-3 p-2.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs text-center animate-in fade-in slide-in-from-top-1 duration-200">
          {toastMessage}
        </div>
      )}

      {apiError && (
        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{apiError}</span>
        </div>
      )}

      <div className="mt-4 flex-1">
        {assessmentData?.safety_flag ? (
          <SupportiveNotice
            lang={lang}
            onReset={handleClearData}
          />
        ) : assessmentData ? (
          <AssessmentResult
            data={assessmentData}
            sex={lastSex}
            lang={lang}
            onRecalculate={() => setAssessmentData(null)}
            onClear={handleClearData}
          />
        ) : (
          <AssessmentForm
            lang={lang}
            hasConsented={hasConsented}
            onConsent={setHasConsented}
            onSubmit={handleFormSubmit}
            isLoading={isLoading}
            onClear={handleClearData}
          />
        )}
      </div>

      <footer className="mt-8 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
        <p>Recomp Coach — Built for AI Builder Cup 2026</p>
        <p className="mt-0.5 text-[10px] text-slate-600">
          {lang === 'id' ? 'Edukasi Komposisi Tubuh & Gizi' : 'Body Composition & Nutrition Education'}
        </p>
      </footer>
    </div>
  );
}
