import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async netWorth(userId: string) {
    const accounts = await this.prisma.account.findMany({ where: { userId } });

    const assets = accounts.filter((a) => a.kind === 'ASSET');
    const liabilities = accounts.filter((a) => a.kind === 'LIABILITY');

    const totalAssets = assets.reduce((sum, a) => sum + Number(a.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Number(a.balance), 0);

    const byType = (list: typeof accounts) => {
      const grouped: Record<string, number> = {};
      for (const account of list) {
        grouped[account.type] = (grouped[account.type] ?? 0) + Number(account.balance);
      }
      return grouped;
    };

    return {
      netWorth: totalAssets - totalLiabilities,
      totalAssets,
      totalLiabilities,
      assetsByType: byType(assets),
      liabilitiesByType: byType(liabilities),
    };
  }

  async cashFlow(userId: string, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        occurredAt: { gte: since },
        type: { in: ['INCOME', 'EXPENSE'] },
      },
      select: { amount: true, type: true, occurredAt: true },
    });

    const buckets = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { income: 0, expense: 0 });
    }

    for (const txn of transactions) {
      const d = txn.occurredAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (txn.type === 'INCOME') bucket.income += Number(txn.amount);
      if (txn.type === 'EXPENSE') bucket.expense += Number(txn.amount);
    }

    return Array.from(buckets.entries()).map(([month, totals]) => ({
      month,
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    }));
  }

  async categoryBreakdown(userId: string, month: number, year: number) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { userId },
        type: 'EXPENSE',
        occurredAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
      _sum: { amount: true },
    });

    const categoryIds = rows.map((r) => r.categoryId).filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return rows
      .map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryId ? nameById.get(r.categoryId) ?? 'Uncategorized' : 'Uncategorized',
        total: Number(r._sum.amount ?? 0),
      }))
      .sort((a, b) => b.total - a.total);
  }
}
