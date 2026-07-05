import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum RiskAppetite {
  CONSERVATIVE = 'CONSERVATIVE',
  BALANCED = 'BALANCED',
  AGGRESSIVE = 'AGGRESSIVE',
}

export enum PlanGoalType {
  RETIREMENT = 'RETIREMENT',
  TARGET_AMOUNT = 'TARGET_AMOUNT',
  WEALTH_GROWTH = 'WEALTH_GROWTH',
}

export class BuildPlanDto {
  @IsEnum(PlanGoalType)
  goalType: PlanGoalType;

  @IsEnum(RiskAppetite)
  riskAppetite: RiskAppetite;

  /** Capital available to invest today. Defaults to liquid + invested asset balances. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  startingCapital?: number;

  /** What the user can put away monthly. Defaults to detected income − expenses. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyContribution?: number;

  // --- RETIREMENT ---
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(90)
  currentAge?: number;

  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(100)
  retirementAge?: number;

  /** Monthly spend to sustain in retirement (today's naira). Defaults to average monthly expense. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyLifestyleCost?: number;

  // --- TARGET_AMOUNT ---
  @IsOptional()
  @IsString()
  @MaxLength(80)
  goalLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  targetAmount?: number;

  // --- TARGET_AMOUNT & WEALTH_GROWTH ---
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(60)
  horizonYears?: number;
}
