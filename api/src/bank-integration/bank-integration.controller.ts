import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { BankIntegrationService } from './bank-integration.service';
import { ConnectAccountDto } from './dto/connect-account.dto';
import { BankWebhookDto } from './dto/webhook.dto';

@Controller('bank')
export class BankIntegrationController {
  constructor(
    private readonly bankIntegrationService: BankIntegrationService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('institutions')
  listInstitutions() {
    return this.bankIntegrationService.listInstitutions();
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  connect(@CurrentUser() user: RequestUser, @Body() dto: ConnectAccountDto) {
    return this.bankIntegrationService.connectAccount(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('accounts/:id/sync')
  sync(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.bankIntegrationService.syncAccount(user.userId, id);
  }

  /**
   * Live-event endpoint a real provider would call (Mono/Okra webhook) when
   * new activity lands on a linked account. No JWT here — the caller is the
   * provider's server, not a logged-in user — so it's authenticated with a
   * shared secret instead, same as a real webhook signature check would be.
   */
  @Post('webhook')
  handleWebhook(@Body() dto: BankWebhookDto) {
    const expectedSecret = this.config.get<string>('BANK_WEBHOOK_SECRET');
    if (expectedSecret && dto.secret !== expectedSecret) {
      throw new ForbiddenException('Invalid webhook secret');
    }
    return this.bankIntegrationService.syncFromWebhook(dto.providerAccountId);
  }
}
