import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, month?: number, year?: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return Promise.all(
      budgets.map(async (budget) => {
        const spentAgg = await this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            categoryId: budget.categoryId,
            type: 'EXPENSE',
            account: { userId },
            occurredAt: {
              gte: new Date(budget.year, budget.month - 1, 1),
              lt: new Date(budget.year, budget.month, 1),
            },
          },
        });
        const spent = Number(spentAgg._sum.amount ?? 0);
        return {
          ...budget,
          spent,
          remaining: Number(budget.limit) - spent,
        };
      }),
    );
  }

  async create(userId: string, dto: CreateBudgetDto) {
    const existing = await this.prisma.budget.findUnique({
      where: {
        userId_categoryId_month_year: {
          userId,
          categoryId: dto.categoryId,
          month: dto.month,
          year: dto.year,
        },
      },
    });
    if (existing) {
      throw new ConflictException('A budget for this category and month already exists');
    }

    return this.prisma.budget.create({
      data: { ...dto, userId },
      include: { category: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.userId !== userId) throw new ForbiddenException();

    return this.prisma.budget.update({
      where: { id },
      data: { limit: dto.limit },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.userId !== userId) throw new ForbiddenException();

    await this.prisma.budget.delete({ where: { id } });
    return { success: true };
  }
}
