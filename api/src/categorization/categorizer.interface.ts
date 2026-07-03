export interface CategorizationResult {
  categoryName: string;
  confidence: number;
  categorizedBy: 'rule' | 'ai' | 'user';
}

export interface CategorizationInput {
  description: string;
  merchant?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
}

export const CATEGORIZER = Symbol('CATEGORIZER');

/**
 * Classifies a transaction into a spending category. MockCategorizer uses
 * keyword rules; swap in an OpenAI-backed implementation (same interface)
 * once an API key is available, without changing any callers.
 */
export interface Categorizer {
  categorize(input: CategorizationInput): Promise<CategorizationResult>;
}
