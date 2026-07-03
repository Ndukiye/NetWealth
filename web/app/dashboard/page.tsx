'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Protected } from '@/components/protected';
import { Card, PageHeader, Skeleton } from '@/components/ui';
import { HealthScoreGauge } from '@/components/health-score-gauge';
import { InsightsPanel } from '@/components/insights-panel';
import { AffordCheck } from '@/components/afford-check';
import { api } from '@/lib/api';
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '@/lib/format';
import { useChartColors } from '@/lib/chart-theme';
import { NetWorthReport, CashFlowPoint, FinancialSnapshot, Category } from '@/lib/types';

function DashboardContent() {
  const [netWorth, setNetWorth] = useState<NetWorthReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowPoint[]>([]);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const chartColors = useChartColors();

  useEffect(() => {
    Promise.all([
      api.get<NetWorthReport>('/reports/net-worth'),
      api.get<CashFlowPoint[]>('/reports/cash-flow?months=6'),
      api.get<FinancialSnapshot>('/insights'),
      api.get<Category[]>('/categories'),
    ])
      .then(([nw, cf, ai, cats]) => {
        setNetWorth(nw);
        setCashFlow(cf);
        setSnapshot(ai);
        setCategories(cats);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-16 w-72" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!netWorth) {
    return <div className="text-slate-500 dark:text-slate-400">Could not load net worth data.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" subtitle="Your complete financial picture, in one place" />

      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Net worth</p>
        <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {formatCurrency(netWorth.netWorth)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total assets</p>
            <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(netWorth.totalAssets)}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total liabilities</p>
            <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
          </div>
          <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(netWorth.totalLiabilities)}
          </p>
        </Card>
        <Card>
          {snapshot ? (
            <HealthScoreGauge score={snapshot.healthScore} />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Health score unavailable</p>
          )}
        </Card>
      </div>

      {snapshot && <InsightsPanel insights={snapshot.insights} />}

      <AffordCheck categories={categories} />

      <Card>
        <h2 className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">
          Cash flow — last 6 months
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={cashFlow}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis dataKey="month" stroke={chartColors.axis} fontSize={12} />
            <YAxis stroke={chartColors.axis} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip
              contentStyle={{
                background: chartColors.tooltipBg,
                border: `1px solid ${chartColors.tooltipBorder}`,
                borderRadius: 8,
                color: chartColors.tooltipText,
              }}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Bar dataKey="income" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            Assets by type
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {Object.entries(netWorth.assetsByType).map(([type, amount]) => (
              <li
                key={type}
                className="flex justify-between text-slate-700 dark:text-slate-300"
              >
                <span>{ACCOUNT_TYPE_LABELS[type] ?? type}</span>
                <span>{formatCurrency(amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            Liabilities by type
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {Object.entries(netWorth.liabilitiesByType).length === 0 && (
              <li className="text-slate-400 dark:text-slate-500">No liabilities</li>
            )}
            {Object.entries(netWorth.liabilitiesByType).map(([type, amount]) => (
              <li
                key={type}
                className="flex justify-between text-slate-700 dark:text-slate-300"
              >
                <span>{ACCOUNT_TYPE_LABELS[type] ?? type}</span>
                <span>{formatCurrency(amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Protected>
      <DashboardContent />
    </Protected>
  );
}
