import { Injectable, Logger } from '@nestjs/common';
import { AlertChannel } from './alert-channel.interface';

@Injectable()
export class MockAlertChannel implements AlertChannel {
  readonly name = 'mock';
  private readonly logger = new Logger('SpendingAlert');

  async send(destination: string, message: string): Promise<void> {
    // Real implementation would call the Telegram Bot API / WhatsApp
    // Business API here. For the mock, we just log what would have been
    // sent — the Alert row created by the caller is what the UI reads.
    this.logger.log(`-> ${destination}: ${message}`);
  }
}
