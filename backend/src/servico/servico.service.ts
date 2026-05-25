import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacaoService } from '../notificacao/notificacao.service';

@Injectable()
export class ServicoService {
  constructor(
    private prisma: PrismaService,
    private notificacaoService: NotificacaoService,
  ) {}

  async create(createServicoDto: any, requestingUserFilialId?: number) {
    const filial_id = requestingUserFilialId ?? (createServicoDto.filial_id ? +createServicoDto.filial_id : null);
    
    const servico = await this.prisma.servico.create({
      data: {
        nome: createServicoDto.nome,
        sigla:
          createServicoDto.sigla ||
          createServicoDto.nome?.substring(0, 2).toUpperCase(),
        prefixo: createServicoDto.prefixo,
        tipo: createServicoDto.tipo,
        cor: createServicoDto.cor,
        prioridadePeso: createServicoDto.prioridadePeso || 1,
        filial_id,
        ativo:
          createServicoDto.ativo !== undefined ? createServicoDto.ativo : true,
      },
    });

    // Notificação de nova categoria de fila
    await this.notificacaoService.criar({
      titulo: 'Novo Serviço/Categoria',
      mensagem: `Categoria de fila ${servico.nome} criada.`,
      icon: 'ticket',
      rota: '/admin/cadastros',
    });

    return servico;
  }

  findAll(filialId?: number, tipo?: string, includeInactive: boolean = false, requestingUserFilialId?: number) {
    const finalFilialId = requestingUserFilialId ?? filialId;
    
    const where: any = {
      deletadoEm: null,
    };

    if (!includeInactive) {
      where.ativo = true;
    }

    if (finalFilialId) {
      where.filial_id = finalFilialId;
    }

    // Filtro de Tipo: Se informado, traz o tipo específico OU os sem tipo (Geral)
    // Para fluxos de totem (Convencional/Preferencial), não devemos filtrar as categorias específicas
    if (tipo && tipo.toLowerCase() !== 'convencional' && tipo.toLowerCase() !== 'preferencial') {
      const tipoFilter = {
        OR: [
          { tipo: { equals: tipo, mode: 'insensitive' } },
          { tipo: '' },
          { tipo: null }
        ]
      };

      // Se já houver um OR (da filial), precisamos combinar usando AND
      if (where.OR) {
        const branchOR = where.OR;
        delete where.OR;
        where.AND = [
          { OR: branchOR },
          tipoFilter
        ];
      } else {
        where.OR = tipoFilter.OR;
      }
    }

    return this.prisma.servico.findMany({
      where,
      orderBy: { id: 'asc' },
    });
  }




  async findOne(id: number, requestingUserFilialId?: number) {
    const s = await this.prisma.servico.findUnique({ where: { id } });
    if (!s || s.deletadoEm || (requestingUserFilialId && s.filial_id !== requestingUserFilialId))
      throw new NotFoundException('Serviço não encontrado');
    return s;
  }

  async update(id: number, updateServicoDto: any, requestingUserFilialId?: number) {
    await this.findOne(id, requestingUserFilialId);
    // Sanitize data to avoid updating immutable or relation fields
    const {
      id: _,
      criadoEm,
      deletadoEm,
      agendamento,
      senha,
      ...cleanData
    } = updateServicoDto;

    const dataToUpdate: any = { ...cleanData };

    if (requestingUserFilialId !== undefined) {
      dataToUpdate.filial_id = requestingUserFilialId;
    } else if (cleanData.filial_id !== undefined) {
      dataToUpdate.filial_id = cleanData.filial_id ? +cleanData.filial_id : null;
    }

    const servico = await this.prisma.servico.update({
      where: { id },
      data: dataToUpdate,
    });

    // Notificação de atualização
    await this.notificacaoService.criar({
      titulo: 'Serviço Atualizado',
      mensagem: `A categoria ${servico.nome} foi atualizada.`,
      icon: 'ticket',
      rota: '/admin/cadastros',
    });

    return servico;
  }

  async remove(id: number, requestingUserFilialId?: number) {
    await this.findOne(id, requestingUserFilialId);
    
    return this.prisma.servico.update({
      where: { id },
      data: { deletadoEm: new Date() },
    });
  }
}
