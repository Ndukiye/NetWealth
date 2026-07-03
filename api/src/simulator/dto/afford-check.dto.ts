import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class AffordCheckDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
