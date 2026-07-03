import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiAdvisor,
  FinancialSnapshot,
  Insight,
  InsightSeverity,
} from './advisor.interface';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(date);
}

interface TxnRow {
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  occurredAt: Date;
  merchant: string | null;
  description: string;
  categoryId: string | null;
  categoryName: string;
}

@Injectable()
export class RuleBasedAdvisor implements AiAdvisor {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string): Promise<FinancialSnapshot> {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 4, 1);

    const [rawTxns, budgets, goals] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { account: { userId }, occurredAt: { gte: windowStart } },
        include: { category: true },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.budget.findMany({
        where: { userId, month: now.getMonth() + 1, year: now.getFullYear() },
        include: { category: true },
      }),
      this.prisma.goal.findMany({ where: { userId, status: 'ACTIVE' } }),
    ]);

    const txns: TxnRow[] = rawTxns.map((t) => ({
      amount: Number(t.amount),
      type: t.type,
      occurredAt: t.occurredAt,
      merchant: t.merchant,
      description: t.description,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? 'Uncategorized',
    }));

    const currentKey = monthKey(now);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = monthKey(prevMonthDate);

    const sumWhere = (type: 'INCOME' | 'EXPENSE', key: string) =>
      txns
        .filter((t) => t.type === type && monthKey(t.occurredAt) === key)
        .reduce((sum, t) => sum + t.amount, 0);

    const currentIncome = sumWhere('INCOME', currentKey);
    const currentExpense = sumWhere('EXPENSE', currentKey);
    const prevIncome = sumWhere('INCOME', prevKey);
    const prevExpense = sumWhere('EXPENSE', prevKey);

    const savingsRate = currentIncome > 0 ? (currentIncome - currentExpense) / currentIncome : 0;
    const savingsRateScore = Math.round((clamp(savingsRate, 0, 0.4) / 0.4) * 40);

    const budgetsWithSpend = budgets.map((b) => {
      const spent = txns
        .filter((t) => t.type === 'EXPENSE' && t.categoryId === b.categoryId && monthKey(t.occurredAt) === currentKey)
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...b, limit: Number(b.limit), spent, ratio: Number(b.limit) > 0 ? spent / Number(b.limit) : 0 };
    });
    const budgetAdherenceScore =
      budgetsWithSpend.length === 0
        ? 20
        : Math.round(
            (budgetsWithSpend.filter((b) => b.ratio <= 1).length / budgetsWithSpend.length) * 30,
          );

    const currentNet = currentIncome - currentExpense;
    const prevNet = prevIncome - prevExpense;
    let cashFlowTrendScore: number;
    if (currentNet > 0 && currentNet >= prevNet) cashFlowTrendScore = 30;
    else if (currentNet > 0) cashFlowTrendScore = 22;
    else if (currentNet === 0) cashFlowTrendScore = 12;
    else if (currentNet > prevNet) cashFlowTrendScore = 10;
    else cashFlowTrendScore = 0;

    const healthScore = clamp(
      Math.round(savingsRateScore + budgetAdherenceScore + cashFlowTrendScore),
      0,
      100,
    );

    const insights: Insight[] = [
      ...this.budgetInsights(budgetsWithSpend),
      ...this.categorySpikeInsights(txns, now, currentKey),
      ...this.recurringInsights(txns, now, 'EXPENSE'),
      ...this.recurringInsights(txns, now, 'INCOME'),
      ...this.savingsInsight(savingsRate, currentIncome, txns, currentKey, goals),
    ];

    return {
      healthScore,
      healthScoreBreakdown: {
        savingsRate: savingsRateScore,
        budgetAdherence: budgetAdherenceScore,
        cashFlowTrend: cashFlowTrendScore,
      },
      insights: this.prioritize(insights),
    };
  }

  private budgetInsights(
    budgets: Array<{ id: string; category: { name: string }; limit: number; spent: number; ratio: number }>,
  ): Insight[] {
    const insights: Insight[] = [];
    for (const b of budgets) {
      if (b.ratio >= 1) {
        insights.push({
          id: `budget-over-${b.id}`,
          severity: 'warning',
          title: `Over budget on ${b.category.name}`,
          message: `You've spent ${formatNaira(b.spent)} of your ${formatNaira(b.limit)} ${b.category.name} budget this month — ${formatNaira(b.spent - b.limit)} over.`,
        });
      } else if (b.ratio >= 0.85) {
        insights.push({
          id: `budget-near-${b.id}`,
          severity: 'warning',
          title: `Close to your ${b.category.name} limit`,
          message: `You've used ${Math.round(b.ratio * 100)}% of your ${b.category.name} budget — ${formatNaira(b.limit - b.spent)} left this month.`,
        });
      }
    }
    const best = budgets
      .filter((b) => b.limit > 0 && b.ratio < 0.4)
      .sort((a, b) => a.ratio - b.ratio)[0];
    if (best) {
      insights.push({
        id: `budget-good-${best.id}`,
        severity: 'success',
        title: `On track with ${best.category.name}`,
        message: `Nice — you've only used ${Math.round(best.ratio * 100)}% of your ${best.category.name} budget so far this month.`,
      });
    }
    return insights;
  }

  private categorySpikeInsights(txns: TxnRow[], now: Date, currentKey: string): Insight[] {
    const categoryNames = new Set(
      txns.filter((t) => t.type === 'EXPENSE' && t.categoryId).map((t) => t.categoryId as string),
    );

    const priorMonthKeys = [1, 2, 3].map((n) => monthKey(new Date(now.getFullYear(), now.getMonth() - n, 1)));

    const spikes: Array<{ categoryId: string; name: string; current: number; priorAvg: number }> = [];
    for (const categoryId of categoryNames) {
      const categoryTxns = txns.filter((t) => t.type === 'EXPENSE' && t.categoryId === categoryId);
      const current = categoryTxns
        .filter((t) => monthKey(t.occurredAt) === currentKey)
        .reduce((sum, t) => sum + t.amount, 0);

      const priorTotals = priorMonthKeys.map((key) =>
        categoryTxns.filter((t) => monthKey(t.occurredAt) === key).reduce((sum, t) => sum + t.amount, 0),
      );
      const priorMonthsWithData = priorTotals.filter((v) => v > 0).length;
      if (priorMonthsWithData === 0) continue;
      const priorAvg = priorTotals.reduce((sum, v) => sum + v, 0) / priorMonthsWithData;

      if (current > priorAvg * 1.3 && current - priorAvg > 2000) {
        spikes.push({ categoryId, name: categoryTxns[0].categoryName, current, priorAvg });
      }
    }

    return spikes
      .sort((a, b) => b.current - b.priorAvg - (a.current - a.priorAvg))
      .slice(0, 2)
      .map((s) => ({
        id: `spike-${s.categoryId}`,
        severity: 'warning' as InsightSeverity,
        title: `${s.name} spending is up`,
        message: `You've spent ${formatNaira(s.current)} on ${s.name} this month, vs your recent average of ${formatNaira(Math.round(s.priorAvg))}.`,
      }));
  }

  private recurringInsights(txns: TxnRow[], now: Date, type: 'EXPENSE' | 'INCOME'): Insight[] {
    const groups = new Map<string, TxnRow[]>();
    for (const t of txns) {
      if (t.type !== type) continue;
      const key = (t.merchant ?? t.description).toUpperCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    const recurring: Array<{
      key: string;
      avgAmount: number;
      avgIntervalDays: number;
      lastDate: Date;
      occurrences: number;
    }> = [];
    for (const [key, group] of groups) {
      // Require at least 3 occurrences (2 intervals) before calling something
      // "recurring" — two data points can land in range by coincidence.
      if (group.length < 3) continue;
      const sorted = [...group].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push((sorted[i].occurredAt.getTime() - sorted[i - 1].occurredAt.getTime()) / MS_PER_DAY);
      }
      const avgInterval = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
      if (avgInterval < 20 || avgInterval > 40) continue;

      const amounts = sorted.map((t) => t.amount);
      const avgAmount = amounts.reduce((sum, v) => sum + v, 0) / amounts.length;
      const maxDelta = Math.max(...amounts.map((a) => Math.abs(a - avgAmount)));
      if (avgAmount > 0 && maxDelta / avgAmount > 0.2) continue;

      recurring.push({
        key,
        avgAmount,
        avgIntervalDays: Math.round(avgInterval),
        lastDate: sorted[sorted.length - 1].occurredAt,
        occurrences: sorted.length,
      });
    }

    return recurring
      .sort((a, b) => b.occurrences - a.occurrences || b.lastDate.getTime() - a.lastDate.getTime())
      .slice(0, type === 'EXPENSE' ? 3 : 1)
      .map((r) => {
        const nextDate = new Date(r.lastDate.getTime() + r.avgIntervalDays * MS_PER_DAY);
        const label = r.key
          .toLowerCase()
          .replace(/\*/g, '')
          .trim()
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        return type === 'EXPENSE'
          ? {
              id: `subscription-${r.key}`,
              severity: 'prediction' as InsightSeverity,
              title: `Recurring charge: ${label}`,
              message: `~${formatNaira(Math.round(r.avgAmount))} roughly every ${r.avgIntervalDays} days. Next charge expected around ${formatShortDate(nextDate)}.`,
            }
          : {
              id: `income-prediction-${r.key}`,
              severity: 'prediction' as InsightSeverity,
              title: `Next income expected soon`,
              message: `Based on your history, ~${formatNaira(Math.round(r.avgAmount))} from ${label} is expected around ${formatShortDate(nextDate)}.`,
            };
      });
  }

  private savingsInsight(
    savingsRate: number,
    currentIncome: number,
    txns: TxnRow[],
    currentKey: string,
    goals: Array<{ name: string }>,
  ): Insight[] {
    if (currentIncome <= 0) return [];

    if (savingsRate < 0.1) {
      const spendByCategory = new Map<string, number>();
      for (const t of txns) {
        if (t.type !== 'EXPENSE' || monthKey(t.occurredAt) !== currentKey) continue;
        spendByCategory.set(t.categoryName, (spendByCategory.get(t.categoryName) ?? 0) + t.amount);
      }
      const top = [...spendByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
      const goalHint = goals[0]
        ? ` or automating a transfer toward your "${goals[0].name}" goal`
        : '';
      return [
        {
          id: 'savings-low',
          severity: 'info',
          title: 'Savings rate is low this month',
          message: `You've saved ${Math.round(savingsRate * 100)}% of your income so far. ${
            top ? `${top[0]} is your biggest expense (${formatNaira(top[1])}) — ` : ''
          }consider trimming that${goalHint}.`,
        },
      ];
    }

    if (savingsRate >= 0.2) {
      return [
        {
          id: 'savings-good',
          severity: 'success',
          title: 'Healthy savings rate',
          message: `You've saved ${Math.round(savingsRate * 100)}% of your income this month — keep it up.`,
        },
      ];
    }

    return [];
  }

  private prioritize(insights: Insight[]): Insight[] {
    const order: Record<InsightSeverity, number> = { warning: 0, prediction: 1, info: 2, success: 3 };
    return insights.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 6);
  }
}
