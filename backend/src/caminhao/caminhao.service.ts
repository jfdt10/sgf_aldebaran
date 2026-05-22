import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacaoService } from '../notificacao/notificacao.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CaminhaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
  ) {}

  async create(data: Prisma.caminhaoCreateInput, requestingUserFilialId?: number) {
    const { id, ...createData } = data as any;
    createData.filial_id = requestingUserFilialId ?? (createData.filial_id ? Number(createData.filial_id) : null);
    if (createData.motorista_id) createData.motorista_id = Number(createData.motorista_id);

    const existingPlaca = await this.prisma.caminhao.findUnique({
      where: { placa: createData.placa },
    });

    if (existingPlaca) {
      throw new ConflictException('Placa já cadastrada');
    }

    const caminhao = await this.prisma.caminhao.create({
      data: createData,
    });

    // Notificação de novo caminhão
    await this.notificacaoService.criar({
      titulo: 'Novo Caminhão',
      mensagem: `Caminhão placa ${caminhao.placa} cadastrado.`,
      icon: 'truck',
      rota: '/admin/cadastros/caminhoes',
    });

    return caminhao;
  }

  async findAll(query?: string, filialId?: number, requestingUserFilialId?: number) {
    const finalFilialId = requestingUserFilialId ?? filialId;
    
    const where: Prisma.caminhaoWhereInput = {
      deletadoEm: null,
      filial_id: finalFilialId ? finalFilialId : undefined,
    };

    if (query) {
      where.OR = [
        { placa: { contains: query, mode: 'insensitive' } },
        { modelo: { contains: query, mode: 'insensitive' } },
        { transportadora: { contains: query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.caminhao.findMany({
      where,
      include: { motorista: true },
      orderBy: { placa: 'asc' },
    });
  }

  async findOne(id: number, requestingUserFilialId?: number) {
    const where: Prisma.caminhaoWhereInput = { id, deletadoEm: null };
    if (requestingUserFilialId) {
      where.filial_id = requestingUserFilialId;
    }

    const caminhao = await this.prisma.caminhao.findFirst({
      where,
      include: { motorista: true },
    });
    if (!caminhao) {
      throw new NotFoundException('Caminhão não encontrado');
    }
    return caminhao;
  }

  async update(id: number, data: Prisma.caminhaoUpdateInput, requestingUserFilialId?: number) {
    await this.findOne(id, requestingUserFilialId);

    // Sanitize data
    const {
      id: _,
      motorista,
      criadoEm,
      deletadoEm,
      ...updateData
    } = data as any;
    if (requestingUserFilialId !== undefined) {
      updateData.filial_id = requestingUserFilialId;
    } else if (updateData.filial_id) {
      updateData.filial_id = Number(updateData.filial_id);
    }
    if (updateData.motorista_id) updateData.motorista_id = Number(updateData.motorista_id);

    if (updateData.placa) {
      delete updateData.placa; // RN01: Placa única; Placa não pode ser alterada após cadastro.
    }

    const caminhao = await this.prisma.caminhao.update({
      where: { id },
      data: {
        ...updateData,
        atualizadoEm: new Date(),
      },
      include: { motorista: true },
    });

    // Notificação de atualização
    await this.notificacaoService.criar({
      titulo: 'Caminhão Atualizado',
      mensagem: `Dados do caminhão ${caminhao.placa} foram alterados.`,
      icon: 'truck',
      rota: '/admin/cadastros/caminhoes',
    });

    return caminhao;
  }

  async checkExists(placa: string) {
    const existingPlaca = placa ? await this.prisma.caminhao.findUnique({
      where: { placa },
    }) : null;
    return { 
      exists: !!existingPlaca,
      placaExists: !!existingPlaca 
    };
  }

  async softDelete(id: number, requestingUserFilialId?: number) {
    await this.findOne(id, requestingUserFilialId);
    return this.prisma.caminhao.update({
      where: { id },
      data: {
        deletadoEm: new Date(),
        status: 'INATIVO',
      },
    });
  }

  async toggleStatus(id: number, requestingUserFilialId?: number) {
    const caminhao = await this.findOne(id, requestingUserFilialId);
    const novoStatus = caminhao.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';

    return this.prisma.caminhao.update({
      where: { id },
      data: { status: novoStatus },
    });
  }

  async vincularMotorista(id: number, motoristaId: number | null) {
    await this.findOne(id);

    // We accept null to unbind
    return this.prisma.caminhao.update({
      where: { id },
      data: {
        motorista: motoristaId
          ? { connect: { id: motoristaId } }
          : { disconnect: true },
        atualizadoEm: new Date(),
      },
      include: { motorista: true },
    });
  }
}
