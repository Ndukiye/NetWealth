import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BuildPlanDto, PlanGoalType, RiskAppetite } from './dto/build-plan.dto';
import {
  AllocationSlice,
  ChatReply,
  FinancialPlan,
  FinancialPlanner,
  FinancialReview,
  PlanFeasibility,
  PlannerDefaults,
  ReviewItem,
} from './planner.interface';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface MoneySnapshot {
  liquid: number;
  invested: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  currentMonthlySavings: number;
}

interface RiskProfile {
  label: string;
  expectedRealReturn: number;
  safeWithdrawalRate: number;
  allocation: AllocationSlice[];
  blurb: string;
}

// Long-run *real* (inflation-adjusted) return estimates per risk profile,
// blended from historical Nigerian T-bill/FGN-bond yields vs inflation, NGX
// equity returns, and USD asset returns. Deliberately conservative — naira
// fixed income has often lost to inflation, so real returns lean on the
// dollar and equity sleeves.
const PROFILES: Record<RiskAppetite, RiskProfile> = {
  CONSERVATIVE: {
    label: 'conservative',
    expectedRealReturn: 0.025,
    safeWithdrawalRate: 0.035,
    allocation: [
      {
        assetClass: 'Money market & T-bills',
        pct: 40,
        note: 'FGN treasury bills and money market funds — liquid, capital-preserving, tracks CBN rates.',
      },
      {
        assetClass: 'FGN bonds',
        pct: 25,
        note: 'Longer-dated federal government bonds for a stable naira yield.',
      },
      {
        assetClass: 'Dollar assets',
        pct: 25,
        note: 'Eurobond funds or a domiciliary account — hedges naira depreciation, the biggest long-term risk to a naira-only portfolio.',
      },
      {
        assetClass: 'Nigerian equities',
        pct: 10,
        note: 'A small growth sleeve via a broad NGX 30 index fund.',
      },
    ],
    blurb:
      'A conservative mix prioritises not losing money: mostly government-backed naira instruments, with a dollar sleeve to protect against devaluation.',
  },
  BALANCED: {
    label: 'balanced',
    expectedRealReturn: 0.045,
    safeWithdrawalRate: 0.04,
    allocation: [
      {
        assetClass: 'Money market & T-bills',
        pct: 20,
        note: 'Liquidity buffer and dry powder for opportunities.',
      },
      {
        assetClass: 'FGN bonds',
        pct: 15,
        note: 'Stable naira yield to smooth out equity swings.',
      },
      {
        assetClass: 'Dollar assets',
        pct: 30,
        note: 'Eurobond funds plus global equity ETFs (via dollar-asset platforms) — devaluation hedge and access to global growth.',
      },
      {
        assetClass: 'Nigerian equities',
        pct: 30,
        note: 'NGX index funds — banks, consumer goods, industrials — for long-run local growth.',
      },
      {
        assetClass: 'Real estate / REITs',
        pct: 5,
        note: 'NGX-listed REITs or fractional real estate for inflation-linked income.',
      },
    ],
    blurb:
      'A balanced mix splits between growth (equities, dollar assets) and stability (bonds, money market) — solid for horizons of 5+ years.',
  },
  AGGRESSIVE: {
    label: 'aggressive',
    expectedRealReturn: 0.065,
    safeWithdrawalRate: 0.04,
    allocation: [
      {
        assetClass: 'Money market & T-bills',
        pct: 10,
        note: 'Just enough liquidity to avoid selling growth assets in a bad month.',
      },
      {
        assetClass: 'Dollar assets',
        pct: 15,
        note: 'Eurobond funds and USD cash as the defensive sleeve.',
      },
      {
        assetClass: 'Equities (NGX + global)',
        pct: 45,
        note: 'NGX index funds plus global equity ETFs — the main growth engine over 10+ years.',
      },
      {
        assetClass: 'Real estate',
        pct: 20,
        note: 'Direct property or REITs — long-term inflation-linked appreciation.',
      },
      {
        assetClass: 'Crypto / venture',
        pct: 10,
        note: 'High risk, capped small — only money you can afford to see drop 80%.',
      },
    ],
    blurb:
      'An aggressive mix maximises long-run growth and accepts big swings along the way — only sensible for horizons of 10+ years and a strong stomach.',
  },
};

// For goals closer than this, growth assets are too volatile — the plan
// overrides the chosen profile with a capital-preservation allocation.
const SHORT_HORIZON_YEARS = 3;
const SHORT_HORIZON_RETURN = 0.01;
const SHORT_HORIZON_ALLOCATION: AllocationSlice[] = [
  {
    assetClass: 'Money market & T-bills',
    pct: 70,
    note: 'For a goal this close, protecting the amount matters more than growing it.',
  },
  {
    assetClass: 'Dollar assets',
    pct: 30,
    note: 'A devaluation hedge in case the goal is dollar-linked (rent, school fees, travel).',
  },
];

