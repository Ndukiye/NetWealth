'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Protected } from '@/components/protected';
import { Card, PageHeader, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useChartColors } from '@/lib/chart-theme';
import { CashFlowPoint, CategoryBreakdownPoint } from '@/lib/types';

const COLORS = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#facc15'];

const now = new Date();

function ReportsContent() {
  const [cashFlow, setCashFlow] = useState<CashFlowPoint[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const chartColors = useChartColors();

  useEffect(() => {
    Promise.all([
      api.get<CashFlowPoint[]>('/reports/cash-flow?months=12'),
      api.get<CategoryBreakdownPoint[]>(
        `/reports/category-breakdown?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
      ),
    ])
      .then(([cf, cb]) => {
        setCashFlow(cf);
        setBreakdown(cb);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" subtitle="Cash flow trends and spending breakdowns over time" />

      <Card>
        <h2 className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">
          Cash flow — last 12 months
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={cashFlow}>
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
            <Line type="monotone" dataKey="income" stroke="#34d399" strokeWidth={2} />
            <Line type="monotone" dataKey="expense" stroke="#f87171" strokeWidth={2} />
            <Line type="monotone" dataKey="net" stroke="#60a5fa" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">
          Spending by category — {now.toLocaleString('en-NG', { month: 'long' })}
        </h2>
        {breakdown.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No expenses recorded this month.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={breakdown}
                dataKey="total"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                outerRadius="70%"
                label={(entry) => (entry as unknown as CategoryBreakdownPoint).categoryName}
              >
                {breakdown.map((entry, i) => (
                  <Cell key={entry.categoryId ?? i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  background: chartColors.tooltipBg,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: 8,
                  color: chartColors.tooltipText,
                }}
              />
              <Legend wrapperStyle={{ color: chartColors.tooltipText }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Protected>
      <ReportsContent />
    </Protected>
  );
}
