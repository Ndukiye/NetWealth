import { AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui';
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

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">AI Insights</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          auto-generated from your activity
        </span>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nothing to flag right now — check back as you add more transactions.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {insights.map((insight) => {
            const Icon = ICONS[insight.severity];
            return (
              <li
                key={insight.id}
                className={`flex gap-3 rounded-lg border-l-2 bg-slate-50 px-3.5 py-3 dark:bg-white/[0.02] ${COLORS[insight.severity]}`}
              >
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {insight.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {insight.message}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
