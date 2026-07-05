import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PiggyBank,
  Target,
  BarChart3,
  Compass,
} from 'lucide-react';

export const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', shortLabel: 'Accounts', icon: Wallet },
  { href: '/transactions', label: 'Transactions', shortLabel: 'Activity', icon: ArrowLeftRight },
  { href: '/budgets', label: 'Budgets', shortLabel: 'Budgets', icon: PiggyBank },
  { href: '/goals', label: 'Goals', shortLabel: 'Goals', icon: Target },
  { href: '/coach', label: 'AI Coach', shortLabel: 'Coach', icon: Compass },
  { href: '/reports', label: 'Reports', shortLabel: 'Reports', icon: BarChart3 },
];
