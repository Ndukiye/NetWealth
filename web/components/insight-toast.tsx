'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
  X,
} from 'lucide-react';
import { Insight, InsightSeverity } from '@/lib/types';

const ICONS: Record<InsightSeverity, typeof Info> = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  prediction: Sparkles,
};

const COLORS: Record<InsightSeverity, string> = {
  warning: 'text-amber-600 dark:text-amber-400 border-l-amber-500/60',
  info: 'text-sky-600 dark:text-sky-400 border-l-sky-500/60',
  success: 'text-emerald-600 dark:text-emerald-400 border-l-emerald-500/60',
  prediction: 'text-violet-600 dark:text-violet-400 border-l-violet-500/60',
};

const ROTATE_MS = 7000;

/**
 * AI insights as a single rotating popup pinned to the corner — cycles
 * through every insight instead of stacking them into an ever-growing list.
 * Dismissible to a small sparkles bubble; pauses rotation on hover.
 */
export function InsightToast({ insights }: { insights: Insight[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!open || paused || insights.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % insights.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [open, paused, insights.length]);

  if (insights.length === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Show AI insights"
        className="fixed bottom-20 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:scale-105 lg:bottom-6 lg:right-6"
      >
        <Sparkles size={18} />
      </button>
    );
  }

  const insight = insights[index % insights.length];
  const Icon = ICONS[insight.severity];

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-30 sm:left-auto sm:w-96 lg:bottom-6 lg:right-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        key={insight.id}
        className={`insight-toast-in rounded-2xl border border-l-2 border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 ${COLORS[insight.severity]}`}
      >
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            AI insight {index + 1}/{insights.length}
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Dismiss insights"
            className="ml-auto rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex gap-3">
          <Icon size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {insight.title}
            </p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{insight.message}</p>
          </div>
        </div>

        {insights.length > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1.5">
              {insights.map((ins, i) => (
                <button
                  key={ins.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Insight ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index
                      ? 'w-4 bg-emerald-500'
                      : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-white/15 dark:hover:bg-white/30'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setIndex((i) => (i - 1 + insights.length) % insights.length)}
                aria-label="Previous insight"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setIndex((i) => (i + 1) % insights.length)}
                aria-label="Next insight"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
