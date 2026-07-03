import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAlertSettingsDto {
  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;

  @IsOptional()
  @IsString()
  telegramChatId?: string;
}
