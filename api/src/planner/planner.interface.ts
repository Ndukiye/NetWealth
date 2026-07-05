import { BuildPlanDto, PlanGoalType, RiskAppetite } from './dto/build-plan.dto';

export interface PlannerDefaults {
  /** Average monthly expense over recent months — prefills lifestyle/contribution fields. */
  suggestedMonthlyLifestyleCost: number;
  /** Liquid (bank/cash) + invested (crypto/stock/mutual fund) balances. */
  startingCapital: number;
  detectedMonthlyIncome: number;
  /** income − expense, floored at 0. */
  currentMonthlySavings: number;
  netWorth: number;
}

export interface AllocationSlice {
  assetClass: string;
  pct: number;
  note: string;
}

export type PlanFeasibility =
  | 'on_track'
  | 'achievable'
  | 'stretch'
  | 'unrealistic'
  /** WEALTH_GROWTH has no pass/fail target — it's a pure projection. */
  | 'projection';

export interface FinancialPlan {
  goalType: PlanGoalType;
  goalLabel: string;
  feasibility: PlanFeasibility;
  headline: string;
  horizonYears: number;
  /** null for WEALTH_GROWTH (no fixed target). */
  targetCorpus: number | null;
  /** What starting capital + the planned monthly contribution grows into over the horizon. */
  projectedCorpus: number;
  /** Monthly saving needed to hit the target; 0 for WEALTH_GROWTH. */
  requiredMonthlySavings: number;
  currentMonthlySavings: number;
  /** requiredMonthlySavings as a fraction of detected income; null when income is unknown. */
  suggestedSavingsRate: number | null;
  /** Monthly income left after the required savings; null when income is unknown. */
  lifestyleBudget: number | null;
  startingCapital: number;
  riskAppetite: RiskAppetite;
  expectedRealReturn: number;
  /** Only set for RETIREMENT (drives the target-corpus math). */
  safeWithdrawalRate: number | null;
  allocation: AllocationSlice[];
  advice: string[];
  assumptions: string[];
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

export interface ChatReply {
  reply: string;
  /** Follow-up questions the UI can offer as one-tap chips. */
  suggestions: string[];
}

export const FINANCIAL_PLANNER = Symbol('FINANCIAL_PLANNER');

/**
 * The "personal wealth manager" behind the AI coach: reviews the user's whole
 * financial picture and turns goals + risk appetite + real NetWealth data
 * into savings/investment plans. RuleBasedPlanner computes everything
 * deterministically from documented long-run market assumptions; swap in an
 * LLM/market-data-backed implementation of this interface
 * (FINANCIAL_PLANNER=openai) without touching the controller or frontend.
 */
export interface FinancialPlanner {
  defaults(userId: string): Promise<PlannerDefaults>;
  review(userId: string): Promise<FinancialReview>;
  buildPlan(userId: string, dto: BuildPlanDto): Promise<FinancialPlan>;
  /** Free-text advisor Q&A ("can I retire at 45?", "what should I invest in?"). */
  chat(userId: string, message: string): Promise<ChatReply>;
}
