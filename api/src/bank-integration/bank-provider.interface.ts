/**
 * Common shape that any Open Banking aggregator (Mono, Okra, OnePipe, Stitch...)
 * is normalized into before it touches the rest of the app. Swap MockBankProvider
 * for a real implementation of this interface without touching callers.
 */
export interface ProviderInstitution {
  id: string;
  name: string;
}

export interface ProviderTransaction {
  providerTxnId: string;
  description: string;
  merchant?: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  occurredAt: Date;
}

export interface LinkedAccountResult {
  providerAccountId: string;
  institution: ProviderInstitution;
  accountName: string;
  balance: number;
  currency: string;
}

export const BANK_PROVIDER = Symbol('BANK_PROVIDER');

export interface BankProvider {
  readonly name: string;

  /** List institutions the provider can connect to, for the "connect bank" picker. */
  listInstitutions(): Promise<ProviderInstitution[]>;

  /**
   * Exchange a widget/auth token for a linked account. Real providers (Mono/Okra)
   * do this after their hosted-widget OAuth flow completes on the frontend.
   */
  linkAccount(institutionId: string): Promise<LinkedAccountResult>;

  /** Pull transactions since a given point, for scheduled/manual sync. */
  fetchTransactions(
    providerAccountId: string,
    since?: Date,
  ): Promise<ProviderTransaction[]>;
}
