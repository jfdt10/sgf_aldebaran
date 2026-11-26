import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new Error('JWT_SECRET não definido nas variáveis de ambiente!');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    if (payload.aud === 'password-reset' || typeof payload.isStaff === 'boolean') {
      throw new UnauthorizedException();
    }

    return {
      userId: payload.sub,
      id: payload.sub,
      email: payload.email,
      tipo: payload.tipo,
      perfil: payload.perfil,
      iniciais: payload.iniciais,
      filial_id: payload.filial_id,
    };
  }
}
