import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SYSTEM_CATEGORIES = [
  'Transport',
  'Groceries',
  'Airtime & Data',
  'Entertainment',
  'Shopping',
  'Salary',
  'Other Income',
  'Transfer',
  'Utilities',
  'Rent',
  'Education',
  'Health',
  'Dining',
  'Uncategorized',
];

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByName(userId: string, name: string) {
    const existing = await this.prisma.category.findFirst({
      where: { name, OR: [{ userId }, { userId: null }] },
    });
    if (existing) return existing;

    return this.prisma.category.create({
      data: { userId, name },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { name: 'asc' },
    });
  }

  async ensureSystemCategories() {
    for (const name of SYSTEM_CATEGORIES) {
      const existing = await this.prisma.category.findFirst({
        where: { name, userId: null, isSystem: true },
      });
      if (!existing) {
        await this.prisma.category.create({ data: { name, isSystem: true } });
      }
    }
  }
}
