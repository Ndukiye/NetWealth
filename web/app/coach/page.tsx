'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Lightbulb,
  Stethoscope,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Protected } from '@/components/protected';
import { AdvisorChat } from '@/components/advisor-chat';
import { Badge, Button, Card, ErrorText, Field, Input, PageHeader, Select, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import {
  FinancialPlan,
  FinancialReview,
  PlanFeasibility,
  PlanGoalType,
  PlannerDefaults,
  ReviewStatus,
  RiskAppetite,
} from '@/lib/types';

const GOAL_TABS: Array<{ value: PlanGoalType; label: string; hint: string }> = [
  { value: 'RETIREMENT', label: 'Retire early', hint: 'When can I stop working?' },
  { value: 'TARGET_AMOUNT', label: 'Save for a target', hint: 'House, car, school fees...' },
  { value: 'WEALTH_GROWTH', label: 'Grow my wealth', hint: 'What could my money become?' },
];

const RISK_OPTIONS: Array<{ value: RiskAppetite; label: string; hint: string }> = [
  {
    value: 'CONSERVATIVE',
    label: 'Conservative',
    hint: 'Protect what I have — steady, government-backed returns.',
  },
  {
    value: 'BALANCED',
    label: 'Balanced',
    hint: 'A mix of growth and stability. Good default for 5+ year goals.',
  },
  {
    value: 'AGGRESSIVE',
    label: 'Aggressive',
    hint: 'Maximise growth, accept big swings. For 10+ year horizons.',
  },
];

const REVIEW_STYLE: Record<
  ReviewStatus,
  { label: string; icon: typeof CheckCircle2; iconClass: string }
> = {
  good: {
    label: 'Good',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  watch: {
    label: 'Watch',
    icon: AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  action: {
    label: 'Needs action',
    icon: XCircle,
    iconClass: 'text-red-600 dark:text-red-400',
  },
};

const FEASIBILITY_STYLE: Record<PlanFeasibility, string> = {
  on_track:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
  achievable:
    'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300',
  stretch:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  unrealistic:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
  projection:
    'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300',
};

const ALLOCATION_BAR_COLORS = ['bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500'];

function CoachContent() {
  const [review, setReview] = useState<FinancialReview | null>(null);
  const [defaults, setDefaults] = useState<PlannerDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [goalType, setGoalType] = useState<PlanGoalType>('RETIREMENT');
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite>('BALANCED');
  const [currentAge, setCurrentAge] = useState('30');
  const [retirementAge, setRetirementAge] = useState('45');
  const [monthlyLifestyleCost, setMonthlyLifestyleCost] = useState('');
  const [goalLabel, setGoalLabel] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [horizonYears, setHorizonYears] = useState('10');
  const [startingCapital, setStartingCapital] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');

  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [planError, setPlanError] = useState('');
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    Promise.all([api.get<FinancialReview>('/planner/review'), api.get<PlannerDefaults>('/planner/defaults')])
      .then(([rev, def]) => {
        setReview(rev);
        setDefaults(def);
        setMonthlyLifestyleCost(String(def.suggestedMonthlyLifestyleCost || ''));
        setStartingCapital(String(def.startingCapital || ''));
        setMonthlyContribution(String(def.currentMonthlySavings || ''));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your financial picture'))
      .finally(() => setLoading(false));
  }, []);

  async function buildPlan(e: FormEvent) {
    e.preventDefault();
    setPlanError('');
    setBuilding(true);
    setPlan(null);
    try {
      const body: Record<string, unknown> = {
        goalType,
        riskAppetite,
        startingCapital: startingCapital === '' ? undefined : Number(startingCapital),
        monthlyContribution: monthlyContribution === '' ? undefined : Number(monthlyContribution),
      };
      if (goalType === 'RETIREMENT') {
        body.currentAge = Number(currentAge);
        body.retirementAge = Number(retirementAge);
        body.monthlyLifestyleCost = monthlyLifestyleCost === '' ? undefined : Number(monthlyLifestyleCost);
      } else if (goalType === 'TARGET_AMOUNT') {
        body.goalLabel = goalLabel || undefined;
        body.targetAmount = Number(targetAmount);
        body.horizonYears = Number(horizonYears);
      } else {
        body.horizonYears = Number(horizonYears);
      }
      const result = await api.post<FinancialPlan>('/planner/plan', body);
      setPlan(result);
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Could not build a plan');
    } finally {
      setBuilding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI Coach"
        subtitle="A financial advisor built on your real numbers — checkup first, then a plan for any goal"
      />

      <ErrorText>{error}</ErrorText>

      {/* --- Advisor chat --- */}
      <AdvisorChat />

      {/* --- Financial checkup --- */}
      {review && (
        <Card>
          <div className="mb-1 flex items-center gap-2">
            <Stethoscope size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Financial checkup</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{review.summary}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {review.items.map((item) => {
              const style = REVIEW_STYLE[item.status];
              const Icon = style.icon;
              return (
                <div
                  key={item.area}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/5 dark:bg-white/[0.02]"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon size={15} className={style.iconClass} />
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.area}
                    </span>
                    <span className="ml-auto">
                      <Badge tone={item.status === 'good' ? 'success' : 'warning'}>{style.label}</Badge>
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.headline}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* --- Goal planner --- */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Compass size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Plan a goal</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Tell the coach what you&apos;re aiming for and your risk appetite — it plans against your
          actual balances, income and spending
          {defaults && defaults.detectedMonthlyIncome > 0
            ? ` (detected income: ~${formatCurrency(defaults.detectedMonthlyIncome)}/month)`
            : ''}
          .
        </p>

        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {GOAL_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setGoalType(tab.value);
                setPlan(null);
                setPlanError('');
              }}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                goalType === tab.value
                  ? 'border-emerald-500/60 bg-emerald-500/10'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  goalType === tab.value
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {tab.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tab.hint}</p>
            </button>
          ))}
        </div>

        <form onSubmit={buildPlan} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {goalType === 'RETIREMENT' && (
              <>
                <Field label="Your age now">
                  <Input
                    type="number"
                    value={currentAge}
                    onChange={(e) => setCurrentAge(e.target.value)}
                    min={15}
                    max={90}
                    required
                  />
                </Field>
                <Field label="Retire at age">
                  <Input
                    type="number"
                    value={retirementAge}
                    onChange={(e) => setRetirementAge(e.target.value)}
                    min={16}
                    max={100}
                    required
                  />
                </Field>
                <Field label="Monthly lifestyle cost in retirement (NGN)">
                  <Input
                    type="number"
                    value={monthlyLifestyleCost}
                    onChange={(e) => setMonthlyLifestyleCost(e.target.value)}
                    placeholder="Prefilled from your average spend"
                  />
                </Field>
              </>
            )}
            {goalType === 'TARGET_AMOUNT' && (
              <>
                <Field label="What are you saving for? (optional)">
                  <Input
                    value={goalLabel}
                    onChange={(e) => setGoalLabel(e.target.value)}
                    placeholder="e.g. House deposit, MSc fees, new car"
                    maxLength={80}
                  />
                </Field>
                <Field label="Target amount (NGN)">
                  <Input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    min={1}
                    required
                  />
                </Field>
                <Field label="Years until you need it">
                  <Input
                    type="number"
                    value={horizonYears}
                    onChange={(e) => setHorizonYears(e.target.value)}
                    min={0.5}
                    max={60}
                    step={0.5}
                    required
                  />
                </Field>
              </>
            )}
            {goalType === 'WEALTH_GROWTH' && (
              <Field label="Investment horizon (years)">
                <Input
                  type="number"
                  value={horizonYears}
                  onChange={(e) => setHorizonYears(e.target.value)}
                  min={0.5}
                  max={60}
                  step={0.5}
                  required
                />
              </Field>
            )}
            <Field label="Capital to start with (NGN)">
              <Input
                type="number"
                value={startingCapital}
                onChange={(e) => setStartingCapital(e.target.value)}
                placeholder="Prefilled from your balances"
              />
            </Field>
            <Field label="What you can save monthly (NGN)">
              <Input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                placeholder="Prefilled from income − spending"
              />
            </Field>
            <Field label="Risk appetite">
              <Select value={riskAppetite} onChange={(e) => setRiskAppetite(e.target.value as RiskAppetite)}>
                {RISK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {RISK_OPTIONS.find((o) => o.value === riskAppetite)?.hint}
          </p>
          <div>
            <Button type="submit" disabled={building}>
              <TrendingUp size={14} />
              {building ? 'Building your plan...' : 'Build my plan'}
            </Button>
          </div>
        </form>

        {planError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{planError}</p>}
      </Card>

      {/* --- Plan result --- */}
      {plan && (
        <div className="flex flex-col gap-4">
          <div className={`rounded-2xl border px-5 py-4 ${FEASIBILITY_STYLE[plan.feasibility]}`}>
            <p className="text-sm font-semibold">{plan.headline || plan.goalLabel}</p>
            <p className="mt-0.5 text-sm opacity-80">
              {plan.horizonYears} year horizon · {plan.riskAppetite.toLowerCase()} portfolio ·{' '}
              {(plan.expectedRealReturn * 100).toFixed(1)}% assumed real return
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {plan.targetCorpus != null && (
              <Card padding="p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Target pot</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(plan.targetCorpus)}
                </p>
              </Card>
            )}
            <Card padding="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Projected at your pace</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(plan.projectedCorpus)}
              </p>
            </Card>
            {plan.requiredMonthlySavings > 0 && (
              <Card padding="p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Save monthly</p>
                <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(plan.requiredMonthlySavings)}
                </p>
                {plan.suggestedSavingsRate != null && (
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {Math.round(plan.suggestedSavingsRate * 100)}% of income
                  </p>
                )}
              </Card>
            )}
            {plan.lifestyleBudget != null && plan.requiredMonthlySavings > 0 && (
              <Card padding="p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Lifestyle budget</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(plan.lifestyleBudget)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">left each month</p>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                Where to put the money
              </h3>
              <div className="flex flex-col gap-3.5">
                {plan.allocation.map((slice, i) => (
                  <div key={slice.assetClass}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {slice.assetClass}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{slice.pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                      <div
                        className={`h-full rounded-full ${ALLOCATION_BAR_COLORS[i % ALLOCATION_BAR_COLORS.length]}`}
                        style={{ width: `${slice.pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{slice.note}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb size={15} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  The coach&apos;s advice
                </h3>
              </div>
              <ul className="flex flex-col gap-2.5">
                {plan.advice.map((line, i) => (
                  <li
                    key={i}
                    className="rounded-lg border-l-2 border-l-emerald-500/50 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 dark:bg-white/[0.02] dark:text-slate-300"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card padding="p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Assumptions
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-slate-500 dark:text-slate-400">
              {plan.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function CoachPage() {
  return (
    <Protected>
      <CoachContent />
    </Protected>
  );
}
