import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CategorizationModule } from '../categorization/categorization.module';
import { CategoriesModule } from '../categories/categories.module';
import { AlertsModule } from '../alerts/alerts.module';
import { BANK_PROVIDER } from './bank-provider.interface';
import { MockBankProvider } from './mock-bank.provider';
import { BankIntegrationService } from './bank-integration.service';
import { BankIntegrationController } from './bank-integration.controller';
import { BankSyncScheduler } from './bank-sync.scheduler';

@Module({
  imports: [ConfigModule, CategorizationModule, CategoriesModule, AlertsModule],
  providers: [
    MockBankProvider,
    {
      provide: BANK_PROVIDER,
      inject: [ConfigService, MockBankProvider],
      useFactory: (config: ConfigService, mock: MockBankProvider) => {
        const kind = config.get<string>('BANK_PROVIDER', 'mock');
        switch (kind) {
          case 'mock':
          default:
            // Swap in a Mono/Okra-backed BankProvider here once credentials exist.
            return mock;
        }
      },
    },
    BankIntegrationService,
    BankSyncScheduler,
  ],
  controllers: [BankIntegrationController],
  exports: [BankIntegrationService],
})
export class BankIntegrationModule {}
