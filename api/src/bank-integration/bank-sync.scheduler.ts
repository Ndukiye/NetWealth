import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BankIntegrationService } from './bank-integration.service';
import { AlertsService } from '../alerts/alerts.service';

/**
 * Periodic fallback sync. Real Mono/Okra webhooks aren't guaranteed for
 * every Nigerian bank, so accounts are also polled on a schedule — every
 * few minutes here, matching the brief's own guidance to support both
 * live events and scheduled syncing.
 */
@Injectable()
export class BankSyncScheduler {
  private readonly logger = new Logger(BankSyncScheduler.name);

  constructor(
    private readonly bankIntegrationService: BankIntegrationService,
    private readonly alertsService: AlertsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledSync() {
    if (this.config.get<string>('SCHEDULED_SYNC_ENABLED', 'true') !== 'true') return;

    const result = await this.bankIntegrationService.syncAllLinkedAccounts();
    if (result.totalLinked > 0) {
      this.logger.log(
        `Scheduled sync: ${result.accountsSynced}/${result.totalLinked} linked accounts synced`,
      );
    }

    const alerts = await this.alertsService.checkAndDispatchForAllUsers();
    if (alerts.alertsSent > 0) {
      this.logger.log(`Dispatched ${alerts.alertsSent} spending alert(s) after sync`);
    }
  }
}
