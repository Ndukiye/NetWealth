import { AccountKind, AccountType } from '@prisma/client';

const LIABILITY_TYPES = new Set<AccountType>([
  AccountType.LOAN,
  AccountType.CREDIT_FACILITY,
  AccountType.MORTGAGE,
]);

export function kindForAccountType(type: AccountType): AccountKind {
  return LIABILITY_TYPES.has(type) ? AccountKind.LIABILITY : AccountKind.ASSET;
}
