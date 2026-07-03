import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  BankProvider,
  LinkedAccountResult,
  ProviderInstitution,
  ProviderTransaction,
} from './bank-provider.interface';

const INSTITUTIONS: ProviderInstitution[] = [
  { id: 'gtbank', name: 'GTBank' },
  { id: 'access', name: 'Access Bank' },
  { id: 'zenith', name: 'Zenith Bank' },
  { id: 'kuda', name: 'Kuda' },
  { id: 'opay', name: 'OPay' },
];

const SAMPLE_MERCHANTS: Array<
  Pick<ProviderTransaction, 'description' | 'merchant' | 'type'> & {
    amountRange: [number, number];
  }
> = [
  { description: 'UBER *TRIP', merchant: 'UBER', type: 'EXPENSE', amountRange: [1200, 6500] },
  { description: 'SHOPRITE LEKKI', merchant: 'SHOPRITE', type: 'EXPENSE', amountRange: [5000, 45000] },
  { description: 'MTN VTU TOPUP', merchant: 'MTN TOPUP', type: 'EXPENSE', amountRange: [500, 5000] },
  { description: 'PAYSTACK *NETFLIX', merchant: 'PAYSTACK *NETFLIX', type: 'EXPENSE', amountRange: [4400, 4400] },
  { description: 'TRANSFER FROM JOHN ADEYEMI', merchant: 'TRANSFER FROM JOHN', type: 'INCOME', amountRange: [10000, 80000] },
  { description: 'JUMIA ONLINE PURCHASE', merchant: 'JUMIA', type: 'EXPENSE', amountRange: [8000, 60000] },
  { description: 'SALARY PAYMENT - ACME LTD', merchant: 'ACME LTD', type: 'INCOME', amountRange: [350000, 350000] },
  { description: 'IKEDC ELECTRICITY BILL', merchant: 'IKEDC', type: 'EXPENSE', amountRange: [7000, 25000] },
  { description: 'DSTV SUBSCRIPTION', merchant: 'DSTV', type: 'EXPENSE', amountRange: [8500, 24500] },
  { description: 'BOLT *TRIP', merchant: 'BOLT', type: 'EXPENSE', amountRange: [900, 5000] },
];

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

@Injectable()
export class MockBankProvider implements BankProvider {
  readonly name = 'mock';

  async listInstitutions(): Promise<ProviderInstitution[]> {
    return INSTITUTIONS;
  }

  async linkAccount(institutionId: string): Promise<LinkedAccountResult> {
    const institution =
      INSTITUTIONS.find((i) => i.id === institutionId) ?? INSTITUTIONS[0];
    return {
      providerAccountId: `mock_${institution.id}_${randomUUID().slice(0, 8)}`,
      institution,
      accountName: `${institution.name} Savings`,
      balance: randomBetween(50_000, 900_000),
      currency: 'NGN',
    };
  }

  async fetchTransactions(
    providerAccountId: string,
    since?: Date,
  ): Promise<ProviderTransaction[]> {
    const count = since ? randomBetween(0, 3) : randomBetween(15, 25);
    const now = Date.now();
    const windowMs = 60 * 24 * 60 * 60 * 1000; // 60 days of history on first sync

    return Array.from({ length: count }).map(() => {
      const sample =
        SAMPLE_MERCHANTS[randomBetween(0, SAMPLE_MERCHANTS.length - 1)];
      const occurredAt = since
        ? new Date(now - randomBetween(0, 60 * 60 * 1000))
        : new Date(now - randomBetween(0, windowMs));

      return {
        providerTxnId: `${providerAccountId}_${randomUUID()}`,
        description: sample.description,
        merchant: sample.merchant,
        amount: randomBetween(sample.amountRange[0], sample.amountRange[1]),
        type: sample.type,
        occurredAt,
      };
    });
  }
}
