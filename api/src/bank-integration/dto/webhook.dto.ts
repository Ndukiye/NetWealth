import { IsOptional, IsString } from 'class-validator';

export class BankWebhookDto {
  @IsString()
  providerAccountId: string;

  @IsOptional()
  @IsString()
  secret?: string;
}