const EMERGENCY_FUND_MONTHS = 6;

@Injectable()
export class RuleBasedPlanner implements FinancialPlanner {
  constructor(private readonly prisma: PrismaService) {}

  async defaults(userId: string): Promise<PlannerDefaults> {
    const s = await this.snapshot(userId);
    return {
      suggestedMonthlyLifestyleCost: Math.round(s.avgMonthlyExpense),
      startingCapital: Math.round(s.liquid + s.invested),
      detectedMonthlyIncome: Math.round(s.avgMonthlyIncome),
      currentMonthlySavings: Math.round(s.currentMonthlySavings),
      netWorth: Math.round(s.netWorth),
    };
  }

  async review(userId: string): Promise<FinancialReview> {
    const s = await this.snapshot(userId);
    const items: ReviewItem[] = [];

    // 1. Emergency fund
    if (s.avgMonthlyExpense > 0) {
      const months = s.liquid / s.avgMonthlyExpense;
      items.push({
        area: 'Emergency fund',
        status: months >= EMERGENCY_FUND_MONTHS ? 'good' : months >= 3 ? 'watch' : 'action',
        headline: `${months.toFixed(1)} months of expenses in liquid savings`,
        detail:
          months >= EMERGENCY_FUND_MONTHS
            ? `Your ${formatNaira(s.liquid)} in bank/cash covers ${months.toFixed(1)} months of your typical ${formatNaira(s.avgMonthlyExpense)}/month spend — a solid cushion.`
            : `You hold ${formatNaira(s.liquid)} liquid against a typical ${formatNaira(s.avgMonthlyExpense)}/month spend. Build this to ${EMERGENCY_FUND_MONTHS} months (${formatNaira(s.avgMonthlyExpense * EMERGENCY_FUND_MONTHS)}) in a money market fund before locking money into anything long-term.`,
      });
    } else {
      items.push({
        area: 'Emergency fund',
        status: 'watch',
        headline: 'Not enough spending history to size your emergency fund',
        detail:
          'Once a few months of transactions are in, aim for 6 months of typical expenses in a money market fund.',
      });
    }

    // 2. Savings rate
    if (s.avgMonthlyIncome > 0) {
      const rate = (s.avgMonthlyIncome - s.avgMonthlyExpense) / s.avgMonthlyIncome;
      items.push({
        area: 'Savings rate',
        status: rate >= 0.2 ? 'good' : rate >= 0.1 ? 'watch' : 'action',
        headline: `You save about ${Math.round(rate * 100)}% of your income`,
        detail:
          rate >= 0.2
            ? `Roughly ${formatNaira(s.currentMonthlySavings)}/month of your ${formatNaira(s.avgMonthlyIncome)} income is left after spending — at or above the 20% benchmark. Automate it on payday so it stays that way.`
            : `Roughly ${formatNaira(Math.max(0, s.avgMonthlyIncome - s.avgMonthlyExpense))}/month is left after spending. Getting to 20% (${formatNaira(s.avgMonthlyIncome * 0.2)}/month) is the single biggest lever on every goal below.`,
      });
    } else {
      items.push({
        area: 'Savings rate',
        status: 'watch',
        headline: "Couldn't detect a regular income",
        detail:
          'No recurring income transactions found in recent months — connect the account your salary lands in so plans can be sized against real income.',
      });
    }

    // 3. Debt load
    if (s.totalLiabilities <= 0) {
      items.push({
        area: 'Debt',
        status: 'good',
        headline: 'No debt on record',
        detail: 'You carry no loans, credit facilities or mortgages — every naira saved compounds for you, not a lender.',
      });
    } else {
      const ratio = s.totalAssets > 0 ? s.totalLiabilities / s.totalAssets : 1;
      items.push({
        area: 'Debt',
        status: ratio <= 0.3 ? 'good' : ratio <= 0.6 ? 'watch' : 'action',
        headline: `Debt is ${Math.round(ratio * 100)}% of your assets`,
        detail:
          ratio <= 0.3
            ? `${formatNaira(s.totalLiabilities)} owed against ${formatNaira(s.totalAssets)} in assets — comfortably manageable.`
            : `${formatNaira(s.totalLiabilities)} owed against ${formatNaira(s.totalAssets)} in assets. Nigerian loan rates usually beat any safe investment return — prioritise clearing expensive debt before investing beyond your emergency fund.`,
      });
    }

    // 4. Idle cash vs investments
    const investable = s.liquid + s.invested;
    const emergencyTarget = s.avgMonthlyExpense * EMERGENCY_FUND_MONTHS;
    const excessCash = s.liquid - emergencyTarget;
    if (investable > 0) {
      if (s.invested <= 0 && excessCash > 0) {
        items.push({
          area: 'Idle cash',
          status: 'action',
          headline: `${formatNaira(excessCash)} sits in cash beyond your emergency fund`,
          detail:
            'Nothing is invested, and naira cash loses value to inflation every month. Move the excess into T-bills, then build the dollar/equity sleeves from your plan below.',
        });
      } else if (excessCash > investable * 0.25) {
        items.push({
          area: 'Idle cash',
          status: 'watch',
          headline: `${formatNaira(excessCash)} of cash could be working harder`,
          detail:
            'Beyond a 6-month emergency fund, cash in a current account is a slow leak to inflation — sweep the excess into your investment allocation.',
        });
      } else {
        items.push({
          area: 'Cash vs investments',
          status: 'good',
          headline: 'Your cash/investment split looks sensible',
          detail: `${formatNaira(s.liquid)} liquid vs ${formatNaira(s.invested)} invested — the emergency fund is covered without hoarding idle cash.`,
        });
      }
    }

    const actions = items.filter((i) => i.status === 'action').length;
    const watches = items.filter((i) => i.status === 'watch').length;
    const summary =
      actions > 0
        ? `${actions} thing${actions > 1 ? 's' : ''} need${actions > 1 ? '' : 's'} attention before anything else — sort ${actions > 1 ? 'those' : 'that'} first, then work the plan.`
        : watches > 0
          ? `Fundamentals are mostly solid — ${watches} area${watches > 1 ? 's' : ''} worth tightening up.`
          : 'Your financial fundamentals look solid — focus on the long-term plan.';

    return { summary, items };
  }

