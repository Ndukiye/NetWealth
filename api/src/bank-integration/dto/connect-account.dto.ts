import { IsString, MinLength } from 'class-validator';

export class ConnectAccountDto {
  @IsString()
  @MinLength(1)
  institutionId: string;
}
