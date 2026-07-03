import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Account, AccountType, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { CATEGORIZER, Categorizer } from '../categorization/categorizer.interface';
import { BANK_PROVIDER, BankProvider } from './bank-provider.interface';
import { ConnectAccountDto } from './dto/connect-account.dto';

@Injectable()
export class BankIntegrationService {
  private readonly logger = new Logger(BankIntegrationService.name);

  constructor(
    @Inject(BANK_PROVIDER) private readonly provider: BankProvider,
    @Inject(CATEGORIZER) private readonly categorizer: Categorizer,
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  listInstitutions() {
    return this.provider.listInstitutions();
  }

  async connectAccount(userId: string, dto: ConnectAccountDto) {
    const linked = await this.provider.linkAccount(dto.institutionId);

    const account = await this.prisma.account.create({
      data: {
        userId,
        name: linked.accountName,
        kind: 'ASSET',
        type: AccountType.BANK,
        currency: linked.currency,
        balance: linked.balance,
        provider: this.provider.name,
        providerAccountId: linked.providerAccountId,
      },
    });

    await this.performSync(account);
    return this.prisma.account.findUnique({ where: { id: account.id } });
  }

  /** Manual sync, triggered from the "Sync" button in the UI. */
  async syncAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== userId) throw new ForbiddenException();
    if (!account.providerAccountId) {
      throw new ForbiddenException('Account is not linked to a bank provider');
    }
    return this.performSync(account);
  }

  /**
   * Live-event path: a real Mono/Okra webhook fires when the provider sees a
   * new transaction on a linked account, identified by their own account id
   * (not our user's JWT — the provider doesn't have one). We look the account
   * up by providerAccountId and sync just that one.
   */
  async syncFromWebhook(providerAccountId: string) {
    const account = await this.prisma.account.findFirst({ where: { providerAccountId } });
    if (!account) throw new NotFoundException('No linked account for this provider id');
    return this.performSync(account);
  }

  /**
   * Scheduled-sync path: periodic polling fallback for banks that don't push
   * webhooks reliably, per the brief's note that not every Nigerian bank
   * supports real-time push updates.
   */
  async syncAllLinkedAccounts() {
    const accounts = await this.prisma.account.findMany({
      where: { providerAccountId: { not: null } },
    });

    let synced = 0;
    for (const account of accounts) {
      try {
        await this.performSync(account);
        synced += 1;
      } catch (err) {
        this.logger.warn(`Scheduled sync failed for account ${account.id}: ${err}`);
      }
    }
    return { accountsSynced: synced, totalLinked: accounts.length };
  }

  private async performSync(account: Account) {
    if (!account.providerAccountId) {
      throw new ForbiddenException('Account is not linked to a bank provider');
    }

    const isInitialSync = !account.lastSyncedAt;
    const providerTxns = await this.provider.fetchTransactions(
      account.providerAccountId,
      account.lastSyncedAt ?? undefined,
    );

    let balanceDelta = 0;
    let created = 0;

    for (const txn of providerTxns) {
      const existing = await this.prisma.transaction.findFirst({
        where: { accountId: account.id, providerTxnId: txn.providerTxnId },
      });
      if (existing) continue;

      const classification = await this.categorizer.categorize({
        description: txn.description,
        merchant: txn.merchant,
        type: txn.type,
      });
      const category = await this.categories.findOrCreateByName(
        account.userId,
        classification.categoryName,
      );

      await this.prisma.transaction.create({
        data: {
          accountId: account.id,
          categoryId: category.id,
          description: txn.description,
          merchant: txn.merchant,
          amount: txn.amount,
          type: txn.type as TransactionType,
          occurredAt: txn.occurredAt,
          providerTxnId: txn.providerTxnId,
          categorizedBy: classification.categorizedBy,
          categoryConfidence: classification.confidence,
        },
      });

      created += 1;
      if (!isInitialSync) {
        balanceDelta += txn.type === 'INCOME' ? txn.amount : txn.type === 'EXPENSE' ? -txn.amount : 0;
      }
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        lastSyncedAt: new Date(),
        balance: isInitialSync ? account.balance : { increment: balanceDelta },
      },
    });

    return { created, total: providerTxns.length };
  }
}
