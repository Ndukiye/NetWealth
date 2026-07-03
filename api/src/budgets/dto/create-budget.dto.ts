import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  categoryId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  year: number;

  @IsNumber()
  limit: number;
}
