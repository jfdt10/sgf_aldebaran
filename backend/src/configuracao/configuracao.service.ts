import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacaoService } from '../notificacao/notificacao.service';

@Injectable()
export class ConfiguracaoService {
  constructor(
    private prisma: PrismaService,
    private notificacaoService: NotificacaoService,
  ) {}

  // Busca todas as configurações e mapeia num objeto { chave: valor } pro frontend (LEGADO)
  async findAll(filialId?: any, requestingUserFilialId?: number) {
    const finalFilialId = requestingUserFilialId ?? (
      filialId && filialId !== 'null' && filialId !== 'undefined'
        ? Number(filialId)
        : null
    );
    
    const list = await this.prisma.configuracao.findMany({
      where: { filial_id: finalFilialId },
    });
    const configMap: Record<string, string> = {};
    for (const item of list) {
      configMap[item.chave] = item.valor;
    }
    return configMap;
  }

  // Busca lista bruta de configurações
  async findAllList(filialId?: any, requestingUserFilialId?: number) {
    const finalFilialId = requestingUserFilialId ?? (
      filialId && filialId !== 'null' && filialId !== 'undefined'
        ? Number(filialId)
        : null
    );

    const where: any = {};
    if (finalFilialId) {
      where.filial_id = finalFilialId;
    } else {
      where.OR = [{ filial_id: null }];
    }

    const allConfigs = await this.prisma.configuracao.findMany({
      where,
      orderBy: { filial_id: 'desc' },
    });

    // De-duplicar preferendo a versão da filial
    const merged: any[] = [];
    const keys = new Set<string>();

    for (const config of allConfigs) {
      if (!keys.has(config.chave)) {
        merged.push(config);
        keys.add(config.chave);
      }
    }

    return merged;
  }

  // Atualização em lote (Bulk)
  async updateBulk(
    configs: { chave: string; valor: string }[],
    filialId?: any,
    requestingUserFilialId?: number,
  ) {
    const fId = requestingUserFilialId ?? (
      filialId && filialId !== 'null' && filialId !== 'undefined'
        ? Number(filialId)
        : null
    );

    console.log(
      `[CONFIG] Salvando bulk para filial: ${fId}, total itens: ${configs.length}`,
    );

    for (const c of configs) {
      const existing = await this.prisma.configuracao.findFirst({
        where: { chave: c.chave, filial_id: fId },
      });

      if (existing) {
        await this.prisma.configuracao.update({
          where: { id: existing.id },
          data: { valor: c.valor },
        });
      } else {
        await this.prisma.configuracao.create({
          data: { chave: c.chave, valor: c.valor, filial_id: fId },
        });
      }
    }

    let filialNome = 'Geral';
    if (fId) {
      const filial = await this.prisma.filial.findUnique({
        where: { id: fId },
        select: { nome: true },
      });
      if (filial) {
        filialNome = filial.nome;
      } else {
        filialNome = `Filial ${fId}`;
      }
    }

    // Notificação de alteração de configurações do sistema
    await this.notificacaoService.criar({
      titulo: 'Configurações Atualizadas',
      mensagem: `As configurações do sistema (${filialNome}) foram salvas.`,
      icon: 'settings',
      rota: '/admin/configuracoes',
    });

    return { message: 'Lote de configurações salvo com sucesso!', filialNome };
  }

  // Recebe um objeto chave: valor do frontend e cria ou atualiza tudo (MANTIDO PARA COMPATIBILIDADE)
  async updateAll(configBody: Record<string, string>, filialId?: number) {
    const fId = filialId ? Number(filialId) : null;
    const operations: any[] = [];
    for (const [chave, valor] of Object.entries(configBody)) {
      operations.push(
        this.prisma.configuracao.upsert({
          where: {
            chave_filial_id: {
              chave,
              filial_id: fId as any,
            },
          },
          update: { valor },
          create: { chave, valor, filial_id: fId as any },
        }),
      );
    }
    await this.prisma.$transaction(operations);
    return { message: 'Configurações salvas com sucesso!' };
  }

