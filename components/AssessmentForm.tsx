'use client';

import React, { useState } from 'react';
import { Sex } from '@/lib/calc';
import { Language, translations } from '@/lib/i18n';
import { ShieldCheck, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { AssessRequestBody } from '@/app/api/assess/route';

interface AssessmentFormProps {
  lang: Language;
  hasConsented: boolean;
  onConsent: (consented: boolean) => void;
  onSubmit: (data: AssessRequestBody) => Promise<void>;
  isLoading: boolean;
  onClear: () => void;
}

export function AssessmentForm({
  lang,
  hasConsented,
  onConsent,
  onSubmit,
  isLoading,
  onClear,
}: AssessmentFormProps) {
  const t = translations[lang];

  // In-memory form state only (no persistence)
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [waist, setWaist] = useState<string>('');
  const [neck, setNeck] = useState<string>('');
  const [hip, setHip] = useState<string>('');
  const [consentCheck, setConsentCheck] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const ageNum = Number(age);
    const weightNum = Number(weight);
    const heightNum = Number(height);
    const waistNum = Number(waist);
    const neckNum = Number(neck);
    const hipNum = Number(hip);

    if (!age || isNaN(ageNum) || ageNum < 15 || ageNum > 100) {
      newErrors.age = t.validationErrors.ageRange;
    }
    if (!weight || isNaN(weightNum) || weightNum < 30 || weightNum > 250) {
      newErrors.weight = t.validationErrors.weightRange;
    }
    if (!height || isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      newErrors.height = t.validationErrors.heightRange;
    }
    if (!waist || isNaN(waistNum) || waistNum < 40 || waistNum > 200) {
      newErrors.waist = t.validationErrors.waistRange;
    }
    if (!neck || isNaN(neckNum) || neckNum < 20 || neckNum > 70) {
      newErrors.neck = t.validationErrors.neckRange;
    }

    if (sex === 'female') {
      if (!hip || isNaN(hipNum) || hipNum < 50 || hipNum > 200) {
        newErrors.hip = t.validationErrors.hipRange;
      } else if (waistNum + hipNum <= neckNum) {
        newErrors.hip = t.validationErrors.waistHipNeckFemale;
      }
    } else {
      if (waistNum && neckNum && waistNum <= neckNum) {
        newErrors.waist = t.validationErrors.waistNeckMale;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      sex,
      age: Number(age),
      weight: Number(weight),
      height: Number(height),
      waist: Number(waist),
      neck: Number(neck),
      hip: sex === 'female' ? Number(hip) : undefined,
      lang,
    });
  };

  // 1. Consent Screen (if not yet accepted)
  if (!hasConsented) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl max-w-md mx-auto my-2 animate-in fade-in duration-200">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold tracking-tight mb-2">
          {t.consentTitle}
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
          {t.consentNotice}
        </p>

        <label className="flex items-start gap-3 cursor-pointer group mb-6 select-none">
          <input
            type="checkbox"
            checked={consentCheck}
            onChange={(e) => setConsentCheck(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-slate-900"
          />
          <span className="text-xs text-slate-300 group-hover:text-slate-200 leading-snug">
            {t.consentCheckbox}
          </span>
        </label>

        <button
          disabled={!consentCheck}
          onClick={() => onConsent(true)}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            consentCheck
              ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>{t.consentContinue}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 2. Onboarding Form
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl max-w-md mx-auto my-2 space-y-4 animate-in fade-in duration-200"
    >
      <div>
        <h2 className="text-lg font-bold tracking-tight text-white">
          {t.formTitle}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {t.formSubtitle}
        </p>
      </div>

      {/* Sex Toggle */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          {t.sexLabel}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSex('male')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
              sex === 'male'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.sexMale}
          </button>
          <button
            type="button"
            onClick={() => setSex('female')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
              sex === 'female'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.sexFemale}
          </button>
        </div>
      </div>

      {/* Age & Weight Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {t.ageLabel}
          </label>
          <input
            type="number"
            min="15"
            max="100"
            placeholder="e.g. 24"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-800/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
              errors.age ? 'border-rose-500' : 'border-slate-700'
            }`}
          />
          {errors.age && (
            <p className="text-[10px] text-rose-400 mt-1">{errors.age}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {t.weightLabel}
          </label>
          <input
            type="number"
            step="0.1"
            min="30"
            max="250"
            placeholder="e.g. 70"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-800/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
              errors.weight ? 'border-rose-500' : 'border-slate-700'
            }`}
          />
          {errors.weight && (
            <p className="text-[10px] text-rose-400 mt-1">{errors.weight}</p>
          )}
        </div>
      </div>

      {/* Height & Waist Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {t.heightLabel}
          </label>
          <input
            type="number"
            step="0.5"
            min="100"
            max="250"
            placeholder="e.g. 175"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-800/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
              errors.height ? 'border-rose-500' : 'border-slate-700'
            }`}
          />
          {errors.height && (
            <p className="text-[10px] text-rose-400 mt-1">{errors.height}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {t.waistLabel}
          </label>
          <input
            type="number"
            step="0.5"
            min="40"
            max="200"
            placeholder="e.g. 82"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-800/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
              errors.waist ? 'border-rose-500' : 'border-slate-700'
            }`}
          />
          {errors.waist && (
            <p className="text-[10px] text-rose-400 mt-1">{errors.waist}</p>
          )}
        </div>
      </div>

      {/* Neck & Hip (if female) Row */}
      <div className={`grid ${sex === 'female' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {t.neckLabel}
          </label>
          <input
            type="number"
            step="0.5"
            min="20"
            max="70"
            placeholder="e.g. 38"
            value={neck}
            onChange={(e) => setNeck(e.target.value)}
            className={`w-full px-3 py-2 bg-slate-800/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
              errors.neck ? 'border-rose-500' : 'border-slate-700'
            }`}
          />
          {errors.neck && (
            <p className="text-[10px] text-rose-400 mt-1">{errors.neck}</p>
          )}
        </div>

        {sex === 'female' && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.hipLabel}
            </label>
            <input
              type="number"
              step="0.5"
              min="50"
              max="200"
              placeholder="e.g. 95"
              value={hip}
              onChange={(e) => setHip(e.target.value)}
              className={`w-full px-3 py-2 bg-slate-800/90 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                errors.hip ? 'border-rose-500' : 'border-slate-700'
              }`}
            />
            {errors.hip && (
              <p className="text-[10px] text-rose-400 mt-1">{errors.hip}</p>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>{t.calculating}</span>
            </>
          ) : (
            <span>{t.submitButton}</span>
          )}
        </button>
      </div>

      {/* In-Memory Reset / Clear button */}
      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => {
            setAge('');
            setWeight('');
            setHeight('');
            setWaist('');
            setNeck('');
            setHip('');
            setErrors({});
            onClear();
          }}
          className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
        >
          {t.clearDataButton}
        </button>
      </div>
    </form>
  );
}
