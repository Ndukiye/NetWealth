import { IsNumber } from 'class-validator';

export class UpdateBudgetDto {
  @IsNumber()
  limit: number;
}
