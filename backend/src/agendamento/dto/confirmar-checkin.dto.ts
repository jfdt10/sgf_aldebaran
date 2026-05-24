import { IsOptional, IsString } from 'class-validator';

export class ConfirmarCheckinDto {
  @IsString()
  @IsOptional()
  tipo?: string;
}