  async buildPlan(userId: string, dto: BuildPlanDto): Promise<FinancialPlan> {
    const s = await this.snapshot(userId);
    const profile = PROFILES[dto.riskAppetite];
    const startingCapital = dto.startingCapital ?? Math.round(s.liquid + s.invested);
    const contribution = dto.monthlyContribution ?? Math.round(s.currentMonthlySavings);

    switch (dto.goalType) {
      case PlanGoalType.RETIREMENT:
        return this.retirementPlan(dto, s, profile, startingCapital, contribution);
      case PlanGoalType.TARGET_AMOUNT:
        return this.targetPlan(dto, s, profile, startingCapital, contribution);
      case PlanGoalType.WEALTH_GROWTH:
        return this.growthPlan(dto, s, profile, startingCapital, contribution);
    }
  }

  // --- goal modes ---

  private retirementPlan(
    dto: BuildPlanDto,
    s: MoneySnapshot,
    profile: RiskProfile,
    startingCapital: number,
    contribution: number,
  ): FinancialPlan {
    if (dto.currentAge == null || dto.retirementAge == null) {
      throw new BadRequestException('currentAge and retirementAge are required for a retirement plan');
    }
    if (dto.retirementAge <= dto.currentAge) {
      throw new BadRequestException('retirementAge must be greater than currentAge');
    }
    const lifestyle = dto.monthlyLifestyleCost ?? Math.round(s.avgMonthlyExpense);
    if (lifestyle <= 0) {
      throw new BadRequestException(
        'monthlyLifestyleCost is required — there is no spending history to infer it from',
      );
    }

    const years = dto.retirementAge - dto.currentAge;
    const swr = profile.safeWithdrawalRate;
    const target = Math.round((lifestyle * 12) / swr);
    const projected = Math.round(futureValue(startingCapital, contribution, profile.expectedRealReturn, years));
    const required = requiredMonthly(target, startingCapital, profile.expectedRealReturn, years);

    const goalLabel = `Retire at ${dto.retirementAge}`;
    const { feasibility, headline } = this.assess(goalLabel, required, contribution, s.avgMonthlyIncome, projected, target);

    const advice: string[] = [];
    advice.push(
      `To retire at ${dto.retirementAge} on ${formatNaira(lifestyle)}/month, you need a pot of about ${formatNaira(target)} — that's your annual lifestyle cost divided by a ${Math.round(swr * 1000) / 10}% safe withdrawal rate.`,
    );
    if (feasibility === 'on_track') {
      advice.push(
        `Your current habit of saving ~${formatNaira(contribution)}/month already grows ${formatNaira(startingCapital)} into ~${formatNaira(projected)} by ${dto.retirementAge} — ahead of the target. Keep it automated.`,
      );
    } else {
      advice.push(
        `Save and invest ${formatNaira(required)}/month for the next ${years} years in the ${profile.label} mix below. You currently put away ~${formatNaira(contribution)}/month, so the gap to close is ${formatNaira(Math.max(0, required - contribution))}/month.`,
      );
    }
    if (s.avgMonthlyIncome > 0 && required > 0) {
      const pct = Math.round((required / s.avgMonthlyIncome) * 100);
      advice.push(
        `That's ${pct}% of your detected ${formatNaira(s.avgMonthlyIncome)}/month income — which caps lifestyle spending at ~${formatNaira(Math.max(0, s.avgMonthlyIncome - required))}/month.`,
      );
    }
    if ((feasibility === 'stretch' || feasibility === 'unrealistic') && dto.retirementAge + 5 <= 100) {
      const laterRequired = requiredMonthly(target, startingCapital, profile.expectedRealReturn, years + 5);
      advice.push(
        `Pushing retirement to ${dto.retirementAge + 5} drops the requirement to ${formatNaira(laterRequired)}/month — five extra compounding years do a lot of the work.`,
      );
      const trimmedTarget = Math.round((lifestyle * 0.8 * 12) / swr);
      advice.push(
        `Alternatively, a 20% leaner retirement lifestyle (${formatNaira(Math.round(lifestyle * 0.8))}/month) cuts the pot needed to ${formatNaira(trimmedTarget)}.`,
      );
    }
    advice.push(profile.blurb);

    return {
      goalType: PlanGoalType.RETIREMENT,
      goalLabel,
      feasibility,
      headline,
      horizonYears: years,
      targetCorpus: target,
      projectedCorpus: projected,
      requiredMonthlySavings: required,
      currentMonthlySavings: Math.round(s.currentMonthlySavings),
      suggestedSavingsRate: s.avgMonthlyIncome > 0 ? required / s.avgMonthlyIncome : null,
      lifestyleBudget: s.avgMonthlyIncome > 0 ? Math.max(0, Math.round(s.avgMonthlyIncome - required)) : null,
      startingCapital,
      riskAppetite: dto.riskAppetite,
      expectedRealReturn: profile.expectedRealReturn,
      safeWithdrawalRate: swr,
      allocation: profile.allocation,
      advice,
      assumptions: this.assumptions(profile, true),
    };
  }