  async calibrarSla(body: { filialId?: number; servicoId?: number; usuarioId?: number }) {
    const filialId = body.filialId ? Number(body.filialId) : undefined;
    const servicoId = body.servicoId ? Number(body.servicoId) : undefined;

    const whereServico: any = { deletadoEm: null, ativo: true };
    if (servicoId) {
      whereServico.id = servicoId;
    } else if (filialId) {
      whereServico.filial_id = filialId;
    }

    const servicos = await this.prisma.servico.findMany({
      where: whereServico,
    });

    const resultados: any[] = [];

    for (const servico of servicos) {
      const atendimentos = await this.prisma.atendimento.findMany({
        where: {
          fimAtendimento: { not: null },
          senha: {
            servico_id: servico.id,
            status: 'FINALIZADO',
          },
        },
        orderBy: { id: 'desc' },
        take: 150,
        include: { senha: true },
      });

      const waitTimes: number[] = [];
      const serviceTimes: number[] = [];

      for (const atd of atendimentos) {
        if (atd.senha) {
          const waitTimeMs = new Date(atd.inicioAtendimento).getTime() - new Date(atd.senha.dataCriacao).getTime();
          const waitTimeMin = waitTimeMs / 60000;
          if (waitTimeMin >= 0) {
            waitTimes.push(waitTimeMin);
          }
        }

        const serviceTimeMs = new Date(atd.fimAtendimento!).getTime() - new Date(atd.inicioAtendimento).getTime();
        const serviceTimeMin = serviceTimeMs / 60000;
        if (serviceTimeMin >= 1 && serviceTimeMin <= 180) {
          serviceTimes.push(serviceTimeMin);
        }
      }

      let novaMetaEspera: number | null = null;
      let novaMetaAtendimento: number | null = null;
      const alpha = 0.3; // Fator de suavização da média móvel exponencial

      if (waitTimes.length >= 30) {
        waitTimes.sort((a, b) => a - b);
        const index = (waitTimes.length - 1) * 0.75;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const p75Value = waitTimes[lower] + (waitTimes[upper] - waitTimes[lower]) * (index - lower);
        const valorCalculado = Math.max(5, Math.min(60, p75Value));

        const metaAntiga = servico.metaEspera || 20;
        novaMetaEspera = Math.round((1 - alpha) * metaAntiga + alpha * valorCalculado);
      }

      if (serviceTimes.length >= 30) {
        serviceTimes.sort((a, b) => a - b);
        const mid = Math.floor(serviceTimes.length / 2);
        const medianValue = serviceTimes.length % 2 !== 0
          ? serviceTimes[mid]
          : (serviceTimes[mid - 1] + serviceTimes[mid]) / 2;
        const valorCalculado = Math.max(5, Math.min(60, medianValue));

        const metaAntiga = servico.metaAtendimento || 15;
        novaMetaAtendimento = Math.round((1 - alpha) * metaAntiga + alpha * valorCalculado);
      }

      if (novaMetaEspera !== null || novaMetaAtendimento !== null) {
        const updateData: any = {};
        if (novaMetaEspera !== null) updateData.metaEspera = novaMetaEspera;
        if (novaMetaAtendimento !== null) updateData.metaAtendimento = novaMetaAtendimento;

        await this.prisma.servico.update({
          where: { id: servico.id },
          data: updateData,
        });

        await this.prisma.log_auditoria.create({
          data: {
            acao: 'CALIBRACAO_SLA',
            descricao: JSON.stringify({
              servicoId: servico.id,
              nomeServico: servico.nome,
              metaEsperaAntiga: servico.metaEspera,
              metaEsperaNova: novaMetaEspera ?? servico.metaEspera,
              metaAtendimentoAntiga: servico.metaAtendimento,
              metaAtendimentoNova: novaMetaAtendimento ?? servico.metaAtendimento,
              amostrasEspera: waitTimes.length,
              amostrasAtendimento: serviceTimes.length,
            }),
            usuario_id: body.usuarioId || null,
            filial_id: servico.filial_id || null,
            entidade: 'servico',
            status: 'Sucesso',
          },
        });

        resultados.push({
          servicoId: servico.id,
          nome: servico.nome,
          amostrasEspera: waitTimes.length,
          amostrasAtendimento: serviceTimes.length,
          metaEsperaNova: novaMetaEspera,
          metaAtendimentoNova: novaMetaAtendimento,
        });
      }
    }

    return {
      message: `Calibração concluída. ${resultados.length} serviços atualizados.`,
      resultados,
    };
  }
}
