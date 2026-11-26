import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleRef } from '@nestjs/core';
import { NotificacaoGateway } from '../notificacao/notificacao.gateway';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async login(body: any) {
    const staff = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ email: body.email }, { login: body.email }],
        ativo: true,
        deletadoEm: null,
      },
    });

    if (staff) {
      const senhaValida = await bcrypt.compare(body.senha, staff.senha);
      if (!senhaValida)
        throw new UnauthorizedException('Credenciais incorretas.');

      const nomes = (staff.nome || '').trim().split(' ');
      let iniciais = '';
      if (nomes.length > 1) {
        iniciais = (nomes[0][0] + nomes[nomes.length - 1][0]).toUpperCase();
      } else if (nomes.length === 1 && nomes[0].length >= 2) {
        iniciais = nomes[0].substring(0, 2).toUpperCase();
      } else if (nomes.length === 1) {
        iniciais = nomes[0].toUpperCase();
      }

      const payload = {
        sub: staff.id,
        email: staff.email,
        tipo: staff.perfil,
        perfil: staff.perfil,
        iniciais,
        filial_id: staff.filial_id,
      };
      return {
        token: this.jwtService.sign(payload),
        usuario: {
          nome: staff.nome,
          email: staff.email,
          tipo: staff.perfil,
          perfil: staff.perfil,
          iniciais,
          id: staff.id,
          filial_id: staff.filial_id,
        },
      };
    }

    const cliente = await this.prisma.clientes.findUnique({
      where: { email: body.email },
    });

    if (cliente) {
      if (cliente.deletedAt)
        throw new UnauthorizedException('Conta inativada.');

      const senhaValida = await bcrypt.compare(body.senha, cliente.senha);
      if (!senhaValida)
        throw new UnauthorizedException('Credenciais incorretas.');

      const payload = {
        sub: cliente.id,
        email: cliente.email,
        tipo: 'CLIENTE',
      };
      return {
        token: this.jwtService.sign(payload),
        usuario: {
          id: cliente.id,
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          tipo: 'CLIENTE',
          perfil: 'CLIENTE',
          cpf: cliente.cpf,
          cnpj: cliente.cnpj,
        },
      };
    }

    throw new UnauthorizedException('Credenciais incorretas.');
  }

  async register(dados: any) {
    const existe = await this.prisma.clientes.findFirst({
      where: {
        OR: [{ email: dados.email }, { cpf: dados.documento }],
      },
    });

    if (existe) {
      if (existe.email === dados.email)
        throw new ConflictException('Este e-mail já está em uso.');
      if (existe.cpf === dados.documento)
        throw new ConflictException('Este CPF/CNPJ já está cadastrado.');
    }

    const senhaHash = await bcrypt.hash(dados.senha, 12);

    const novo = await this.prisma.clientes.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        cpf: dados.documento,
        senha: senhaHash,
      },
      select: {
        id: true,
        nome: true,
        email: true,
      },
    });

    return { message: 'Criado com sucesso', id: novo.id };
  }

  async recover(identificador: string) {
    const lookup = identificador.trim();
    if (!lookup) throw new BadRequestException('Informe o e-mail ou usuário.');

    const usuario = await this.prisma.usuario.findFirst({
      where: { ativo: true, deletadoEm: null, OR: [{ login: lookup }, { email: { equals: lookup, mode: 'insensitive' } }] },
      select: { login: true, filial_id: true },
    });
    const cliente = usuario ? null : await this.prisma.clientes.findFirst({
      where: { email: { equals: lookup, mode: 'insensitive' }, deletedAt: null },
      select: { email: true, filial_id: true },
    });

    if (usuario || cliente) {
      const filialId = usuario?.filial_id ?? cliente?.filial_id ?? null;
      const titulo = 'Solicitação de recuperação de senha';
      const rota = usuario ? '/admin/cadastros/usuarios' : '/admin/cadastros/clientes';
      const mensagem = 'Confirme a identidade antes de redefinir o acesso de ' + (usuario?.login ?? cliente?.email) + '.';
      const registrarPedido = () => this.prisma.$transaction(async tx => {
        const recente = await tx.notificacao.findFirst({
          where: { titulo, rota, mensagem, criadoEm: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
          select: { id: true },
        });
        if (recente) return [];
        const administradores = await tx.usuario.findMany({
          where: { perfil: 'ADMIN', ativo: true, deletadoEm: null,
            OR: [{ filial_id: null }, ...(filialId ? [{ filial_id: filialId }] : [])] },
          select: { id: true },
        });
        if (!administradores.length) return [];
        return tx.notificacao.createManyAndReturn({
          data: administradores.map(admin => ({ titulo, mensagem, rota, usuario_id: admin.id })),
        });
      }, { isolationLevel: 'Serializable' });
      const fluxo = await registrarPedido().catch((error: { code?: string }) => {
        if (error.code === 'P2034') return registrarPedido();
        throw error;
      });
      if (fluxo.length) {
        const gateway = this.moduleRef.get(NotificacaoGateway, { strict: false });
        for (const notificacao of fluxo) gateway.enviarNotificacao(notificacao);
      }
    }
    return { accepted: true };
  }

  async resetPassword(token: string, novaSenha: string) {
    try {
      const decoded = this.jwtService.verify(token, { audience: 'password-reset' });
      const userId = decoded.sub;
      const isStaff = decoded.isStaff;

      const senhaHash = await bcrypt.hash(novaSenha, 12);

      if (isStaff) {
        await this.prisma.usuario.update({
          where: { id: Number(userId) },
          data: { senha: senhaHash },
        });
      } else {
        await this.prisma.clientes.update({
          where: { id: String(userId) },
          data: { senha: senhaHash },
        });
      }

      return { message: 'Senha alterada com sucesso!' };
    } catch (error) {
      throw new BadRequestException('Link inválido ou expirado.');
    }
  }
}