  private targetPlan(
    dto: BuildPlanDto,
    s: MoneySnapshot,
    profile: RiskProfile,
    startingCapital: number,
    contribution: number,
  ): FinancialPlan {
    if (!dto.targetAmount || !dto.horizonYears) {
      throw new BadRequestException('targetAmount and horizonYears are required for a target plan');
    }
    const years = dto.horizonYears;
    const shortHorizon = years < SHORT_HORIZON_YEARS;
    const rate = shortHorizon ? SHORT_HORIZON_RETURN : profile.expectedRealReturn;
    const allocation = shortHorizon ? SHORT_HORIZON_ALLOCATION : profile.allocation;

    const target = Math.round(dto.targetAmount);
    const projected = Math.round(futureValue(startingCapital, contribution, rate, years));
    const required = requiredMonthly(target, startingCapital, rate, years);

    const goalLabel = dto.goalLabel?.trim() || `${formatNaira(target)} in ${years} years`;
    const { feasibility, headline } = this.assess(goalLabel, required, contribution, s.avgMonthlyIncome, projected, target);

    const advice: string[] = [];
    if (feasibility === 'on_track') {
      advice.push(
        `Your current ~${formatNaira(contribution)}/month already grows ${formatNaira(startingCapital)} past ${formatNaira(target)} within ${years} years — this goal is funded if you stay consistent.`,
      );
    } else {
      advice.push(
        `Put away ${formatNaira(required)}/month for ${years} years to reach ${formatNaira(target)}, starting from ${formatNaira(startingCapital)}. You currently save ~${formatNaira(contribution)}/month.`,
      );
    }
    if (shortHorizon) {
      advice.push(
        `This goal is under ${SHORT_HORIZON_YEARS} years away, so the plan overrides your ${profile.label} appetite with a capital-preservation mix — equities can easily be down 30% in any single year, and you don't have time to recover.`,
      );
    } else {
      advice.push(profile.blurb);
    }
    if (s.avgMonthlyIncome > 0 && required > 0) {
      advice.push(
        `${formatNaira(required)}/month is ${Math.round((required / s.avgMonthlyIncome) * 100)}% of your detected income — leaving ~${formatNaira(Math.max(0, s.avgMonthlyIncome - required))}/month for everything else.`,
      );
    }

    return {
      goalType: PlanGoalType.TARGET_AMOUNT,
      goalLabel,
      feasibility,
      headline,
      horizonYears: years,
      targetCorpus: target,
      projectedCorpus: projected,
      requiredMonthlySavings: required,
      currentMonthlySavings: Math.round(s.currentMonthlySavings),
      suggestedSavingsRate: s.avgMonthlyIncome > 0 ? required / s.avgMonthlyIncome : null,
      lifestyleBudget: s.avgMonthlyIncome > 0 ? Math.max(0, Math.round(s.avgMonthlyIncome - required)) : null,
      startingCapital,
      riskAppetite: dto.riskAppetite,
      expectedRealReturn: rate,
      safeWithdrawalRate: null,
      allocation,
      advice,
      assumptions: this.assumptions(profile, false, shortHorizon),
    };
  }

