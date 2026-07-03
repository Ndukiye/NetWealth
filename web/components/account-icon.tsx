import {
  Landmark,
  Banknote,
  Bitcoin,
  LineChart,
  Home,
  Car,
  HandCoins,
  CreditCard,
  Building2,
  Wallet,
} from 'lucide-react';
import { AccountType } from '@/lib/types';

const ICONS: Record<AccountType, typeof Landmark> = {
  BANK: Landmark,
  CASH: Banknote,
  CRYPTO: Bitcoin,
  STOCK: LineChart,
  MUTUAL_FUND: LineChart,
  PROPERTY: Home,
  VEHICLE: Car,
  LOAN: HandCoins,
  CREDIT_FACILITY: CreditCard,
  MORTGAGE: Building2,
};

export function AccountIcon({ type, className }: { type: AccountType; className?: string }) {
  const Icon = ICONS[type] ?? Wallet;
  return <Icon size={16} className={className} />;
}
