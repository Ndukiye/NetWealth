import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AffordCheckDto } from './dto/afford-check.dto';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export type AffordVerdict = 'affordable' | 'tight' | 'not_affordable';

@Injectable()
export class SimulatorService {
  constructor(private readonly prisma: PrismaService) {}

  async affordCheck(userId: string, dto: AffordCheckDto) {
    const liquidAccounts = await this.prisma.account.findMany({
      where: {
        userId,
        kind: 'ASSET',
        type: { in: ['BANK', 'CASH'] },
        ...(dto.accountId ? { id: dto.accountId } : {}),
      },
    });
    if (dto.accountId && liquidAccounts.length === 0) {
      throw new NotFoundException('Account not found');
    }

    const liquidBalance = liquidAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const remainingAfterPurchase = liquidBalance - dto.amount;

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const recentExpenseTxns = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        type: 'EXPENSE',
        occurredAt: { gte: threeMonthsAgo, lt: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
      select: { amount: true, occurredAt: true },
    });
    const monthsWithData = new Set(recentExpenseTxns.map((t) => monthKey(t.occurredAt))).size || 1;
    const avgMonthlyExpense =
      recentExpenseTxns.reduce((sum, t) => sum + Number(t.amount), 0) / monthsWithData;

    let verdict: AffordVerdict;
    if (remainingAfterPurchase < 0) {
      verdict = 'not_affordable';
    } else if (avgMonthlyExpense > 0 && remainingAfterPurchase < avgMonthlyExpense * 0.5) {
      verdict = 'tight';
    } else {
      verdict = 'affordable';
    }

    let budgetImpact: { categoryName: string; spent: number; limit: number; overBy: number } | null =
      null;
    if (dto.categoryId) {
      const budget = await this.prisma.budget.findUnique({
        where: {
          userId_categoryId_month_year: {
            userId,
            categoryId: dto.categoryId,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
          },
        },
        include: { category: true },
      });
      if (budget) {
        const spentAgg = await this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            categoryId: dto.categoryId,
            type: 'EXPENSE',
            account: { userId },
            occurredAt: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            },
          },
        });
        const spent = Number(spentAgg._sum.amount ?? 0);
        const projected = spent + dto.amount;
        budgetImpact = {
          categoryName: budget.category.name,
          spent: projected,
          limit: Number(budget.limit),
          overBy: Math.max(0, projected - Number(budget.limit)),
        };
      }
    }

    const message = this.buildMessage(verdict, dto.amount, liquidBalance, remainingAfterPurchase, budgetImpact);

    return {
      verdict,
      amount: dto.amount,
      liquidBalance,
      remainingAfterPurchase,
      avgMonthlyExpense: Math.round(avgMonthlyExpense),
      budgetImpact,
      message,
    };
  }

  private buildMessage(
    verdict: AffordVerdict,
    amount: number,
    liquidBalance: number,
    remaining: number,
    budgetImpact: { categoryName: string; spent: number; limit: number; overBy: number } | null,
  ) {
    const parts: string[] = [];

    if (verdict === 'not_affordable') {
      parts.push(
        `${formatNaira(amount)} is more than your available balance of ${formatNaira(liquidBalance)}.`,
      );
    } else if (verdict === 'tight') {
      parts.push(
        `You can cover ${formatNaira(amount)}, but it would leave only ${formatNaira(remaining)} — less than half your typical monthly spend.`,
      );
    } else {
      parts.push(
        `You can comfortably afford ${formatNaira(amount)}, leaving ${formatNaira(remaining)}.`,
      );
    }

    if (budgetImpact && budgetImpact.overBy > 0) {
      parts.push(
        `Heads up: this would put you ${formatNaira(budgetImpact.overBy)} over your ${budgetImpact.categoryName} budget this month.`,
      );
    }

    return parts.join(' ');
  }
}