  private growthPlan(
    dto: BuildPlanDto,
    s: MoneySnapshot,
    profile: RiskProfile,
    startingCapital: number,
    contribution: number,
  ): FinancialPlan {
    if (!dto.horizonYears) {
      throw new BadRequestException('horizonYears is required for a wealth growth plan');
    }
    const years = dto.horizonYears;
    const projected = Math.round(futureValue(startingCapital, contribution, profile.expectedRealReturn, years));
    const contributed = Math.round(startingCapital + contribution * 12 * years);
    const growthShare = projected > 0 ? Math.round(((projected - contributed) / projected) * 100) : 0;

    const advice: string[] = [
      `Investing ${formatNaira(startingCapital)} now plus ${formatNaira(contribution)}/month in the ${profile.label} mix below grows to ~${formatNaira(projected)} in ${years} years (today's naira).`,
      `Of that, ${formatNaira(Math.max(0, projected - contributed))} (~${Math.max(0, growthShare)}%) is compound growth rather than money you put in — time in the market is doing the heavy lifting.`,
      profile.blurb,
    ];
    if (contribution <= 0) {
      advice.push(
        'No regular monthly saving was detected or provided — even a small automated monthly amount changes this projection dramatically.',
      );
    }

    return {
      goalType: PlanGoalType.WEALTH_GROWTH,
      goalLabel: `Grow wealth over ${years} years`,
      feasibility: 'projection',
      headline: `${formatNaira(startingCapital)} could become ~${formatNaira(projected)} in ${years} years.`,
      horizonYears: years,
      targetCorpus: null,
      projectedCorpus: projected,
      requiredMonthlySavings: 0,
      currentMonthlySavings: Math.round(s.currentMonthlySavings),
      suggestedSavingsRate: null,
      lifestyleBudget: null,
      startingCapital,
      riskAppetite: dto.riskAppetite,
      expectedRealReturn: profile.expectedRealReturn,
      safeWithdrawalRate: null,
      allocation: profile.allocation,
      advice,
      assumptions: this.assumptions(profile, false),
    };
  }

  // --- advisor chat ---

