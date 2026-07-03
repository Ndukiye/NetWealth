import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InsightsModule } from '../insights/insights.module';
import { ALERT_CHANNEL } from './alert-channel.interface';
import { MockAlertChannel } from './mock-alert.channel';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [ConfigModule, InsightsModule],
  providers: [
    MockAlertChannel,
    {
      provide: ALERT_CHANNEL,
      inject: [ConfigService, MockAlertChannel],
      useFactory: (config: ConfigService, mock: MockAlertChannel) => {
        const kind = config.get<string>('ALERT_CHANNEL', 'mock');
        switch (kind) {
          case 'mock':
          default:
            // Swap in a Telegram/WhatsApp-backed AlertChannel here once credentials exist.
            return mock;
        }
      },
    },
    AlertsService,
  ],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
