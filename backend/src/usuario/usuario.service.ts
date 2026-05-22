import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { NotificacaoService } from '../notificacao/notificacao.service';

@Injectable()
export class UsuarioService {
  constructor(
    private prisma: PrismaService,
    private notificacaoService: NotificacaoService,
  ) {}

  async criar(dados: any, requestingUserFilialId?: number) {
    const { login, senha, nome, email, perfil } = dados;

    const existe = await this.prisma.usuario.findFirst({
      where: { OR: [{ login }, { email }] },
    });

    if (existe) {
      throw new BadRequestException('Login ou E-mail já estão em uso.');
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    const novoUsuario = await this.prisma.usuario.create({
      data: {
        login,
        senha: senhaHash,
        nome,
        email,
        perfil: perfil || 'OPERADOR',
        ativo: dados.ativo ?? true,
        filial_id: requestingUserFilialId ?? (dados.filial_id ? +dados.filial_id : null),
      },
      select: {
        id: true,
        login: true,
        nome: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true,
        filial_id: true,
      },
    });

    // Criar notificação para novo operador
    if (novoUsuario.perfil === 'OPERADOR') {
      await this.notificacaoService.criar({
        titulo: 'Novo operador cadastrado',
        mensagem: `${novoUsuario.nome} foi adicionado ao sistema como Operador.`,
        rota: '/admin/cadastros',
        icon: 'userPlus',
        iconClass: 'blue-icon',
      });
    }

    return novoUsuario;
  }

  async validarLogin(login: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { login },
    });

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Login ou senha inválidos!');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Login ou senha inválidos!');
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      perfil: usuario.perfil,
      acesso: true,
    };
  }

  async findAll(filialId?: number, requestingUserFilialId?: number) {
    const finalFilialId = requestingUserFilialId ?? filialId;
    
    return await this.prisma.usuario.findMany({
      where: {
        deletadoEm: null,
        filial_id: finalFilialId ? finalFilialId : undefined,
      },
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        filial_id: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, requestingUserFilialId?: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        filial_id: true,
      },
    });

    if (!usuario || (requestingUserFilialId && usuario.filial_id !== requestingUserFilialId)) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return usuario;
  }

  async update(id: number, dados: any, requestingUserFilialId?: number) {
    await this.findOne(id, requestingUserFilialId); // Check existence and permission

    const { login, email } = dados;

    // Check if login or email is already taken by another user
    const existe = await this.prisma.usuario.findFirst({
      where: {
        id: { not: id },
        OR: [{ login }, { email: email || undefined }],
      },
    });

    if (existe) {
      throw new BadRequestException(
        'Login ou E-mail já estão em uso por outro usuário.',
      );
    }

    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dados.nome,
        email: dados.email,
        login: dados.login,
        perfil: dados.perfil,
        ativo: dados.ativo,
        filial_id: requestingUserFilialId ?? (dados.filial_id ? +dados.filial_id : null),
        atualizadoEm: new Date(),
      },
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        perfil: true,
        ativo: true,
        filial_id: true,
      },
    });

    // Notificação de alteração de usuário
    await this.notificacaoService.criar({
      titulo: 'Usuário Atualizado',
      mensagem: `Dados do usuário ${usuario.nome} foram alterados.`,
      icon: 'userPlus',
      rota: '/admin/cadastros',
    });

    return usuario;
  }

  async toggleStatus(id: number, requestingUserFilialId?: number) {
    const usuario = await this.findOne(id, requestingUserFilialId);
    return await this.prisma.usuario.update({
      where: { id },
      data: { ativo: !usuario.ativo, atualizadoEm: new Date() },
      select: { id: true, ativo: true },
    });
  }

  async resetPassword(id: number, novaSenha: string, requestingUserFilialId?: number) {
    await this.findOne(id, requestingUserFilialId);
    const senhaHash = await bcrypt.hash(novaSenha, 12);

    return await this.prisma.usuario.update({
      where: { id },
      data: { senha: senhaHash, atualizadoEm: new Date() },
      select: { id: true, nome: true },
    });
  }

  async updateFoto(id: number, fotoUrl: string) {
    await this.findOne(id);
    return await this.prisma.usuario.update({
      where: { id },
      data: { fotoPerfil: fotoUrl, atualizadoEm: new Date() },
      select: { id: true, nome: true, fotoPerfil: true },
    });
  }

  async softDelete(id: number, requestingUserFilialId?: number) {
    await this.findOne(id, requestingUserFilialId);
    return await this.prisma.usuario.update({
      where: { id },
      data: { 
        deletadoEm: new Date(),
        ativo: false 
      },
    });
  }
}
