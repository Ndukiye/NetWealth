import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FINANCIAL_PLANNER } from './planner.interface';
import { RuleBasedPlanner } from './rule-based-planner';
import { PlannerController } from './planner.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    RuleBasedPlanner,
    {
      provide: FINANCIAL_PLANNER,
      inject: [ConfigService, RuleBasedPlanner],
      useFactory: (config: ConfigService, ruleBased: RuleBasedPlanner) => {
        const kind = config.get<string>('FINANCIAL_PLANNER', 'rule-based');
        switch (kind) {
          case 'rule-based':
          default:
            // Swap in an LLM/market-data-backed FinancialPlanner here once
            // FINANCIAL_PLANNER=openai.
            return ruleBased;
        }
      },
    },
  ],
  controllers: [PlannerController],
  exports: [FINANCIAL_PLANNER],
})
export class PlannerModule {}
