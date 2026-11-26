import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LogService } from '../log/log.service';
import { IsString, MaxLength, MinLength } from 'class-validator';

class RecoveryRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  email: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logService: LogService,
  ) {}

  @Post('login')
  async login(@Body() body: any) {
    try {
      const res = await this.authService.login(body);
      if (typeof res.usuario?.id === 'number') {
        await this.logService.logAction(
          'Login',
          `Login realizado com sucesso`,
          res.usuario.id,
          'Autenticação',
        );
      }
      return res;
    } catch (err) {
      await this.logService.logAction(
        'Login',
        `Tentativa de login falhou - login: ${body.email || body.login}`,
        undefined,
        'Autenticação',
        'Erro',
      );
      throw err;
    }
  }

  @Post('register')
  async register(@Body() body: any) {
    const res = await this.authService.register(body);
    await this.logService.logAction(
      'Criação',
      `Novo registro de cliente: ${body.nome}`,
      undefined,
      'Cliente',
    );
    return res;
  }

  @Post('recover')
  async recover(@Body() body: RecoveryRequestDto) {
    return this.authService.recover(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; novaSenha: string }) {
    return this.authService.resetPassword(body.token, body.novaSenha);
  }
}
