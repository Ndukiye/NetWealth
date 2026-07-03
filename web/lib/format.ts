export function formatCurrency(value: number | string, currency = 'NGN') {
  const amount = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: 'Bank Account',
  CASH: 'Cash',
  CRYPTO: 'Crypto',
  STOCK: 'Stocks',
  MUTUAL_FUND: 'Mutual Fund',
  PROPERTY: 'Property',
  VEHICLE: 'Vehicle',
  LOAN: 'Loan',
  CREDIT_FACILITY: 'Credit Facility',
  MORTGAGE: 'Mortgage',
};
