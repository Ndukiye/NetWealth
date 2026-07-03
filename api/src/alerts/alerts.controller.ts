import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { AlertsService } from './alerts.service';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('settings')
  getSettings(@CurrentUser() user: RequestUser) {
    return this.alertsService.getSettings(user.userId);
  }

  @Patch('settings')
  updateSettings(@CurrentUser() user: RequestUser, @Body() dto: UpdateAlertSettingsDto) {
    return this.alertsService.updateSettings(user.userId, dto);
  }

  @Get()
  listRecent(@CurrentUser() user: RequestUser) {
    return this.alertsService.listRecent(user.userId);
  }

  @Post('test')
  sendTest(@CurrentUser() user: RequestUser) {
    return this.alertsService.sendTest(user.userId);
  }

  @Post('check')
  checkAndDispatch(@CurrentUser() user: RequestUser) {
    return this.alertsService.checkAndDispatch(user.userId);
  }
}
