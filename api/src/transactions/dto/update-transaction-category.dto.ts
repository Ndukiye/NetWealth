import { IsString } from 'class-validator';

export class UpdateTransactionCategoryDto {
  @IsString()
  categoryId: string;
}
