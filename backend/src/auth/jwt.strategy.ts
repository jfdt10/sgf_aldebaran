import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new Error('JWT_SECRET não definido nas variáveis de ambiente!');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: any) {
    if (payload.aud === 'password-reset' || typeof payload.isStaff === 'boolean') {
      throw new UnauthorizedException();
    }

    if (payload.tipo === 'CLIENTE' && typeof payload.sub === 'string') {
      const cliente = await this.prisma.clientes.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: { id: true, email: true },
      });
      if (cliente) return { userId: cliente.id, id: cliente.id, email: cliente.email, tipo: 'CLIENTE', perfil: 'CLIENTE' };
    } else if (Number.isSafeInteger(payload.sub)) {
      const usuario = await this.prisma.usuario.findFirst({
        where: { id: payload.sub, ativo: true, deletadoEm: null },
        select: { id: true, email: true, perfil: true, filial_id: true },
      });
      if (usuario) {
        const perfil = usuario.perfil.toUpperCase();
        return { userId: usuario.id, id: usuario.id, email: usuario.email, tipo: perfil, perfil, iniciais: payload.iniciais, filial_id: usuario.filial_id };
      }
    }
    throw new UnauthorizedException();
  }
}
