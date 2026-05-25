import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacaoService } from '../notificacao/notificacao.service';
import { NotificacaoGateway } from '../notificacao/notificacao.gateway';
import { AgendamentoService } from '../agendamento/agendamento.service';
import { ClienteRegrasService } from '../agendamento/cliente-regras.service';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { SenhaService } from '../senha/senha.service';
import { QueueEngine } from '../domain/engine/queue.engine';


@Injectable()
export class FilaService {
  constructor(
    private prisma: PrismaService,
    private notificacaoService: NotificacaoService,
    private notificacaoGateway: NotificacaoGateway,
    @Inject(forwardRef(() => AgendamentoService)) private agendamentoService: AgendamentoService,
    private senhaService: SenhaService,
    @Inject(forwardRef(() => ClienteRegrasService)) private clienteRegrasService: ClienteRegrasService,
  ) { }

  // Totem ticket generation logic
  async solicitarSenhaTotem(
    tipoRaw: string,
    nomeCategoria?: string,
    filialId?: number,
    categoriaId?: number,
    qtdeGarrafoes?: number,
  ) {
    const filialNormalizada = filialId ? +filialId : null;
    const servico = await this.buscarServicoValidoParaTotem({
      categoriaId,
      nomeCategoria,
      filialId: filialNormalizada,
    });

    if (!servico) {
      throw new BadRequestException(
        `Servico '${nomeCategoria || categoriaId}' nao cadastrado para esta unidade.`,
      );
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Considerar DATA_ZERAR_FILA para reiniciar a numeração hoje
    const configZerar = await this.prisma.configuracao.findFirst({
      where: { chave: 'DATA_ZERAR_FILA', filial_id: filialId || null },
    });
    const dataZerar = configZerar ? new Date(configZerar.valor) : startOfToday;
    const effectiveStart = dataZerar > startOfToday ? dataZerar : startOfToday;

    const tipoFormatado =
      (tipoRaw || '').toLowerCase() === 'preferencial'
        ? 'Preferencial'
        : 'Convencional';
    const prefixoTipo = tipoFormatado === 'Preferencial' ? 'P' : 'C';
    const codigoCategoria = this.obterCodigoCategoria(
      servico.prefixo,
      servico.sigla,
    );

    const totalHoje = await this.prisma.senha.count({
      where: {
        dataCriacao: { gte: effectiveStart },
        filial_id: filialNormalizada,
        servico_id: servico.id,
      },
    });

    const sequencial = (totalHoje + 1).toString().padStart(3, '0');
    const numeroDisplay = `${prefixoTipo}-${codigoCategoria}${sequencial}`;

    const novaSenha = await this.prisma.senha.create({
      data: {
        numeroDisplay,
        status: 'AGUARDANDO',
        filial_id: filialNormalizada,
        servico_id: servico.id,
        tipoOrigem: 'TOTEM',
        tipo: tipoFormatado,
        qtdeGarrafoes: qtdeGarrafoes || 0,
      },
    });

    await this.notificacaoService.criar({
      titulo: 'Nova Senha Gerada',
      mensagem: `Ticket ${novaSenha.numeroDisplay} no servico ${servico.nome}.`,
      icon: 'ticket',
      rota: '/admin/dashboard',
    });

    return novaSenha;
  }

  async validarCheckin(codigo: string, filialId?: number, tipo?: string, ignorarRegras?: boolean) {
    const codigoNormalizado = this.normalizarCodigoCheckin(codigo);
    if (!codigoNormalizado)
      throw new BadRequestException('Codigo obrigatorio.');

    const agendamento = await this.buscarAgendamentoPorCodigoCheckin(
      codigoNormalizado,
    );

    if (!agendamento) {
      return { valido: false, mensagem: 'Agendamento nao encontrado.' };
    }
    if (agendamento.status === 'CANCELADO') {
      return { valido: false, mensagem: 'Agendamento cancelado.' };
    }
    if (agendamento.status === 'CHECKIN_REALIZADO') {
      return { valido: false, mensagem: 'Check-in ja realizado.' };
    }
    if (agendamento.status === 'REALIZADO') {
      return { valido: false, mensagem: 'Atendimento ja finalizado.' };
    }

    const filialEfetiva =
      filialId !== undefined && filialId !== null
        ? filialId
        : (agendamento.filial_id ?? null);

    if (!ignorarRegras) {
      await this.clienteRegrasService.validarCheckinCliente({
        data: agendamento.data,
        hora: agendamento.hora,
        filialId: filialEfetiva,
      });
    }

    const senhaGerada = await this.senhaService.gerarSenhaCliente({
      servico: agendamento.servico,
      filialId: filialEfetiva,
      agendamentoId: agendamento.id,
      qtdeGarrafoes: agendamento.qtdeGarrafoes,
      tipo,
    });

    await this.prisma.agendamento.update({
      where: { id: agendamento.id },
      data: { status: 'CHECKIN_REALIZADO', checkinAt: new Date() },
    });

    await this.notificacaoService.criar({
      titulo: 'Check-in Realizado',
      mensagem: `Cliente ${agendamento.nomeCliente} chegou para o agendamento.`,
      icon: 'checkCircle',
      rota: '/admin/dashboard',
    });

    this.notificacaoGateway.broadcastRefresh();

    return { valido: true, mensagem: 'Sucesso', ticket: senhaGerada };
  }

  async criarServico(nome: string, sigla: string) {
    const existe = await this.prisma.servico.findFirst({
      where: { OR: [{ nome }, { sigla }] },
    });
    if (existe) {
      throw new BadRequestException(
        'Servico ja existe (nome ou sigla duplicados).',
      );
    }

    return await this.prisma.servico.create({
      data: { nome, sigla },
    });
  }

  async atualizarServico(id: number, dados: any) {
    await this.buscarServicoPorId(id);
    return await this.prisma.servico.update({
      where: { id },
      data: dados,
    });
  }

  async excluirServico(id: number) {
    await this.buscarServicoPorId(id);
    return await this.prisma.servico.update({
      where: { id },
      data: { deletadoEm: new Date() },
    });
  }

  async listarServicos() {
    return await this.prisma.servico.findMany({
      where: { deletadoEm: null },
    });
  }

  private async buscarServicoPorId(id: number) {
    const servico = await this.prisma.servico.findUnique({ where: { id } });
    if (!servico) throw new NotFoundException('Servico nao encontrado');
    return servico;
  }

  async horariosDisponiveis(data: string, filialId?: any, servicoId?: any) {
    const fId =
      filialId && filialId !== 'null' && filialId !== 'undefined'
        ? Number(filialId)
        : null;

    const sId =
      servicoId && servicoId !== 'null' && servicoId !== 'undefined'
        ? Number(servicoId)
        : null;

    const configs = await this.prisma.configuracao.findMany({
      where: {
        OR: [{ filial_id: fId }, { filial_id: null }],
      },
    });

    const getConfig = (chave: string, padrao: string) => {
      const branchVal = configs.find(
        (c) => c.chave === chave && c.filial_id === fId,
      );
      if (branchVal && branchVal.valor && branchVal.valor.trim() !== '') {
        return branchVal.valor;
      }
      const globalVal = configs.find(
        (c) => c.chave === chave && c.filial_id === null,
      );
      if (globalVal && globalVal.valor && globalVal.valor.trim() !== '') {
        return globalVal.valor;
      }
      return padrao;
    };

    const inicioStr = getConfig('TOTEM_HORARIO_INICIO', '08:00');
    const fimStr = getConfig('TOTEM_HORARIO_FIM', '18:00');
    const diasPermitidosJson = getConfig('TOTEM_DIAS', '[1,2,3,4,5]');

    let diasPermitidos: number[] = [];
    try {
      diasPermitidos = JSON.parse(diasPermitidosJson);
    } catch {
      diasPermitidos = [1, 2, 3, 4, 5];
    }

    const dataObj = new Date(`${data}T12:00:00`);
    const diaSemana = dataObj.getDay();

    if (!diasPermitidos.includes(diaSemana)) {
      return [];
    }

    const intervaloStr = getConfig('TOTEM_INTERVALO_MINUTOS', '30');
    const intervalo = isNaN(Number(intervaloStr)) ? 30 : Number(intervaloStr);

    const grade: string[] = [];
    let atual = this.parseTime(inicioStr);
    const fim = this.parseTime(fimStr);

    while (atual < fim) {
      grade.push(this.formatTime(atual));
      atual += intervalo;
    }

    const agendados = await this.prisma.agendamento.findMany({
      where: {
        data,
        filial_id: fId,
        servico_id: sId ? sId : undefined,
        status: { not: 'CANCELADO' },
      },
    });
    const horariosOcupados = agendados.map((a) => a.hora);

    const agora = new Date();

    return Promise.all(grade.map(async (hora) => {
      const horarioClienteValido =
        await this.clienteRegrasService.isHorarioDisponivelParaAgendamento({
          data,
          hora,
          filialId: fId,
          now: agora,
        });

      return {
        hora,
        disponivel: !horariosOcupados.includes(hora) && horarioClienteValido,
      };
    }));
  }

  private parseTime(timeStr: string): number {
    if (!timeStr) return 0;

    let hours = 0;
    let minutes = 0;

    const cleanTime = timeStr.trim().toUpperCase();
    const isPM = cleanTime.includes('PM');
    const isAM = cleanTime.includes('AM');

    const timePart = cleanTime.replace('AM', '').replace('PM', '').trim();
    const parts = timePart.split(':').map(Number);

    hours = parts[0] || 0;
    minutes = parts[1] || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  async criarAgendamento(dados: any) {
    const fId = dados.filial_id ? Number(dados.filial_id) : null;
    const qtdeGarrafoes = Math.max(
      0,
      Number(dados.qtdeGarrafoes ?? dados.quantidade ?? 0) || 0,
    );

    await this.clienteRegrasService.validarAgendamentoCliente({
      data: dados.data,
      hora: dados.hora,
      filialId: fId,
    });

    const ocupado = await this.prisma.agendamento.findFirst({
      where: {
        data: dados.data,
        hora: dados.hora,
        filial_id: fId,
        servico_id: dados.servico_id ? Number(dados.servico_id) : undefined,
        status: { not: 'CANCELADO' },
      },
    });
    if (ocupado) throw new BadRequestException('Horario ocupado.');

    const agendamento = await this.prisma.agendamento.create({
      data: {
        nomeCliente: dados.nome,
        documento: dados.documento,
        data: dados.data,
        hora: dados.hora,
        status: 'CONFIRMADO',
        codigo: dados.codigo
          ? String(dados.codigo).trim().toUpperCase()
          : null,
        qtdeGarrafoes,
        servico: { connect: { id: Number(dados.servico_id) } },
        filial: fId ? { connect: { id: fId } } : undefined,
      },
      include: {
        servico: {
          select: { id: true, nome: true },
        },
        filial: {
          select: { id: true, nome: true },
        },
      },
    });

    await this.notificarClientePorDocumento(agendamento.documento, {
      titulo: 'Agendamento confirmado',
      mensagem: `Seu agendamento de ${agendamento.servico?.nome || 'atendimento'} foi confirmado para ${agendamento.data} às ${agendamento.hora}.`,
      icon: 'calendarPlus',
      iconClass: 'blue-icon',
      rota: '/client/meus-agendamentos',
    });

    return agendamento;
  }

  async listarAgendamentos(
    filialId?: number,
    authUser?: AuthenticatedUser,
  ) {
    const where: any = {
      filial_id: filialId ? filialId : undefined,
    };

    if (authUser?.tipo === 'CLIENTE') {
      where.documento = authUser.email;
    }

    return await this.prisma.agendamento.findMany({
      where,
      orderBy: [{ data: 'asc' }, { hora: 'asc' }],
      include: { servico: true, filial: true },
    });
  }

  async buscarAgendamento(id: number) {
    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id },
      include: { servico: true, filial: true },
    });
    if (!agendamento) throw new NotFoundException();
    return agendamento;
  }

  async excluirAgendamento(id: number, authUser?: AuthenticatedUser) {
    if (authUser?.tipo === 'CLIENTE') {
      const res = await this.agendamentoService.cancelarMeuAgendamento(
        String(authUser.userId),
        id,
      );
      this.notificacaoGateway.broadcastRefresh();
      return res;
    }

    await this.buscarAgendamento(id);
    const result = await this.prisma.agendamento.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });
    this.notificacaoGateway.broadcastRefresh();
    return result;
  }

  async resgatarAgendamento(id: number) {
    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id },
    });
    if (!agendamento) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    const ticket = await this.prisma.senha.findFirst({
      where: { agendamento_id: id },
      orderBy: { dataCriacao: 'desc' },
    });

    if (!ticket) {
      throw new BadRequestException('Nenhuma senha encontrada para este agendamento.');
    }

    // Restaurar a senha para AGUARDANDO e com data/hora atuais
    await this.prisma.senha.update({
      where: { id: ticket.id },
      data: {
        status: 'AGUARDANDO',
        dataCriacao: new Date(),
      },
    });

    // Atualizar status do agendamento para CHECKIN_REALIZADO
    const result = await this.prisma.agendamento.update({
      where: { id },
      data: {
        status: 'CHECKIN_REALIZADO',
      },
    });

    this.notificacaoGateway.broadcastRefresh();

    return result;
  }

  async resgatarSenha(id: number) {
    const ticket = await this.prisma.senha.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Senha não encontrada.');
    }

    // Restaurar a senha para AGUARDANDO e com data/hora atuais
    const result = await this.prisma.senha.update({
      where: { id },
      data: {
        status: 'AGUARDANDO',
        dataCriacao: new Date(),
      },
    });

    if (ticket.agendamento_id) {
      await this.prisma.agendamento.update({
        where: { id: ticket.agendamento_id },
        data: {
          status: 'CHECKIN_REALIZADO',
        },
      });
    }

    this.notificacaoGateway.broadcastRefresh();

    return result;
  }

  // Queue management and dashboard views

  async zerarFila(filialId?: number) {
    const fId = filialId ? +filialId : null;

    // Remove senhas 'AGUARDANDO' que NÃO possuem agendamento_id
    const deleted = await this.prisma.senha.deleteMany({
      where: {
        status: 'AGUARDANDO',
        agendamento_id: null,
        filial_id: fId,
      },
    });

    // Salva o momento do "zerar" para reiniciar o contador a partir de agora
    const agoraStr = new Date().toISOString();
    const existingConfig = await this.prisma.configuracao.findFirst({
      where: { chave: 'DATA_ZERAR_FILA', filial_id: fId },
    });

    if (existingConfig) {
      await this.prisma.configuracao.update({
        where: { id: existingConfig.id },
        data: { valor: agoraStr },
      });
    } else {
      await this.prisma.configuracao.create({
        data: { chave: 'DATA_ZERAR_FILA', valor: agoraStr, filial_id: fId },
      });
    }

    // Opcional: emitir para todos no WebSocket recarregarem a fila
    this.notificacaoGateway.enviarParaTodos('fila_zerada', { filialId: fId });

    return { message: 'Fila zerada com sucesso', removidas: deleted.count };
  }

  async solicitarSenha(servicoId: number) {
    const servico = await this.prisma.servico.findUnique({
      where: { id: servicoId },
    });
    if (!servico) throw new NotFoundException('Servico invalido');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const configZerar = await this.prisma.configuracao.findFirst({
      where: { chave: 'DATA_ZERAR_FILA', filial_id: servico.filial_id },
    });
    const dataZerar = configZerar ? new Date(configZerar.valor) : hoje;
    const effectiveStart = dataZerar > hoje ? dataZerar : hoje;

    const count = await this.prisma.senha.count({
      where: { servico_id: servicoId, dataCriacao: { gte: effectiveStart } },
    });
    const codigoCategoria = this.obterCodigoCategoria(
      servico.prefixo,
      servico.sigla,
    );
    const numeroDisplay = `${codigoCategoria}-${(count + 1)
      .toString()
      .padStart(3, '0')}`;

    const senha = await this.prisma.senha.create({
      data: {
        numeroDisplay,
        status: 'AGUARDANDO',
        servico_id: servicoId,
        tipoOrigem: 'TOTEM',
        prioridade: servico.prioridadePeso || 0,
      },
    });

    await this.notificacaoService.criar({
      titulo: 'Nova Senha',
      mensagem: `Senha ${senha.numeroDisplay} aguardando atendimento.`,
      icon: 'ticket',
      rota: '/admin/dashboard',
      servico_id: servicoId,
    });

    return senha;
  }

  public async executeTransition(
    senhaId: number,
    targetStatus: string,
    operadorId?: number | null,
    guicheId?: number | null,
    txOverride?: any,
  ) {
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      'AGUARDANDO': ['CHAMADO', 'CANCELADO'],
      'CHAMADO': ['EM_ATENDIMENTO', 'NAO_COMPARECEU', 'AGUARDANDO'],
      'EM_ATENDIMENTO': ['FINALIZADO', 'CANCELADO', 'NAO_COMPARECEU'],
      'NAO_COMPARECEU': ['AGUARDANDO'],
      'FINALIZADO': [],
      'CANCELADO': []
    };

    const prismaClient = txOverride || this.prisma;

    const senha = await prismaClient.senha.findUnique({
      where: { id: senhaId },
      include: { filial: true, servico: true, agendamento: true },
    });

    if (!senha) {
      throw new NotFoundException('Senha nao encontrada.');
    }

    const currentStatus = senha.status.toUpperCase();
    const desiredStatus = targetStatus.toUpperCase();

    if (currentStatus === desiredStatus) {
      if (desiredStatus === 'EM_ATENDIMENTO') {
        const openAtd = await prismaClient.atendimento.findFirst({
          where: { senha_id: senhaId, fimAtendimento: null },
          orderBy: { id: 'desc' },
        });
        if (openAtd && openAtd.guiche === guicheId && openAtd.operadorId === operadorId) {
          return senha;
        }
        throw new BadRequestException('Atendimento ja esta em andamento com outro operador/guiche.');
      }
      if (desiredStatus === 'CHAMADO') {
        if (!guicheId) {
          throw new BadRequestException('Guiche e obrigatorio para confirmar chamada.');
        }
        const openAtd = await prismaClient.atendimento.findFirst({
          where: { senha_id: senhaId, fimAtendimento: null },
          orderBy: { id: 'desc' },
        });
        if (openAtd && openAtd.guiche === guicheId && (!operadorId || openAtd.operadorId === operadorId)) {
          return senha;
        }
        throw new BadRequestException('Senha ja foi chamada por outro guiche.');
      }
      return senha;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(desiredStatus)) {
      throw new BadRequestException(
        `Transicao invalida de ${currentStatus} para ${desiredStatus}`,
      );
    }

    if (desiredStatus === 'CHAMADO') {
      if (!guicheId) {
        throw new BadRequestException('Guiche e obrigatorio para chamar.');
      }
      const existingActive = await prismaClient.atendimento.findFirst({
        where: {
          guiche: guicheId,
          fimAtendimento: null,
          senha: { status: { in: ['CHAMADO', 'EM_ATENDIMENTO'] } },
        },
      });
      if (existingActive) {
        throw new BadRequestException(
          `Guiche ja possui atendimento ativo (Senha ${existingActive.senha_id}).`,
        );
      }

      // Cap recalls to a maximum of 3 attempts based on existing atendimento record counts
      const countAtendimentos = await prismaClient.atendimento.count({
        where: { senha_id: senhaId },
      });
      if (countAtendimentos >= 3) {
        throw new BadRequestException('Esta senha já atingiu o limite máximo de 3 chamadas.');
      }
    }

    const affected = await prismaClient.senha.updateMany({
      where: {
        id: senhaId,
        status: currentStatus,
      },
      data: {
        status: desiredStatus,
      },
    });

    if (affected.count === 0) {
      throw new BadRequestException(
        `A senha já foi alterada por outro processo (esperado: ${currentStatus}).`,
      );
    }

    const updatedSenha = await prismaClient.senha.findUnique({
      where: { id: senhaId },
      include: { agendamento: true, servico: true, cliente: true },
    });

    if (!updatedSenha) {
      throw new NotFoundException('Senha não encontrada após a atualização.');
    }

    if (desiredStatus === 'CHAMADO') {
      await prismaClient.atendimento.create({
        data: {
          guiche: guicheId,
          senha_id: senhaId,
          ...(operadorId
            ? {
              operadorId: operadorId,
              operadorOrigemId: operadorId,
            }
            : {}),
        },
      });

      await prismaClient.guiche.update({
        where: { id: guicheId },
        data: { atendimentoAtualCodigo: updatedSenha.numeroDisplay },
      });
    }

    if (desiredStatus === 'EM_ATENDIMENTO') {
      const openAtd = await prismaClient.atendimento.findFirst({
        where: { senha_id: senhaId, fimAtendimento: null },
        orderBy: { id: 'desc' },
      });
      if (openAtd) {
        await prismaClient.atendimento.update({
          where: { id: openAtd.id },
          data: { inicioAtendimento: new Date() },
        });
      }
    }

    if (desiredStatus === 'FINALIZADO') {
      if (updatedSenha.agendamento_id) {
        await prismaClient.agendamento.update({
          where: { id: updatedSenha.agendamento_id },
          data: { status: 'REALIZADO' },
        });
      }
      const openAtds = await prismaClient.atendimento.findMany({
        where: { senha_id: senhaId, fimAtendimento: null },
        select: { id: true, guiche: true },
      });
      if (openAtds.length > 0) {
        await prismaClient.atendimento.updateMany({
          where: { id: { in: openAtds.map((a) => a.id) } },
          data: { fimAtendimento: new Date() },
        });
        const guicheIds = openAtds.map((a) => a.guiche).filter((id) => id !== null) as number[];
        if (guicheIds.length > 0) {
          await prismaClient.guiche.updateMany({
            where: { id: { in: guicheIds } },
            data: { atendimentoAtualCodigo: null },
          });
        }
      }
    }

    if (desiredStatus === 'CANCELADO') {
      if (updatedSenha.agendamento_id) {
        await prismaClient.agendamento.update({
          where: { id: updatedSenha.agendamento_id },
          data: { status: 'CANCELADO' },
        });
      }
      const openAtds = await prismaClient.atendimento.findMany({
        where: { senha_id: senhaId, fimAtendimento: null },
        select: { id: true, guiche: true },
      });
      if (openAtds.length > 0) {
        await prismaClient.atendimento.updateMany({
          where: { id: { in: openAtds.map((a) => a.id) } },
          data: { fimAtendimento: new Date() },
        });
        const guicheIds = openAtds.map((a) => a.guiche).filter((id) => id !== null) as number[];
        if (guicheIds.length > 0) {
          await prismaClient.guiche.updateMany({
            where: { id: { in: guicheIds } },
            data: { atendimentoAtualCodigo: null },
          });
        }
      }
    }

    if (desiredStatus === 'NAO_COMPARECEU') {
      const redirectConfig = await prismaClient.configuracao.findFirst({
        where: { chave: 'redirecionarAusentes', filial_id: updatedSenha.filial_id },
      });

      if (redirectConfig?.valor === 'true') {
        const redirectedSenha = await prismaClient.senha.update({
          where: { id: senhaId },
          data: { status: 'AGUARDANDO', dataCriacao: new Date() },
          include: { agendamento: true, servico: true, cliente: true },
        });

        const openAtds = await prismaClient.atendimento.findMany({
          where: { senha_id: senhaId, fimAtendimento: null },
          select: { id: true, guiche: true },
        });
        if (openAtds.length > 0) {
          await prismaClient.atendimento.updateMany({
            where: { id: { in: openAtds.map((a) => a.id) } },
            data: { fimAtendimento: new Date() },
          });
          const guicheIds = openAtds.map((a) => a.guiche).filter((id) => id !== null) as number[];
          if (guicheIds.length > 0) {
            await prismaClient.guiche.updateMany({
              where: { id: { in: guicheIds } },
              data: { atendimentoAtualCodigo: null },
            });
          }
        }

        await prismaClient.log_auditoria.create({
          data: {
            acao: 'TRANSICAO_STATUS',
            descricao: JSON.stringify({
              from: currentStatus,
              to: 'AGUARDANDO',
              senhaId: senhaId,
              guicheId: guicheId,
              operadorId: operadorId,
              motivo: 'redirecionarAusentes_ativo',
            }),
            usuario_id: operadorId || null,
            filial_id: updatedSenha.filial_id || null,
            entidade: 'senha',
            status: 'Sucesso',
          },
        });

        return redirectedSenha;
      } else {
        if (updatedSenha.agendamento_id) {
          await prismaClient.agendamento.update({
            where: { id: updatedSenha.agendamento_id },
            data: { status: 'NAO_COMPARECEU' },
          });
        }
        const openAtds = await prismaClient.atendimento.findMany({
          where: { senha_id: senhaId, fimAtendimento: null },
          select: { id: true, guiche: true },
        });
        if (openAtds.length > 0) {
          await prismaClient.atendimento.updateMany({
            where: { id: { in: openAtds.map((a) => a.id) } },
            data: { fimAtendimento: new Date() },
          });
          const guicheIds = openAtds.map((a) => a.guiche).filter((id) => id !== null) as number[];
          if (guicheIds.length > 0) {
            await prismaClient.guiche.updateMany({
              where: { id: { in: guicheIds } },
              data: { atendimentoAtualCodigo: null },
            });
          }
        }
      }
    }

    if (desiredStatus === 'AGUARDANDO') {
      const openAtds = await prismaClient.atendimento.findMany({
        where: { senha_id: senhaId, fimAtendimento: null },
        select: { id: true, guiche: true },
      });
      if (openAtds.length > 0) {
        await prismaClient.atendimento.updateMany({
          where: { id: { in: openAtds.map((a) => a.id) } },
          data: { fimAtendimento: new Date(), transferidoEm: new Date() },
        });
        const guicheIds = openAtds.map((a) => a.guiche).filter((id) => id !== null) as number[];
        if (guicheIds.length > 0) {
          await prismaClient.guiche.updateMany({
            where: { id: { in: guicheIds } },
            data: { atendimentoAtualCodigo: null },
          });
        }
      }
    }

    const openAtd = await prismaClient.atendimento.findFirst({
      where: { senha_id: senhaId, fimAtendimento: null },
      orderBy: { id: 'desc' },
    });

    if (openAtd && !['CHAMADO', 'EM_ATENDIMENTO'].includes(updatedSenha.status)) {
      throw new BadRequestException(
        'Invariante violada: atendimento ativo com status de senha invalido.',
      );
    }

    if (['CHAMADO', 'EM_ATENDIMENTO'].includes(updatedSenha.status) && !openAtd) {
      throw new BadRequestException(
        'Invariante violada: senha ativa sem atendimento associado.',
      );
    }

    await prismaClient.log_auditoria.create({
      data: {
        acao: 'TRANSICAO_STATUS',
        descricao: JSON.stringify({
          from: currentStatus,
          to: desiredStatus,
          senhaId: senhaId,
          guicheId: guicheId,
          operadorId: operadorId,
        }),
        usuario_id: operadorId || null,
        filial_id: updatedSenha.filial_id || null,
        entidade: 'senha',
        status: 'Sucesso',
      },
    });

    return updatedSenha;
  }

  async chamarProximo(guicheId: number, repetir = false) {
    const guicheInfo = await this.prisma.guiche.findUnique({
      where: { id: guicheId },
    });

    if (!guicheInfo) throw new NotFoundException('Guiche nao encontrado!');

    if (repetir) {
      return this.rechamarSenhaAtual(guicheId, guicheInfo.numero?.toString());
    }

    const ticketsAguardando = await this.prisma.senha.findMany({
      where: {
        status: 'AGUARDANDO',
        filial_id: guicheInfo.filial_id,
      },
      include: { servico: true, agendamento: true },
    });

    if (ticketsAguardando.length === 0) throw new NotFoundException('Fila vazia nesta filial!');

    const now = new Date();
    const queueEngine = new QueueEngine();
    const ticketsWithPriority = ticketsAguardando.map(ticket => {
      const effectivePriority = queueEngine.calculateSenhaScore(ticket, now.getTime());
      return {
        ticket,
        effectivePriority,
      };
    });

    ticketsWithPriority.sort((a, b) => {
      if (b.effectivePriority !== a.effectivePriority) {
        return b.effectivePriority - a.effectivePriority;
      }
      const timeA = new Date(a.ticket.dataCriacao).getTime();
      const timeB = new Date(b.ticket.dataCriacao).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.ticket.id - b.ticket.id;
    });

    let senhaAtualizada: any = null;

    for (const candidate of ticketsWithPriority) {
      try {
        senhaAtualizada = await this.prisma.$transaction(async (tx) => {
          return this.executeTransition(
            candidate.ticket.id,
            'CHAMADO',
            guicheInfo.operadorAtualId,
            guicheId,
            tx,
          );
        });
        break;
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('ja foi chamada por outro guiche') || msg.includes('Transicao invalida')) {
          continue;
        }
        throw err;
      }
    }

    if (!senhaAtualizada) {
      throw new NotFoundException('Fila vazia nesta filial!');
    }

    const proxima = senhaAtualizada;

    const tempoEsperaMs =
      new Date().getTime() - new Date(proxima.dataCriacao).getTime();
    const minutosEspera = Math.floor(tempoEsperaMs / 60000);

    if (minutosEspera > 20) {
      await this.notificacaoService.criar({
        titulo: 'Alerta de SLA',
        mensagem: `Senha ${proxima.numeroDisplay} aguardou por ${minutosEspera} minutos!`,
        icon: 'clock',
        rota: '/admin/dashboard',
      });
    }

    this.notificacaoGateway.broadcastTicket({
      ticketId: senhaAtualizada.numeroDisplay,
      category: senhaAtualizada.servico?.nome || 'Servico',
      guicheOrDoca: guicheInfo.numero.toString() || guicheId.toString(),
      calledAt: new Date(),
    });

    await this.notificarClientePorDocumento(senhaAtualizada.agendamento?.documento, {
      titulo: 'Senha chamada',
      mensagem: `Sua senha ${senhaAtualizada.numeroDisplay} foi chamada. Dirija-se ao guichê ${guicheInfo.numero}.`,
      icon: 'bell',
      iconClass: 'orange-icon',
      rota: '/client/meus-agendamentos',
    });
    await this.notificarProximoDaFila(guicheInfo.filial_id, senhaAtualizada.id);

    return senhaAtualizada;
  }

  private async rechamarSenhaAtual(guicheId: number, guicheNumero?: string) {
    const atendimentoAberto = await this.prisma.atendimento.findFirst({
      where: {
        guiche: guicheId,
        fimAtendimento: null,
        senha: {
          status: { in: ['CHAMADO', 'EM_ATENDIMENTO'] },
        },
      },
      orderBy: { id: 'desc' },
      include: {
        senha: { include: { agendamento: true, servico: true } },
      },
    });

    if (!atendimentoAberto?.senha) {
      throw new NotFoundException('Nenhuma senha ativa para rechamada neste guiche.');
    }

    const senhaAtual = atendimentoAberto.senha;

    this.notificacaoGateway.broadcastTicket({
      ticketId: senhaAtual.numeroDisplay,
      category: senhaAtual.servico?.nome || 'Servico',
      guicheOrDoca: guicheNumero || guicheId.toString(),
      calledAt: new Date(),
    });

    return senhaAtual;
  }

  private async encerrarAtendimentoAbertoPorSenha(senhaId: number) {
    const atendimentosAbertos = await this.prisma.atendimento.findMany({
      where: { senha_id: senhaId, fimAtendimento: null },
      select: { id: true, guiche: true },
    });

    if (atendimentosAbertos.length > 0) {
      await this.prisma.atendimento.updateMany({
        where: { id: { in: atendimentosAbertos.map(a => a.id) } },
        data: { fimAtendimento: new Date() },
      });

      const guichesIds = atendimentosAbertos
        .map(a => a.guiche)
        .filter(id => id !== null) as number[];

      if (guichesIds.length > 0) {
        await this.prisma.guiche.updateMany({
          where: { id: { in: guichesIds } },
          data: { atendimentoAtualCodigo: null },
        });
      }
    }
  }

  async chamarEspecifico(guicheId: number, senhaId: number) {
    const guicheInfo = await this.prisma.guiche.findUnique({
      where: { id: guicheId },
    });
    if (!guicheInfo) throw new NotFoundException('Guiche nao encontrado!');

    const senha = await this.prisma.senha.findUnique({
      where: { id: senhaId },
    });
    if (!senha) throw new NotFoundException('Senha não encontrada!');

    const senhaAtualizada = await this.prisma.$transaction(async (tx) => {
      return this.executeTransition(senhaId, 'CHAMADO', guicheInfo.operadorAtualId, guicheId, tx);
    });

    this.notificacaoGateway.broadcastTicket({
      ticketId: senhaAtualizada.numeroDisplay,
      category: senhaAtualizada.servico?.nome || 'Servico',
      guicheOrDoca: guicheInfo.numero.toString(),
      calledAt: new Date(),
    });

    await this.notificarClientePorDocumento(senhaAtualizada.agendamento?.documento, {
      titulo: 'Senha chamada',
      mensagem: `Sua senha ${senhaAtualizada.numeroDisplay} foi chamada. Dirija-se ao guichê ${guicheInfo.numero}.`,
      icon: 'bell',
      iconClass: 'orange-icon',
      rota: '/client/meus-agendamentos',
    });
    await this.notificarProximoDaFila(guicheInfo.filial_id, senhaAtualizada.id);

    return senhaAtualizada;
  }

  async cancelarSenha(senhaId: number) {
    const senha = await this.prisma.$transaction(async (tx) => {
      return this.executeTransition(senhaId, 'CANCELADO', null, null, tx);
    });
    this.notificacaoGateway.broadcastRefresh();
    return senha;
  }

  async iniciarAtendimento(senhaId: number) {
    const atendimentoAberto = await this.prisma.atendimento.findFirst({
      where: { senha_id: senhaId, fimAtendimento: null },
      orderBy: { id: 'desc' },
    });

    const atualizado = await this.prisma.$transaction(async (tx) => {
      return this.executeTransition(
        senhaId,
        'EM_ATENDIMENTO',
        atendimentoAberto?.operadorId ?? null,
        atendimentoAberto?.guiche ?? null,
        tx,
      );
    });
    this.notificacaoGateway.broadcastRefresh();
    return atualizado;
  }

  async finalizarAtendimento(senhaId: number) {
    const senha = await this.prisma.$transaction(async (tx) => {
      return this.executeTransition(senhaId, 'FINALIZADO', null, null, tx);
    });

    this.notificacaoGateway.broadcastRefresh();

    if (senha.agendamento?.documento) {
      await this.notificarClientePorDocumento(senha.agendamento.documento, {
        titulo: 'Atendimento concluído',
        mensagem: `O atendimento da senha ${senha.numeroDisplay} foi concluído.`,
        icon: 'checkCircle',
        iconClass: 'blue-icon',
        rota: '/client/meus-agendamentos',
      });
    }

    return senha;
  }

  async vincularCliente(senhaId: number, nome: string, documento?: string, clienteId?: string) {
    const senha = await this.prisma.senha.findUnique({
      where: { id: senhaId }
    });

    if (!senha) throw new NotFoundException('Senha não encontrada');

    return this.prisma.senha.update({
      where: { id: senhaId },
      data: {
        nomeCliente: nome,
        documentoCliente: documento,
        cliente_id: clienteId || null
      },
    });
  }

  async atualizarGarrafoes(senhaId: number, qtdeGarrafoes: number) {
    const senha = await this.prisma.senha.findUnique({
      where: { id: senhaId }
    });

    if (!senha) throw new NotFoundException('Senha não encontrada');

    return this.prisma.senha.update({
      where: { id: senhaId },
      data: {
        qtdeGarrafoes: Math.max(0, qtdeGarrafoes)
      },
    });
  }

  async naoCompareceu(senhaId: number) {
    const senha = await this.prisma.$transaction(async (tx) => {
      return this.executeTransition(senhaId, 'NAO_COMPARECEU', null, null, tx);
    });

    this.notificacaoGateway.broadcastRefresh();

    if (senha.status === 'NAO_COMPARECEU') {
      if (senha.agendamento?.documento) {
        await this.notificarClientePorDocumento(senha.agendamento.documento, {
          titulo: 'Não comparecimento registrado',
          mensagem: `Sua senha ${senha.numeroDisplay} foi encerrada por não comparecimento.`,
          icon: 'xCircle',
          iconClass: 'gray-icon',
          rota: '/client/meus-agendamentos',
        });
      }
    }

    return senha;
  }

  async transferirAtendimento(
    senhaId: number,
    guicheDestinoId: number | null,
    retornarFila: boolean,
    authUser?: AuthenticatedUser,
  ) {
    if (!authUser?.userId) {
      throw new BadRequestException('Operador invalido para transferencia.');
    }

    const atendimento = await this.prisma.atendimento.findFirst({
      where: { senha_id: senhaId, fimAtendimento: null },
      orderBy: { id: 'desc' },
      include: {
        senha: true,
        guiche_rel: true,
      },
    });

    if (!atendimento || !atendimento.senha) {
      throw new NotFoundException('Atendimento nao encontrado para esta senha.');
    }

    if (atendimento.senha.status !== 'CHAMADO') {
      throw new BadRequestException('Transferencia permitida apenas antes de iniciar o atendimento.');
    }

    const operadorAtualId =
      atendimento.operadorId || atendimento.guiche_rel?.operadorAtualId || null;

    if (operadorAtualId && operadorAtualId !== authUser.userId) {
      throw new BadRequestException('Somente o operador atual pode transferir este atendimento.');
    }

    if (retornarFila) {
      await this.prisma.$transaction(async (tx) => {
        await this.executeTransition(senhaId, 'AGUARDANDO', authUser.userId, null, tx);
      });

      this.notificacaoGateway.broadcastRefresh();
      return { status: 'AGUARDANDO' };
    }

    if (!guicheDestinoId) {
      throw new BadRequestException('Guiche de destino obrigatorio.');
    }

    const guicheDestino = await this.prisma.guiche.findUnique({
      where: { id: guicheDestinoId },
    });

    if (!guicheDestino) {
      throw new NotFoundException('Guiche de destino nao encontrado.');
    }

    if (!guicheDestino.operadorAtualId) {
      throw new BadRequestException('Guiche de destino sem operador logado.');
    }

    const destinoOcupado = await this.prisma.atendimento.findFirst({
      where: {
        guiche: guicheDestinoId,
        fimAtendimento: null,
        senha: { status: { in: ['CHAMADO', 'EM_ATENDIMENTO'] } },
      },
    });

    if (destinoOcupado) {
      throw new BadRequestException('Guiche de destino ja possui atendimento ativo.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.atendimento.update({
        where: { id: atendimento.id },
        data: {
          guiche: guicheDestinoId,
          operadorId: guicheDestino.operadorAtualId,
          operadorOrigemId: atendimento.operadorOrigemId || authUser.userId,
          transferidoEm: new Date(),
        },
      });
      await tx.guiche.update({
        where: { id: atendimento.guiche },
        data: { atendimentoAtualCodigo: null },
      });
      await tx.guiche.update({
        where: { id: guicheDestinoId },
        data: { atendimentoAtualCodigo: atendimento.senha?.numeroDisplay ?? null },
      });
      await tx.log_auditoria.create({
        data: {
          acao: 'TRANSFERENCIA_ATENDIMENTO',
          descricao: JSON.stringify({
            senhaId: senhaId,
            guicheOrigemId: atendimento.guiche,
            guicheDestinoId: guicheDestinoId,
            operadorId: authUser.userId,
          }),
          usuario_id: authUser.userId,
          filial_id: guicheDestino.filial_id,
          entidade: 'senha',
          status: 'Sucesso',
        },
      });
    });

    this.notificacaoGateway.broadcastRefresh();

    return {
      status: 'TRANSFERIDO',
      guicheDestinoId,
    };
  }

  async listarAtendimentosOperador(
    operadorId: number,
    filialId?: number,
    dataStr?: string,
  ) {
    const where: any = {
      operadorId: operadorId,
    };
    if (filialId) {
      where.guiche_rel = { filial_id: filialId };
    }

    // Filtro por data
    if (dataStr) {
      const dataInicio = new Date(`${dataStr}T00:00:00.000`);
      const dataFim = new Date(`${dataStr}T23:59:59.999`);
      where.inicioAtendimento = {
        gte: dataInicio,
        lte: dataFim,
      };
    } else {
      // Se não enviou data, mostra os de hoje por padrão
      const hoje = new Date();
      const timezoneOffset = hoje.getTimezoneOffset() * 60000;
      const localHoje = new Date(hoje.getTime() - timezoneOffset);
      const hojeStr = localHoje.toISOString().split('T')[0];

      const dataInicio = new Date(`${hojeStr}T00:00:00.000`);
      const dataFim = new Date(`${hojeStr}T23:59:59.999`);
      where.inicioAtendimento = {
        gte: dataInicio,
        lte: dataFim,
      };
    }

    const atendimentos = await this.prisma.atendimento.findMany({
      where,
      orderBy: { inicioAtendimento: 'desc' },
      include: {
        senha: { include: { servico: true, agendamento: true } },
        guiche_rel: true,
        operador: { select: { id: true, nome: true, login: true } },
      },
    });

    return atendimentos.map((a) => {
      const agendamentoStatusRaw = (a.senha?.agendamento?.status || '').toUpperCase();
      const statusRaw = agendamentoStatusRaw === 'NAO_COMPARECEU'
        ? 'NAO_COMPARECEU'
        : (a.senha?.status || '').toUpperCase();
      const foiTransferido = Boolean(a.transferidoEm);

      let status = statusRaw || 'DESCONHECIDO';
      if (statusRaw === 'CANCELADO') status = 'Cancelado';
      else if (statusRaw === 'FINALIZADO') status = 'Finalizado';
      else if (foiTransferido) status = 'Transferido';
      else if (statusRaw === 'NAO_COMPARECEU') status = 'Não Compareceu';
      else if (statusRaw === 'EM_ATENDIMENTO') status = 'Em Atendimento';
      else if (statusRaw === 'CHAMADO') status = 'Em Atendimento';

      const inicio = a.inicioAtendimento ? new Date(a.inicioAtendimento).getTime() : null;
      const criacao = a.senha?.dataCriacao ? new Date(a.senha.dataCriacao).getTime() : null;

      let tempoEspera = '-';
      let tempoEsperaMin = 0;
      if (inicio && criacao) {
        const diffMs = Math.max(0, inicio - criacao);
        if (diffMs < 60000) {
          const diffSeg = Math.floor(diffMs / 1000);
          tempoEspera = `${diffSeg} seg`;
        } else {
          tempoEsperaMin = Math.floor(diffMs / 60000);
          tempoEspera = `${tempoEsperaMin} min`;
        }
      }

      return {
        id: a.id,
        senhaId: a.senha?.id || null,
        agendamentoId: a.senha?.agendamento?.id || null,
        ticket: a.senha?.numeroDisplay || 'S/N',
        cliente: a.senha?.nomeCliente || a.senha?.agendamento?.nomeCliente || 'Geral/Totem',
        documento: a.senha?.documentoCliente || a.senha?.agendamento?.documento || null,
        categoria: a.senha?.servico?.nome || 'Geral',
        operador: a.operador?.nome || '-',
        operadorLogin: a.operador?.login || null,
        guiche: a.guiche_rel?.numero || null,
        tempoEspera,
        tempoEsperaMin,
        qtdeGarrafoes: a.senha?.qtdeGarrafoes ?? 0,
        status,
        statusRaw,
        inicioAtendimento: a.inicioAtendimento,
        fimAtendimento: a.fimAtendimento,
      };
    });
  }

  async listarAtendimentosSupervisor(
    filialId?: number,
    data?: string,
  ) {
    const where: any = {};
    if (filialId) {
      where.guiche_rel = { filial_id: filialId };
    }

    const targetDate = data ? data : new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${targetDate}T00:00:00`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999`);
    where.inicioAtendimento = {
      gte: startOfDay,
      lte: endOfDay,
    };

    const atendimentos = await this.prisma.atendimento.findMany({
      where,
      orderBy: { inicioAtendimento: 'desc' },
      include: {
        senha: { include: { servico: true, agendamento: true } },
        guiche_rel: true,
        operador: { select: { id: true, nome: true, login: true } },
      },
    });

    return atendimentos.map((a) => {
      const agendamentoStatusRaw = (a.senha?.agendamento?.status || '').toUpperCase();
      const statusRaw = agendamentoStatusRaw === 'NAO_COMPARECEU'
        ? 'NAO_COMPARECEU'
        : (a.senha?.status || '').toUpperCase();
      const foiTransferido = Boolean(a.transferidoEm);

      let status = statusRaw || 'DESCONHECIDO';
      if (statusRaw === 'CANCELADO') status = 'Cancelado';
      else if (statusRaw === 'FINALIZADO') status = 'Finalizado';
      else if (foiTransferido) status = 'Transferido';
      else if (statusRaw === 'NAO_COMPARECEU') status = 'Não Compareceu';
      else if (statusRaw === 'EM_ATENDIMENTO') status = 'Em Atendimento';
      else if (statusRaw === 'CHAMADO') status = 'Em Atendimento';

      const inicio = a.inicioAtendimento ? new Date(a.inicioAtendimento).getTime() : null;
      const criacao = a.senha?.dataCriacao ? new Date(a.senha.dataCriacao).getTime() : null;

      let tempoEspera = '-';
      let tempoEsperaMin = 0;
      if (inicio && criacao) {
        const diffMs = Math.max(0, inicio - criacao);
        if (diffMs < 60000) {
          const diffSeg = Math.floor(diffMs / 1000);
          tempoEspera = `${diffSeg} seg`;
        } else {
          tempoEsperaMin = Math.floor(diffMs / 60000);
          tempoEspera = `${tempoEsperaMin} min`;
        }
      }

      const fim = a.fimAtendimento ? new Date(a.fimAtendimento).getTime() : null;
      let tempoAtendimentoStr = '-';
      let tempoAtendimentoMin = 0;
      if (fim !== null && inicio !== null) {
        const diffMs = Math.max(0, fim - inicio);
        if (diffMs < 60000) {
          const diffSeg = Math.floor(diffMs / 1000);
          tempoAtendimentoStr = `${diffSeg} seg`;
        } else {
          tempoAtendimentoMin = Math.floor(diffMs / 60000);
          tempoAtendimentoStr = `${tempoAtendimentoMin} min`;
        }
      } else if (a.inicioAtendimento) {
        tempoAtendimentoStr = 'Em andamento';
      }

      return {
        id: a.id,
        senhaId: a.senha?.id || null,
        agendamentoId: a.senha?.agendamento?.id || null,
        ticket: a.senha?.numeroDisplay || 'S/N',
        cliente: a.senha?.nomeCliente || a.senha?.agendamento?.nomeCliente || 'Geral/Totem',
        documento: a.senha?.documentoCliente || a.senha?.agendamento?.documento || null,
        categoria: a.senha?.servico?.nome || 'Geral',
        operador: a.operador?.nome || '-',
        operadorLogin: a.operador?.login || null,
        guiche: a.guiche_rel?.numero || null,
        tempoEspera,
        tempoEsperaMin,
        tempoAtendimento: tempoAtendimentoStr,
        tempoAtendimentoMin,
        qtdeGarrafoes: a.senha?.qtdeGarrafoes ?? 0,
        status,
        statusRaw,
        inicioAtendimento: a.inicioAtendimento,
        fimAtendimento: a.fimAtendimento,
      };
    });
  }

  async listarProximas(guicheId: number) {
    const guicheInfo = await this.prisma.guiche.findUnique({
      where: { id: guicheId },
    });
    if (!guicheInfo) return [];

    return await this.prisma.senha.findMany({
      where: {
        status: 'AGUARDANDO',
        filial_id: guicheInfo.filial_id,
      },
      orderBy: [{ prioridade: 'desc' }, { id: 'asc' }],
      take: 5,
      include: { servico: true, agendamento: true },
    });
  }

  async buscarAtendimentoAtual(guicheId: number) {
    const atendimentoAtual = await this.prisma.atendimento.findFirst({
      where: {
        guiche: guicheId,
        fimAtendimento: null,
      },
      orderBy: { id: 'desc' },
      include: {
        senha: {
          include: { servico: true, agendamento: true, cliente: true },
        },
      },
    });

    if (!atendimentoAtual?.senha) return null;

    const statusRaw = (atendimentoAtual.senha.status || '').toUpperCase();
    const statusLabel =
      statusRaw === 'CHAMADO'
        ? 'Chamando'
        : statusRaw === 'EM_ATENDIMENTO'
          ? 'Em Atendimento'
          : statusRaw;

    return {
      id: atendimentoAtual.senha.id,
      numeroDisplay: atendimentoAtual.senha.numeroDisplay,
      status: atendimentoAtual.senha.status,
      qtdeGarrafoes: atendimentoAtual.senha.qtdeGarrafoes ?? 0,
      dataCriacao: atendimentoAtual.senha.dataCriacao,
      servico: atendimentoAtual.senha.servico,
      cliente: atendimentoAtual.senha.cliente,
      nomeCliente: atendimentoAtual.senha.nomeCliente,
      documentoCliente: atendimentoAtual.senha.documentoCliente,
      agendamento: atendimentoAtual.senha.agendamento,
      inicioAtendimento: atendimentoAtual.inicioAtendimento,
      uiState: {
        statusRaw,
        statusLabel,
        isChamando: statusRaw === 'CHAMADO',
        isAtendendo: statusRaw === 'EM_ATENDIMENTO',
      },
    };
  }

  async listarPainel(filialId?: number) {
    // Buscar os últimos 20 atendimentos para extrair senhas únicas recém-chamadas
    const where: any = {};
    if (filialId) {
      where.guiche_rel = { filial_id: filialId };
    }
    const recentes = await this.prisma.atendimento.findMany({
      where,
      orderBy: { inicioAtendimento: 'desc' },
      take: 20,
      include: {
        senha: {
          include: { servico: true }
        },
        guiche_rel: true
      }
    });

    const senhasUnicas: any[] = [];
    const seen = new Set();
    for (const atd of recentes) {
      if (atd.senha && !seen.has(atd.senha.id)) {
        seen.add(atd.senha.id);
        senhasUnicas.push(atd);
      }
      if (senhasUnicas.length === 5) break;
    }

    return senhasUnicas.map(atendimento => {
      const senha = atendimento.senha;
      const guicheRel = atendimento.guiche_rel;

      const limpo = String(guicheRel?.numero || guicheRel?.nome || '').trim();
      let tipo = 'GUICHÊ';
      let valor = limpo;

      if (limpo) {
        // Extrai possíveis prefixos para não duplicar e saber qual é
        const match = limpo.match(/^(Guich[êe]|Guiche|Baia|Doca|Mens[a|e]gem|Sala|Box)\s*(.*)$/i);
        if (match) {
          tipo = match[1].toUpperCase();
          if (tipo === 'GUICHE') tipo = 'GUICHÊ'; // Normaliza acentuação
          valor = match[2].trim() || '--';
        }
      } else {
        valor = '--';
      }

      // Se o valor ficar vazio após remover o prefixo, usamos o limpo inteiro (fallback)
      if (!valor) valor = limpo;

      return {
        id: senha.id,
        numero: senha.numeroDisplay,
        senha: senha.numeroDisplay,
        categoria: senha.servico?.nome || 'Servico',
        servico: senha.servico,
        guiche: valor !== '--' ? `${tipo} ${valor}` : '--',
        guicheNumero: valor !== '--' ? `${tipo} ${valor}` : '--',
        dataCriacao: senha.dataCriacao,
      };
    });
  }

  async avaliarAtendimento(numero: string, nota: number) {
    return { status: 'ok', notaRecebida: nota };
  }

  async consultarPosicao(id: number) {
    const senha = await this.prisma.senha.findUnique({
      where: { id },
      include: { servico: true },
    });

    if (!senha) throw new NotFoundException();
    if (senha.status !== 'AGUARDANDO') {
      return { ...senha, posicao: 0, estimativa: 0 };
    }

    const naFrente = await this.prisma.senha.count({
      where: {
        servico_id: senha.servico_id,
        status: 'AGUARDANDO',
        id: { lt: senha.id },
      },
    });

    return { ...senha, posicao: naFrente + 1, estimativa: (naFrente + 1) * 5 };
  }

  async justificarDemora(
    id: number,
    dados: { justificativaDemora: string; motivoDemora: string },
  ) {
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id },
    });
    if (!atendimento) throw new NotFoundException('Atendimento nao encontrado');

    return await this.prisma.atendimento.update({
      where: { id },
      data: {
        justificativaDemora: dados.justificativaDemora,
        motivoDemora: dados.motivoDemora,
      },
    });
  }

  async getDashboardData() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const fila = await this.prisma.senha.count({
      where: { status: 'AGUARDANDO' },
    });
    const atendidos = await this.prisma.atendimento.count({
      where: { inicioAtendimento: { gt: hoje } },
    });

    return { fila, atendidos, tempo: 12, graficoFluxo: [] };
  }

  public async getHistorico(salaDesc: string) {
    return await this.prisma.atendimento.findMany({
      take: 10,
      orderBy: { inicioAtendimento: 'desc' },
      include: {
        senha: {
          select: {
            numeroDisplay: true,
            servico: { select: { nome: true } },
          },
        },
        guiche_rel: { select: { numero: true, nome: true } },
      },
    });
  }

  private obterCodigoCategoria(prefixo?: string | null, sigla?: string | null): string {
    const base = (prefixo?.trim() || sigla?.trim() || 'XX').toUpperCase();
    const codigo = base.replace(/[^A-Z0-9]/g, '');
    return codigo || 'XX';
  }

  private normalizarCodigoCheckin(codigoRaw: string): string {
    const normalizado = String(codigoRaw || '').trim().toUpperCase();
    if (!normalizado) return '';
    return normalizado.startsWith('#')
      ? normalizado.substring(1)
      : normalizado;
  }

  private async buscarAgendamentoPorCodigoCheckin(codigoNormalizado: string) {
    if (codigoNormalizado.startsWith('AGENDAMENTO:')) {
      const id = Number(codigoNormalizado.replace('AGENDAMENTO:', '').trim());
      if (Number.isFinite(id) && id > 0) {
        return this.prisma.agendamento.findUnique({
          where: { id },
          include: { servico: true },
        });
      }
    }

    return this.prisma.agendamento.findFirst({
      where: {
        OR: [
          { codigo: codigoNormalizado },
          { codigo: codigoNormalizado.toLowerCase() },
          { codigo: codigoNormalizado.toUpperCase() },
        ],
      },
      include: { servico: true },
    });
  }

  private async notificarClientePorDocumento(
    documento: string | null | undefined,
    dados: {
      titulo: string;
      mensagem: string;
      rota?: string;
      icon?: string;
      iconClass?: string;
    },
  ) {
    const documentoNormalizado = documento?.trim();
    if (!documentoNormalizado) return;

    const cliente = await this.prisma.clientes.findFirst({
      where: {
        OR: [
          { email: documentoNormalizado },
          { cpf: documentoNormalizado },
          { cnpj: documentoNormalizado },
        ],
      },
      select: { id: true },
    });

    if (!cliente) return;

    await this.notificacaoService.criar({
      ...dados,
      cliente_id: cliente.id,
    });
  }

  private async notificarProximoDaFila(filialId?: number | null, senhaChamadaId?: number) {
    if (!filialId) return;

    const proxima = await this.prisma.senha.findFirst({
      where: {
        status: 'AGUARDANDO',
        filial_id: filialId,
        id: senhaChamadaId ? { not: senhaChamadaId } : undefined,
        agendamento_id: { not: null },
      },
      orderBy: [{ prioridade: 'desc' }, { id: 'asc' }],
      include: { agendamento: true },
    });

    if (!proxima?.agendamento?.documento) return;

    await this.notificarClientePorDocumento(proxima.agendamento.documento, {
      titulo: 'Sua vez está se aproximando',
      mensagem: `A senha ${proxima.numeroDisplay} está próxima de ser chamada. Fique atento ao painel.`,
      icon: 'clock',
      iconClass: 'blue-icon',
      rota: '/client/meus-agendamentos',
    });
  }

  private async buscarServicoValidoParaTotem(params: {
    categoriaId?: number;
    nomeCategoria?: string;
    filialId?: number | null;
  }) {
    const { categoriaId, nomeCategoria, filialId } = params;
    const whereBase = { deletadoEm: null, ativo: true };

    if (categoriaId) {
      const servicoPorId = await this.prisma.servico.findFirst({
        where: {
          ...whereBase,
          id: +categoriaId,
          ...(filialId !== null
            ? { OR: [{ filial_id: filialId }, { filial_id: null }] }
            : {}),
        },
      });
      if (servicoPorId) return servicoPorId;
    }

    if (!nomeCategoria) return null;

    const candidatos = await this.prisma.servico.findMany({
      where: {
        ...whereBase,
        nome: nomeCategoria,
        ...(filialId !== null
          ? { OR: [{ filial_id: filialId }, { filial_id: null }] }
          : {}),
      },
      orderBy: { id: 'asc' },
    });

    if (!candidatos.length) return null;
    if (filialId !== null) {
      return (
        candidatos.find((s) => s.filial_id === filialId) ||
        candidatos.find((s) => s.filial_id === null) ||
        candidatos[0]
      );
    }

    return candidatos[0];
  }
}