  // Deterministic Q&A: parse intent + numbers out of the question, answer
  // from the user's real data via the same engines as the rest of the coach.
  // Same-shaped replies an LLM-backed FinancialPlanner would produce.
  async chat(userId: string, message: string): Promise<ChatReply> {
    const text = message.toLowerCase().trim();
    const s = await this.snapshot(userId);

    const amount = parseMoney(text);
    const years = parseYears(text);
    const risk = parseRisk(text);
    const profile = PROFILES[risk];
    const capital = amount ?? Math.round(s.liquid + s.invested);
    const contribution = Math.round(s.currentMonthlySavings);

    // Greeting / empty-ish
    if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(text) && text.length < 30) {
      return {
        reply:
          "Hi — I'm your NetWealth advisor. I answer from your actual accounts, income and spending. Ask me about retiring, investing, saving, affordability, or how you're doing overall.",
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }

    // Retirement
    if (/retir/.test(text)) {
      const retireAt = matchInt(text, /retire\s+(?:at|by|when i'?m|when i am)\s+(\d{2})/);
      const myAge = matchInt(text, /\b(?:i'?m|i am|im)\s+(\d{2})\b/);
      if (!retireAt) {
        return {
          reply:
            'At what age would you like to retire? Ask me something like "Can I retire at 45?" — you can also tell me your age and what you have, e.g. "I\'m 30 with ₦2m, can I retire at 45?"',
          suggestions: ['Can I retire at 45?', "I'm 30 with ₦2m, can I retire at 50?"],
        };
      }
      const age = myAge ?? 30;
      try {
        const plan = this.retirementPlan(
          {
            goalType: PlanGoalType.RETIREMENT,
            riskAppetite: risk,
            currentAge: age,
            retirementAge: retireAt,
            startingCapital: amount ?? undefined,
          } as BuildPlanDto,
          s,
          profile,
          capital,
          contribution,
        );
        const ageNote = myAge == null ? ` (I assumed you're ${age} — tell me your age for a tighter answer.)` : '';
        return {
          reply: `${plan.headline}\n\n${plan.advice.slice(0, 3).join('\n\n')}${ageNote}`,
          suggestions: [
            `Can I retire at ${retireAt + 5}?`,
            'What should I invest in?',
            'How much should I be saving?',
          ],
        };
      } catch (e) {
        return {
          reply: `I couldn't build that plan: ${(e as Error).message}. Try including your age and target, e.g. "I'm 30, can I retire at 45?"`,
          suggestions: DEFAULT_SUGGESTIONS,
        };
      }
    }

    // Affordability
    if (/\b(afford|can i buy)\b/.test(text)) {
      if (!amount) {
        return {
          reply:
            'How much is it? Ask me like "Can I afford ₦250k?" — or use the "Can I afford this?" checker on the dashboard for a budget-aware answer.',
          suggestions: ['Can I afford ₦250k?', 'How much should I be saving?'],
        };
      }
      const remaining = s.liquid - amount;
      const verdict =
        remaining < 0
          ? `No — ${formatNaira(amount)} is more than the ${formatNaira(s.liquid)} you have liquid across bank and cash.`
          : s.avgMonthlyExpense > 0 && remaining < s.avgMonthlyExpense * 0.5
            ? `You can cover ${formatNaira(amount)}, but it would leave only ${formatNaira(remaining)} — less than half a typical month's spending (${formatNaira(Math.round(s.avgMonthlyExpense))}). I'd call that tight.`
            : `Yes — ${formatNaira(amount)} is comfortably covered, leaving ${formatNaira(remaining)} of your liquid ${formatNaira(s.liquid)}.`;
      return {
        reply: verdict,
        suggestions: ['How am I doing financially?', 'What should I invest in?'],
      };
    }

    // Emergency fund
    if (/emergency/.test(text)) {
      const review = await this.review(userId);
      const item = review.items.find((i) => i.area === 'Emergency fund');
      return {
        reply: item ? `${item.headline}.\n\n${item.detail}` : 'Add some transactions first so I can size your emergency fund.',
        suggestions: ['What should I invest in?', 'How much should I be saving?'],
      };
    }

    // Saving toward a named goal (house, car, school...) with an amount
    const goalWord = /\b(house|land|property|car|school|fees|tuition|wedding|travel|japa|business|rent)\b/.exec(text)?.[1];
    if (goalWord && amount) {
      const horizon = years ?? 5;
      const plan = this.targetPlan(
        {
          goalType: PlanGoalType.TARGET_AMOUNT,
          riskAppetite: risk,
          goalLabel: goalWord.charAt(0).toUpperCase() + goalWord.slice(1),
          targetAmount: amount,
          horizonYears: horizon,
        } as BuildPlanDto,
        s,
        profile,
        Math.round(s.liquid + s.invested),
        contribution,
      );
      const horizonNote = years == null ? ` (I assumed ${horizon} years — tell me the timeframe for a tighter answer.)` : '';
      return {
        reply: `${plan.headline}\n\n${plan.advice.slice(0, 2).join('\n\n')}${horizonNote}`,
        suggestions: ['What should I invest in?', 'How am I doing financially?'],
      };
    }

    // Investing / allocation
    if (
      /\b(invest\w*|allocat\w*|portfolio|crypto|bitcoin|stocks?|shares|equities|dollars?|eurobonds?|t-?bills?|real estate|mutual funds?)\b/.test(text) ||
      /(put|where should|what.{0,10}do with).{0,25}(my )?money/.test(text)
    ) {
      const lines = profile.allocation
        .map((a) => `• ${a.pct}% — ${a.assetClass}: ${a.note}`)
        .join('\n');
      const cryptoNote = /crypto|bitcoin/.test(text)
        ? '\n\nOn crypto specifically: treat it as the high-risk sleeve — capped around 10% of the portfolio, and only money you could watch drop 80% without changing your plans.'
        : '';
      const riskNote =
        risk === 'BALANCED' && !/balanced/.test(text)
          ? "\n\nI defaulted to a balanced appetite — say \"conservative\" or \"aggressive\" and I'll re-cut it."
          : '';
      return {
        reply: `For a ${profile.label} risk appetite, a sensible long-term mix:\n\n${lines}\n\n${profile.blurb}${cryptoNote}${riskNote}`,
        suggestions: ['What could my money become in 10 years?', 'Can I retire at 45?'],
      };
    }

    // Growth projection ("what could 5m become in 10 years")
    if (/\b(grow|become|turn into|worth in|compound)\b/.test(text)) {
      const horizon = years ?? 10;
      const projected = Math.round(futureValue(capital, contribution, profile.expectedRealReturn, horizon));
      return {
        reply: `Investing ${formatNaira(capital)} now plus ~${formatNaira(contribution)}/month (your current savings pace) in a ${profile.label} mix grows to about ${formatNaira(projected)} in ${horizon} years, in today's naira.\n\nBuild a "Grow my wealth" plan below to see the full allocation and assumptions.`,
        suggestions: ['What should I invest in?', 'Can I retire at 45?'],
      };
    }

    // Savings rate
    if (/\b(save|saving|savings)\b/.test(text)) {
      if (s.avgMonthlyIncome > 0) {
        const rate = (s.avgMonthlyIncome - s.avgMonthlyExpense) / s.avgMonthlyIncome;
        const target20 = Math.round(s.avgMonthlyIncome * 0.2);
        const body =
          rate >= 0.2
            ? `You're saving about ${Math.round(rate * 100)}% of your ${formatNaira(Math.round(s.avgMonthlyIncome))}/month income — at or above the 20% benchmark. The next step is making sure it's invested, not idling in a current account.`
            : `You're saving about ${Math.max(0, Math.round(rate * 100))}% of your ${formatNaira(Math.round(s.avgMonthlyIncome))}/month income. A good benchmark is 20% — that's ${formatNaira(target20)}/month. Automating a transfer on payday is the reliable way to get there.`;
        return { reply: body, suggestions: ['What should I invest in?', 'How am I doing financially?'] };
      }
      return {
        reply:
          "I couldn't detect a regular income from your transactions yet. The rule of thumb: save at least 20% of income, build a 6-month emergency fund first, then invest the rest. Connect the account your salary lands in and I can be specific.",
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }

    // Overall checkup
    if (/\b(net worth|how am i doing|health|checkup|check up|review|financial(ly)? (doing|health)|overall)\b/.test(text)) {
      const review = await this.review(userId);
      const bullets = review.items.map((i) => `• ${i.area}: ${i.headline} (${i.status === 'good' ? '✓ good' : i.status === 'watch' ? 'watch' : 'needs action'})`).join('\n');
      return {
        reply: `Your net worth is ${formatNaira(s.netWorth)}. ${review.summary}\n\n${bullets}\n\nThe checkup card above has the detail on each.`,
        suggestions: ['How much should I be saving?', 'What should I invest in?'],
      };
    }

    // Spending
    if (/\b(spend|spending|budget|expense)\b/.test(text)) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const txns = await this.prisma.transaction.findMany({
        where: { account: { userId }, type: 'EXPENSE', occurredAt: { gte: monthStart } },
        include: { category: true },
      });
      const byCategory = new Map<string, number>();
      let total = 0;
      for (const t of txns) {
        const name = t.category?.name ?? 'Uncategorized';
        byCategory.set(name, (byCategory.get(name) ?? 0) + Number(t.amount));
        total += Number(t.amount);
      }
      const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const topLines = top.map(([name, amt]) => `• ${name}: ${formatNaira(Math.round(amt))}`).join('\n');
      return {
        reply: `You've spent ${formatNaira(Math.round(total))} so far this month (typical month: ${formatNaira(Math.round(s.avgMonthlyExpense))}).${top.length ? ` Biggest categories:\n\n${topLines}` : ''}\n\nSet limits on the Budgets page and I'll warn you when you're close.`,
        suggestions: ['How much should I be saving?', 'How am I doing financially?'],
      };
    }

    // Fallback
    return {
      reply:
        'I can help with:\n\n• Retirement — "Can I retire at 45?", "I\'m 30 with ₦2m, when can I retire?"\n• Investing — "What should I invest in?", "Is crypto a good idea?"\n• Goals — "I want to buy a house of ₦20m in 5 years"\n• Growth — "What could ₦5m become in 10 years?"\n• Your money — "How am I doing?", "Can I afford ₦300k?", "How much should I save?"',
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  // --- shared helpers ---

  private assess(
    goalLabel: string,
    required: number,
    contribution: number,
    income: number,
    projected: number,
    target: number,
  ): { feasibility: PlanFeasibility; headline: string } {
    let feasibility: PlanFeasibility;
    if (projected >= target || required <= contribution) {
      feasibility = 'on_track';
    } else if (income > 0) {
      const ratio = required / income;
      feasibility = ratio <= 0.4 ? 'achievable' : ratio <= 0.7 ? 'stretch' : 'unrealistic';
    } else {
      feasibility = 'stretch';
    }
    const headline = {
      on_track: `You're on track — "${goalLabel}" is funded at your current pace.`,
      achievable: `"${goalLabel}" is achievable with disciplined saving.`,
      stretch: `"${goalLabel}" is a stretch on current numbers — possible, but demanding.`,
      unrealistic: `"${goalLabel}" isn't realistic on current numbers — see what changes that below.`,
      projection: '',
    }[feasibility];
    return { feasibility, headline };
  }

  private assumptions(profile: RiskProfile, retirement: boolean, shortHorizon = false): string[] {
    const out = [
      shortHorizon
        ? `Growth is assumed at ~${SHORT_HORIZON_RETURN * 100}% a year real (money-market territory) because the horizon is too short for growth assets.`
        : `Returns assume ~${(profile.expectedRealReturn * 100).toFixed(1)}% a year *real* (after inflation) for a ${profile.label} portfolio — a long-run blended estimate across Nigerian T-bills/bonds, NGX equities, and dollar assets, not a forecast.`,
      'All figures are in today’s naira: inflation is already netted out of the returns, and contributions are assumed to keep pace with inflation.',
    ];
    if (retirement) {
      out.push(
        `The retirement pot uses the safe-withdrawal-rate rule: a pot of (annual lifestyle cost ÷ ${(profile.safeWithdrawalRate * 100).toFixed(1)}%) has historically sustained withdrawals indefinitely.`,
      );
    }
    out.push(
      'Computed by a deterministic rule engine standing in for a real market-data/LLM advisor (swap via FINANCIAL_PLANNER env var). Educational, not licensed financial advice.',
    );
    return out;
  }

  private async snapshot(userId: string): Promise<MoneySnapshot> {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const [accounts, txns] = await Promise.all([
      this.prisma.account.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { account: { userId }, occurredAt: { gte: windowStart } },
        select: { amount: true, type: true, occurredAt: true },
      }),
    ]);

    const sumBalances = (filter: (a: (typeof accounts)[number]) => boolean) =>
      accounts.filter(filter).reduce((sum, a) => sum + Number(a.balance), 0);

    const liquid = sumBalances((a) => a.kind === 'ASSET' && ['BANK', 'CASH'].includes(a.type));
    const invested = sumBalances(
      (a) => a.kind === 'ASSET' && ['CRYPTO', 'STOCK', 'MUTUAL_FUND'].includes(a.type),
    );
    const totalAssets = sumBalances((a) => a.kind === 'ASSET');
    const totalLiabilities = sumBalances((a) => a.kind === 'LIABILITY');

    const avgMonthly = (type: 'INCOME' | 'EXPENSE') => {
      const rows = txns.filter((t) => t.type === type);
      const months = new Set(rows.map((t) => monthKey(t.occurredAt))).size || 1;
      return rows.reduce((sum, t) => sum + Number(t.amount), 0) / months;
    };
    const avgMonthlyIncome = avgMonthly('INCOME');
    const avgMonthlyExpense = avgMonthly('EXPENSE');

    return {
      liquid,
      invested,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      avgMonthlyIncome,
      avgMonthlyExpense,
      currentMonthlySavings: Math.max(0, avgMonthlyIncome - avgMonthlyExpense),
    };
  }
}

// FV of a lump sum plus a monthly contribution, compounded monthly at an
// annual rate. Rates are real (inflation-adjusted), so results read in
// today's naira.
function futureValue(principal: number, monthly: number, annualRate: number, years: number) {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const n = Math.round(years * 12);
  if (n <= 0) return principal;
  const growth = Math.pow(1 + r, n);
  return principal * growth + monthly * ((growth - 1) / r);
}

// Solve futureValue for the monthly contribution that hits `target`.
function requiredMonthly(target: number, principal: number, annualRate: number, years: number) {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const n = Math.round(years * 12);
  if (n <= 0) return Math.max(0, target - principal);
  const growth = Math.pow(1 + r, n);
  return Math.max(0, Math.round(((target - principal * growth) * r) / (growth - 1)));
}

// --- chat text parsing ---

const DEFAULT_SUGGESTIONS = [
  'Can I retire at 45?',
  'What should I invest in?',
  'How much should I be saving?',
  'How am I doing financially?',
];

// "₦1,000,000", "1m", "2.5m", "500k", "20 million" → naira. Plain numbers
// under 1000 are ignored (they're ages/years, not money).
function parseMoney(text: string): number | null {
  const re = /(?:₦|ngn\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m|million|b|billion)?\b/gi;
  let best: number | null = null;
  for (const m of text.matchAll(re)) {
    const raw = Number(m[1].replace(/,/g, ''));
    if (Number.isNaN(raw)) continue;
    const suffix = (m[2] ?? '').toLowerCase();
    const mult =
      suffix === 'k' || suffix === 'thousand'
        ? 1e3
        : suffix === 'm' || suffix === 'million'
          ? 1e6
          : suffix === 'b' || suffix === 'billion'
            ? 1e9
            : 1;
    const value = raw * mult;
    if (mult === 1 && value < 1000) continue;
    if (best === null || value > best) best = value;
  }
  return best;
}

function parseYears(text: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/.exec(text);
  return m ? Number(m[1]) : null;
}

function parseRisk(text: string): RiskAppetite {
  // Negated/averse phrasings must be checked before the aggressive keywords,
  // so "I don't like risky investments" reads as conservative, not aggressive.
  if (
    /\b(safe|safest|low.?risk|conservative|cautious|no risk|risk.?averse)\b/.test(text) ||
    /(don'?t|do not|not) (like|want|into) risk/.test(text) ||
    /(hate|avoid|scared of|afraid of) risk/.test(text)
  ) {
    return RiskAppetite.CONSERVATIVE;
  }
  if (/\b(aggressive|high.?risk|risky|max(imum)? growth)\b/.test(text)) {
    return RiskAppetite.AGGRESSIVE;
  }
  return RiskAppetite.BALANCED;
}

function matchInt(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m ? Number(m[1]) : null;
}
