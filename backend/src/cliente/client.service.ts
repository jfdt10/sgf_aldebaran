import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, randomUUID } from 'node:crypto';
import { NotificacaoService } from '../notificacao/notificacao.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClientService {
  constructor(
    private prisma: PrismaService,
    private notificacaoService: NotificacaoService,
  ) { }

  async createPublic(data: any) {
    let whereClause: any = {};
    if (data.tipo === 'PF') {
      if (!data.cpf)
        throw new BadRequestException('CPF obrigatório para Pessoa Física');
      whereClause = { cpf: data.cpf };
    } else {
      if (!data.cnpj)
        throw new BadRequestException('CNPJ obrigatório para Pessoa Jurídica');
      whereClause = { cnpj: data.cnpj };
    }

    const existe = await this.prisma.clientes.findFirst({ where: whereClause });
    if (existe)
      throw new ConflictException('Cliente já existe com este documento.');

    const emailExiste = await this.prisma.clientes.findUnique({
      where: {
        email: data.email
      },
    });
    if (emailExiste) throw new ConflictException('E-mail já cadastrado.');

    if (!data.senha || data.senha.length < 8) {
      throw new BadRequestException('A senha deve ter no mínimo 8 caracteres.');
    }

    const senhaHash = await bcrypt.hash(data.senha, 12);

    const client = await this.prisma.clientes.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: senhaHash,
        tipo: data.tipo,
        cpf: data.cpf || null,
        cnpj: data.cnpj || null,
        telefone: data.telefone || null,
        filial_id: null,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        cpf: true,
        cnpj: true,
        telefone: true,
        createdAt: true,
      },
    });

    await this.notificacaoService.criar({
      titulo: 'Novo Autocadastro',
      mensagem: `${client.nome} se cadastrou pelo portal público.`,
      icon: 'users',
      rota: '/admin/cadastros/clientes',
    });

    return client;
  }

  async createOperacional(data: any, requestingUserFilialId?: number) {
    let whereClause: any = {};
    if (data.tipo === 'PF') {
      if (!data.cpf)
        throw new BadRequestException('CPF obrigatório para Pessoa Física');
      whereClause = { cpf: data.cpf };
    } else {
      if (!data.cnpj)
        throw new BadRequestException('CNPJ obrigatório para Pessoa Jurídica');
      whereClause = { cnpj: data.cnpj };
    }

    const existe = await this.prisma.clientes.findFirst({ where: whereClause });
    if (existe)
      throw new ConflictException('Cliente já existe com este documento.');

    if (data.email) {
      const emailExiste = await this.prisma.clientes.findUnique({
        where: {
          email: data.email
        },
      });
      if (emailExiste) throw new ConflictException('E-mail já cadastrado.');
    }

    const senhaProvisoria = data.senha || randomBytes(24).toString('base64url');
    const senhaHash = await bcrypt.hash(senhaProvisoria, 12);

    const client = await this.prisma.clientes.create({
      data: {
        nome: data.nome,
        email: data.email || `sem-email-${randomUUID()}@aldebaran.local`,
        senha: senhaHash,
        tipo: data.tipo,
        cpf: data.cpf || null,
        cnpj: data.cnpj || null,
        telefone: data.telefone || null,
        filial_id: requestingUserFilialId ?? (data.filial_id ? Number(data.filial_id) : null),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        cpf: true,
        cnpj: true,
      },
    });

    await this.notificacaoService.criar({
      titulo: 'Novo Cliente',
      mensagem: `Cliente ${client.nome} cadastrado via sistema.`,
      icon: 'users',
      rota: '/admin/cadastros/clientes',
    });

    return client;
  }

  async findAll(filialId?: number, busca?: string) {
    if (busca) {
      const buscaTrim = busca.trim();
      const digitsOnly = buscaTrim.replace(/\D/g, '');
      const sqlBusca = `%${buscaTrim}%`;
      const sqlDigits = digitsOnly ? `%${digitsOnly}%` : null;

      let query;
      if (sqlDigits && digitsOnly.length >= 3) {
        query = this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id, nome, email, tipo, cpf, cnpj, telefone, "createdAt", "deletedAt", "filial_id"
           FROM clientes
           WHERE "deletedAt" IS NULL
             AND ($2::integer IS NULL OR filial_id IS NULL OR filial_id = $2)
             AND ($3::integer IS NULL OR filial_id IS NULL OR filial_id = $3)
             AND (
               unaccent(nome) ILIKE unaccent($1)
               OR unaccent(email) ILIKE unaccent($1)
               OR regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') ILIKE $2
               OR regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') ILIKE $2
               OR regexp_replace(COALESCE(telefone, ''), '\\D', '', 'g') ILIKE $2
             )`,
          sqlBusca,
          sqlDigits,
          filialId ?? null
        );
      } else {
        query = this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id, nome, email, tipo, cpf, cnpj, telefone, "createdAt", "deletedAt", "filial_id"
           FROM clientes
           WHERE "deletedAt" IS NULL
             AND (
               unaccent(nome) ILIKE unaccent($1)
               OR unaccent(email) ILIKE unaccent($1)
             )`,
          sqlBusca,
          filialId ?? null
        );
      }
      return await query;
    }

    return await this.prisma.clientes.findMany({
      where: {
        deletedAt: null,
        ...(filialId
          ? {
            OR: [{ filial_id: filialId }, { filial_id: null }],
          }
          : {}),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        cpf: true,
        cnpj: true,
        telefone: true,
        createdAt: true,
        deletedAt: true,
      },
    });
  }

  async findOne(id: string, filialId?: number) {
    const cliente = await this.prisma.clientes.findUnique({
      where: {
        id,
        ...(filialId ? { OR: [{ filial_id: filialId }, { filial_id: null }] } : {}),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        cpf: true,
        cnpj: true,
        telefone: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    return cliente;
  }

  async update(id: string, data: any, filialId?: number) {
    await this.findOne(id, filialId);

    const { cpf, cnpj, email } = data;

    const duplicate = await this.prisma.clientes.findFirst({
      where: {
        id: { not: id },
        OR: [
          cpf ? { cpf } : undefined,
          cnpj ? { cnpj } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Documento (CPF/CNPJ) ou E-mail já cadastrado para outro cliente.',
      );
    }

    const client = await this.prisma.clientes.update({
      where: {
        id
      },
      data: {
        nome: data.nome,
        email,
        cpf,
        cnpj,
        telefone: data.telefone,
        tipo: data.tipo,
        filial_id: filialId ?? (data.filial_id ? +data.filial_id : undefined),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        cpf: true,
        cnpj: true,
        telefone: true,
      },
    });

    await this.notificacaoService.criar({
      titulo: 'Cliente Atualizado',
      mensagem: `Dados do cliente ${client.nome} foram alterados.`,
      icon: 'users',
      rota: '/admin/cadastros/clientes',
    });

    return client;
  }

  async toggleStatus(id: string, filialId?: number) {
    const cliente = await this.findOne(id, filialId);
    const isDeleted = !!cliente.deletedAt;

    return await this.prisma.clientes.update({
      where: {
        id
      },
      data: {
        deletedAt: isDeleted ? null : new Date(),
      },
      select: {
        id: true,
        nome: true,
        deletedAt: true,
      },
    });
  }

  async checkExists(cpf?: string, cnpj?: string, email?: string) {
    const where: any = { OR: [] };
    if (cpf) where.OR.push({ cpf });
    if (cnpj) where.OR.push({ cnpj });
    if (email) where.OR.push({ email });

    if (where.OR.length === 0) return { exists: false };

    const existe = await this.prisma.clientes.findFirst({ where });
    return { exists: !!existe };
  }

  async resetPassword(id: string, novaSenha: string, filialId?: number) {
    await this.findOne(id, filialId);
    const senhaHash = await bcrypt.hash(novaSenha, 12);

    return await this.prisma.clientes.update({
      where: {
        id
      },
      data: { senha: senhaHash, updatedAt: new Date() },
      select: { id: true, nome: true },
    });
  }
}
