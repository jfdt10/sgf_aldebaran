import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class ValidarCheckinDto {
  @IsString()
  codigo!: string;

  @IsNumber()
  @IsOptional()
  filialId?: number;

  @IsString()
  @IsOptional()
  tipo?: string;

  @IsBoolean()
  @IsOptional()
  ignorarRegras?: boolean;
}
