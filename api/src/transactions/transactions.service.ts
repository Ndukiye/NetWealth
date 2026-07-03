import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { CATEGORIZER, Categorizer } from '../categorization/categorizer.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    @Inject(CATEGORIZER) private readonly categorizer: Categorizer,
  ) {}

  async findAll(userId: string, query: QueryTransactionsDto) {
    return this.prisma.transaction.findMany({
      where: {
        account: { userId },
        accountId: query.accountId,
        categoryId: query.categoryId,
        type: query.type,
        occurredAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      include: { category: true, account: true },
      orderBy: { occurredAt: 'desc' },
    });
  }

  private async assertOwnsAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId) throw new ForbiddenException();
    return account;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    await this.assertOwnsAccount(userId, dto.accountId);

    let categoryId = dto.categoryId;
    let categorizedBy = 'user';
    let confidence = 1;

    if (!categoryId) {
      const classification = await this.categorizer.categorize({
        description: dto.description,
        merchant: dto.merchant,
        type: dto.type,
      });
      const category = await this.categories.findOrCreateByName(
        userId,
        classification.categoryName,
      );
      categoryId = category.id;
      categorizedBy = classification.categorizedBy;
      confidence = classification.confidence;
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        accountId: dto.accountId,
        categoryId,
        description: dto.description,
        merchant: dto.merchant,
        amount: dto.amount,
        type: dto.type,
        occurredAt: new Date(dto.occurredAt),
        categorizedBy,
        categoryConfidence: confidence,
      },
      include: { category: true },
    });

    const delta =
      dto.type === 'INCOME' ? dto.amount : dto.type === 'EXPENSE' ? -dto.amount : 0;
    await this.prisma.account.update({
      where: { id: dto.accountId },
      data: { balance: { increment: delta } },
    });

    return transaction;
  }

  async updateCategory(userId: string, id: string, categoryId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.account.userId !== userId) throw new ForbiddenException();

    return this.prisma.transaction.update({
      where: { id },
      data: { categoryId, categorizedBy: 'user', categoryConfidence: 1 },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.account.userId !== userId) throw new ForbiddenException();

    const delta =
      transaction.type === 'INCOME'
        ? -Number(transaction.amount)
        : transaction.type === 'EXPENSE'
          ? Number(transaction.amount)
          : 0;

    await this.prisma.$transaction([
      this.prisma.transaction.delete({ where: { id } }),
      this.prisma.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: delta } },
      }),
    ]);

    return { success: true };
  }
}
