import { IsByteLength, IsString, MinLength } from 'class-validator';

export class PasswordDto {
  @IsString()
  @MinLength(8)
  @IsByteLength(8, 72)
  senha: string;
}

export class ChangeStaffPasswordDto extends PasswordDto {
  @IsString()
  @IsByteLength(1, 72)
  senhaAtual: string;
}
