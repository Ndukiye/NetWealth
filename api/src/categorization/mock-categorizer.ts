import { Injectable } from '@nestjs/common';
import {
  Categorizer,
  CategorizationInput,
  CategorizationResult,
} from './categorizer.interface';

// Keyword -> category, checked against the uppercased description/merchant.
// Order matters: first match wins.
const RULES: Array<[RegExp, string]> = [
  [/UBER|BOLT|TAXIFY|TRIP/, 'Transport'],
  [/SHOPRITE|SPAR|GROCER|MARKET/, 'Groceries'],
  [/MTN|AIRTEL|GLO|9MOBILE|VTU|TOPUP|AIRTIME/, 'Airtime & Data'],
  [/NETFLIX|SPOTIFY|SHOWMAX|DSTV|GOTV|PRIME VIDEO/, 'Entertainment'],
  [/JUMIA|KONGA|SHOPPING|AMAZON/, 'Shopping'],
  [/SALARY|PAYROLL/, 'Salary'],
  [/TRANSFER FROM|CREDIT ALERT/, 'Transfer'],
  [/IKEDC|EKEDC|ELECTRICITY|PHCN|WATER BILL/, 'Utilities'],
  [/RENT|LANDLORD/, 'Rent'],
  [/SCHOOL|TUITION|FEES/, 'Education'],
  [/HOSPITAL|PHARMACY|CLINIC|MEDIC/, 'Health'],
  [/RESTAURANT|EATERY|CHICKEN REPUBLIC|DOMINOS|KFC/, 'Dining'],
];

const FALLBACK_BY_TYPE: Record<CategorizationInput['type'], string> = {
  INCOME: 'Other Income',
  EXPENSE: 'Uncategorized',
  TRANSFER: 'Transfer',
};

@Injectable()
export class MockCategorizer implements Categorizer {
  async categorize(
    input: CategorizationInput,
  ): Promise<CategorizationResult> {
    const haystack = `${input.description} ${input.merchant ?? ''}`.toUpperCase();

    for (const [pattern, categoryName] of RULES) {
      if (pattern.test(haystack)) {
        return { categoryName, confidence: 0.9, categorizedBy: 'rule' };
      }
    }

    return {
      categoryName: FALLBACK_BY_TYPE[input.type],
      confidence: 0.3,
      categorizedBy: 'rule',
    };
  }
}
