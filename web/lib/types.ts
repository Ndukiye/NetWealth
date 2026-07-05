export type AccountKind = 'ASSET' | 'LIABILITY';

export type AccountType =
  | 'BANK'
  | 'CASH'
  | 'CRYPTO'
  | 'STOCK'
  | 'MUTUAL_FUND'
  | 'PROPERTY'
  | 'VEHICLE'
  | 'LOAN'
  | 'CREDIT_FACILITY'
  | 'MORTGAGE';

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  type: AccountType;
  currency: string;
  balance: string;
  provider?: string | null;
  lastSyncedAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId?: string | null;
  category?: Category | null;
  account?: Account;
  description: string;
  merchant?: string | null;
  amount: string;
  type: TransactionType;
  occurredAt: string;
  categorizedBy?: string | null;
}

export interface Budget {
  id: string;
  categoryId: string;
  category: Category;
  month: number;
  year: number;
  limit: string;
  spent: number;
  remaining: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate?: string | null;
  status: 'ACTIVE' | 'ACHIEVED' | 'ABANDONED';
}

export interface NetWorthReport {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assetsByType: Record<string, number>;
  liabilitiesByType: Record<string, number>;
}

export interface CashFlowPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface CategoryBreakdownPoint {
  categoryId: string | null;
  categoryName: string;
  total: number;
}

export interface Institution {
  id: string;
  name: string;
}

export type InsightSeverity = 'info' | 'warning' | 'success' | 'prediction';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
}

export interface HealthScoreBreakdown {
  savingsRate: number;
  budgetAdherence: number;
  cashFlowTrend: number;
}

export interface FinancialSnapshot {
  healthScore: number;
  healthScoreBreakdown: HealthScoreBreakdown;
  insights: Insight[];
}

export type AffordVerdict = 'affordable' | 'tight' | 'not_affordable';

export interface AffordCheckResult {
  verdict: AffordVerdict;
  amount: number;
  liquidBalance: number;
  remainingAfterPurchase: number;
  avgMonthlyExpense: number;
  budgetImpact: { categoryName: string; spent: number; limit: number; overBy: number } | null;
  message: string;
}

export type RiskAppetite = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export type PlanGoalType = 'RETIREMENT' | 'TARGET_AMOUNT' | 'WEALTH_GROWTH';

export interface PlannerDefaults {
  suggestedMonthlyLifestyleCost: number;
  startingCapital: number;
  detectedMonthlyIncome: number;
  currentMonthlySavings: number;
  netWorth: number;
}

export interface AllocationSlice {
  assetClass: string;
  pct: number;
  note: string;
}

export type PlanFeasibility = 'on_track' | 'achievable' | 'stretch' | 'unrealistic' | 'projection';

export interface FinancialPlan {
  goalType: PlanGoalType;
  goalLabel: string;
  feasibility: PlanFeasibility;
  headline: string;
  horizonYears: number;
  targetCorpus: number | null;
  projectedCorpus: number;
  requiredMonthlySavings: number;
  currentMonthlySavings: number;
  suggestedSavingsRate: number | null;
  lifestyleBudget: number | null;
  startingCapital: number;
  riskAppetite: RiskAppetite;
  expectedRealReturn: number;
  safeWithdrawalRate: number | null;
  allocation: AllocationSlice[];
  advice: string[];
  assumptions: string[];
}

export interface ChatReply {
  reply: string;
  suggestions: string[];
}

export type ReviewStatus = 'good' | 'watch' | 'action';

export interface ReviewItem {
  area: string;
  status: ReviewStatus;
  headline: string;
  detail: string;
}

export interface FinancialReview {
  summary: string;
  items: ReviewItem[];
}

export interface AlertSettings {
  alertsEnabled: boolean;
  telegramChatId: string | null;
}

export interface Alert {
  id: string;
  channel: string;
  message: string;
  insightId: string | null;
  sentAt: string;
}
