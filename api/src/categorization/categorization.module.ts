import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CATEGORIZER } from './categorizer.interface';
import { MockCategorizer } from './mock-categorizer';

@Module({
  imports: [ConfigModule],
  providers: [
    MockCategorizer,
    {
      provide: CATEGORIZER,
      inject: [ConfigService, MockCategorizer],
      useFactory: (config: ConfigService, mock: MockCategorizer) => {
        const kind = config.get<string>('CATEGORIZER', 'mock');
        switch (kind) {
          case 'mock':
          default:
            // Swap in an OpenAI-backed Categorizer here once CATEGORIZER=openai.
            return mock;
        }
      },
    },
  ],
  exports: [CATEGORIZER],
})
export class CategorizationModule {}
