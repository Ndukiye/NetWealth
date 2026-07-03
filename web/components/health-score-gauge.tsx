const SIZE = 120;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreColor(score: number) {
  if (score >= 70) return '#34d399';
  if (score >= 40) return '#fbbf24';
  return '#f87171';
}

function scoreLabel(score: number) {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'Fair';
  return 'Needs attention';
}

export function HealthScoreGauge({ score }: { score: number }) {
  const offset = CIRCUMFERENCE * (1 - score / 100);
  const color = scoreColor(score);

  return (
    <div className="flex items-center gap-4">
      <svg width={SIZE} height={SIZE} className="-rotate-90 shrink-0">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          className="stroke-slate-200 dark:stroke-white/10"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x={SIZE / 2}
          y={SIZE / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-900 dark:fill-white"
          fontSize="28"
          fontWeight="600"
          transform={`rotate(90 ${SIZE / 2} ${SIZE / 2})`}
        >
          {score}
        </text>
      </svg>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Financial health score</p>
        <p className="text-lg font-semibold" style={{ color }}>
          {scoreLabel(score)}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Based on savings rate, budgets & cash flow
        </p>
      </div>
    </div>
  );
}
