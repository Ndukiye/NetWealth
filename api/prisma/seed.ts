import { PrismaClient, AccountType, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

const DEMO_EMAIL = 'demo@netwealth.app';
const DEMO_PASSWORD = 'password123';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log('Seeding system categories...');
  const categories: Record<string, string> = {};
  for (const name of SYSTEM_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { id: `system-${name}` },
      update: {},
      create: { id: `system-${name}`, name, isSystem: true },
    });
    categories[name] = category.id;
  }

  console.log('Creating demo user...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      fullName: 'Ada Lovelace',
      alertsEnabled: true,
      telegramChatId: '123456789',
    },
  });

  console.log('Creating accounts...');
  const gtbank = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'GTBank Savings',
      kind: 'ASSET',
      type: AccountType.BANK,
      currency: 'NGN',
      balance: 482_500,
      provider: 'mock',
      providerAccountId: 'seed_gtbank_001',
      lastSyncedAt: new Date(),
    },
  });

  const cash = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Cash Wallet',
      kind: 'ASSET',
      type: AccountType.CASH,
      currency: 'NGN',
      balance: 25_000,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Bitcoin & Crypto',
      kind: 'ASSET',
      type: AccountType.CRYPTO,
      currency: 'NGN',
      balance: 610_000,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Stanbic Mutual Fund',
      kind: 'ASSET',
      type: AccountType.MUTUAL_FUND,
      currency: 'NGN',
      balance: 1_200_000,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Lekki Apartment',
      kind: 'ASSET',
      type: AccountType.PROPERTY,
      currency: 'NGN',
      balance: 55_000_000,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Toyota Camry 2019',
      kind: 'ASSET',
      type: AccountType.VEHICLE,
      currency: 'NGN',
      balance: 9_500_000,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Car Loan',
      kind: 'LIABILITY',
      type: AccountType.LOAN,
      currency: 'NGN',
      balance: 2_100_000,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'GTBank Credit Card',
      kind: 'LIABILITY',
      type: AccountType.CREDIT_FACILITY,
      currency: 'NGN',
      balance: 85_000,
    },
  });

  console.log('Creating transactions...');
  const txns: Array<{
    accountId: string;
    description: string;
    merchant: string;
    amount: number;
    type: TransactionType;
    categoryName: string;
    daysAgo: number;
  }> = [
    { accountId: gtbank.id, description: 'SALARY PAYMENT - ACME LTD', merchant: 'ACME LTD', amount: 350000, type: 'INCOME', categoryName: 'Salary', daysAgo: 28 },
    { accountId: gtbank.id, description: 'UBER *TRIP', merchant: 'UBER', amount: 3200, type: 'EXPENSE', categoryName: 'Transport', daysAgo: 27 },
    { accountId: gtbank.id, description: 'SHOPRITE LEKKI', merchant: 'SHOPRITE', amount: 24500, type: 'EXPENSE', categoryName: 'Groceries', daysAgo: 25 },
    { accountId: gtbank.id, description: 'MTN VTU TOPUP', merchant: 'MTN TOPUP', amount: 2000, type: 'EXPENSE', categoryName: 'Airtime & Data', daysAgo: 24 },
    { accountId: gtbank.id, description: 'PAYSTACK *NETFLIX', merchant: 'PAYSTACK *NETFLIX', amount: 4400, type: 'EXPENSE', categoryName: 'Entertainment', daysAgo: 22 },
    { accountId: gtbank.id, description: 'TRANSFER FROM JOHN ADEYEMI', merchant: 'TRANSFER FROM JOHN', amount: 45000, type: 'INCOME', categoryName: 'Transfer', daysAgo: 20 },
    { accountId: gtbank.id, description: 'JUMIA ONLINE PURCHASE', merchant: 'JUMIA', amount: 32000, type: 'EXPENSE', categoryName: 'Shopping', daysAgo: 18 },
    { accountId: gtbank.id, description: 'IKEDC ELECTRICITY BILL', merchant: 'IKEDC', amount: 15000, type: 'EXPENSE', categoryName: 'Utilities', daysAgo: 15 },
    { accountId: gtbank.id, description: 'BOLT *TRIP', merchant: 'BOLT', amount: 1800, type: 'EXPENSE', categoryName: 'Transport', daysAgo: 12 },
    { accountId: gtbank.id, description: 'DSTV SUBSCRIPTION', merchant: 'DSTV', amount: 18400, type: 'EXPENSE', categoryName: 'Entertainment', daysAgo: 10 },
    { accountId: gtbank.id, description: 'CHICKEN REPUBLIC', merchant: 'CHICKEN REPUBLIC', amount: 6500, type: 'EXPENSE', categoryName: 'Dining', daysAgo: 7 },
    { accountId: gtbank.id, description: 'SHOPRITE LEKKI', merchant: 'SHOPRITE', amount: 19800, type: 'EXPENSE', categoryName: 'Groceries', daysAgo: 5 },
    { accountId: gtbank.id, description: 'UBER *TRIP', merchant: 'UBER', amount: 2600, type: 'EXPENSE', categoryName: 'Transport', daysAgo: 3 },
    { accountId: cash.id, description: 'MARKET RUN', merchant: 'Local Market', amount: 8000, type: 'EXPENSE', categoryName: 'Groceries', daysAgo: 4 },
    { accountId: cash.id, description: 'SCHOOL FEES - JUNIOR', merchant: 'Bright Stars School', amount: 65000, type: 'EXPENSE', categoryName: 'Education', daysAgo: 14 },
    // Deliberately over this month's Shopping budget, so the AI insights /
    // spending alerts demo has a real warning to surface out of the box.
    { accountId: gtbank.id, description: 'JUMIA ONLINE PURCHASE', merchant: 'JUMIA', amount: 42000, type: 'EXPENSE', categoryName: 'Shopping', daysAgo: 1 },
  ];

  // Recurring items across the prior 3 months (in addition to the current-month
  // occurrences above), so subscription/salary detection has real patterns to find.
  const recurringTxns: typeof txns = [];
  for (let monthsBack = 1; monthsBack <= 3; monthsBack++) {
    const base = 28 + monthsBack * 30;
    const jitter = () => Math.round((Math.random() - 0.5) * 4); // +/- 2 days
    recurringTxns.push(
      {
        accountId: gtbank.id,
        description: 'SALARY PAYMENT - ACME LTD',
        merchant: 'ACME LTD',
        amount: 350000,
        type: 'INCOME',
        categoryName: 'Salary',
        daysAgo: base + jitter(),
      },
      {
        accountId: gtbank.id,
        description: 'DSTV SUBSCRIPTION',
        merchant: 'DSTV',
        amount: 18400 + Math.round((Math.random() - 0.5) * 1000),
        type: 'EXPENSE',
        categoryName: 'Entertainment',
        daysAgo: base - 18 + jitter(),
      },
      {
        accountId: gtbank.id,
        description: 'PAYSTACK *NETFLIX',
        merchant: 'PAYSTACK *NETFLIX',
        amount: 4400,
        type: 'EXPENSE',
        categoryName: 'Entertainment',
        daysAgo: base - 6 + jitter(),
      },
    );
  }

  for (const txn of [...txns, ...recurringTxns]) {
    await prisma.transaction.create({
      data: {
        accountId: txn.accountId,
        categoryId: categories[txn.categoryName],
        description: txn.description,
        merchant: txn.merchant,
        amount: txn.amount,
        type: txn.type,
        occurredAt: daysAgo(txn.daysAgo),
        categorizedBy: 'rule',
        categoryConfidence: 0.9,
      },
    });
  }

  console.log('Creating budgets...');
  const now = new Date();
  const budgetDefs = [
    { categoryName: 'Groceries', limit: 60000 },
    { categoryName: 'Transport', limit: 20000 },
    { categoryName: 'Entertainment', limit: 25000 },
    { categoryName: 'Shopping', limit: 40000 },
  ];
  for (const b of budgetDefs) {
    await prisma.budget.upsert({
      where: {
        userId_categoryId_month_year: {
          userId: user.id,
          categoryId: categories[b.categoryName],
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      },
      update: {},
      create: {
        userId: user.id,
        categoryId: categories[b.categoryName],
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        limit: b.limit,
      },
    });
  }

  console.log('Creating goals...');
  await prisma.goal.createMany({
    data: [
      {
        userId: user.id,
        name: 'Emergency Fund',
        targetAmount: 1_000_000,
        currentAmount: 350_000,
        targetDate: new Date(now.getFullYear(), now.getMonth() + 6, 1),
      },
      {
        userId: user.id,
        name: 'Japa Fund',
        targetAmount: 5_000_000,
        currentAmount: 900_000,
        targetDate: new Date(now.getFullYear() + 1, now.getMonth(), 1),
      },
    ],
  });

  console.log(`Seed complete. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
