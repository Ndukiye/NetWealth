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

export const AI_ADVISOR = Symbol('AI_ADVISOR');

/**
 * Turns a user's raw financial data into a health score and a short list of
 * insights. RuleBasedAdvisor computes these deterministically from the
 * user's own transactions/budgets/goals; swap in an LLM-backed implementation
 * of this interface (same shape) once an API key is available, without
 * touching the controller or frontend.
 */
export interface AiAdvisor {
  analyze(userId: string): Promise<FinancialSnapshot>;
}
