import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_ADVISOR } from './advisor.interface';
import { RuleBasedAdvisor } from './rule-based-advisor';
import { InsightsController } from './insights.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    RuleBasedAdvisor,
    {
      provide: AI_ADVISOR,
      inject: [ConfigService, RuleBasedAdvisor],
      useFactory: (config: ConfigService, ruleBased: RuleBasedAdvisor) => {
        const kind = config.get<string>('AI_ADVISOR', 'rule-based');
        switch (kind) {
          case 'rule-based':
          default:
            // Swap in an OpenAI-backed AiAdvisor here once AI_ADVISOR=openai.
            return ruleBased;
        }
      },
    },
  ],
  controllers: [InsightsController],
  exports: [AI_ADVISOR],
})
export class InsightsModule {}
