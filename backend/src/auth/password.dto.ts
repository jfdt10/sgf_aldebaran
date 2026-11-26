import { IsByteLength, IsString, MinLength } from 'class-validator';

export class PasswordDto {
  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  senha: string;
}
