import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FilaService } from '../fila/fila.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => FilaService)) private filaService: FilaService,
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const agora = new Date();
    const filiais = await this.prisma.filial.findMany({
      where: { ativo: true, deletadoEm: null },
    });

    for (const filial of filiais) {
      const configs = await this.prisma.configuracao.findMany({
        where: { filial_id: filial.id },
      });

      const timezone = configs.find(c => c.chave === 'FUSO_HORARIO')?.valor || 'America/Sao_Paulo';
      const horarioReset = configs.find(c => c.chave === 'HORARIO_RESET')?.valor || '00:00';
      const tempoToleranciaStr = configs.find(c => c.chave === 'tempoTolerancia')?.valor || '15';
      const tempoTolerancia = isNaN(Number(tempoToleranciaStr)) ? 15 : Number(tempoToleranciaStr);

      const localTime = this.getLocalTime(timezone);
      const localHourStr = localTime.getHours().toString().padStart(2, '0');
      const localMinStr = localTime.getMinutes().toString().padStart(2, '0');
      const localTimeStr = `${localHourStr}:${localMinStr}`;

      // Reset diario (exclui/cancela senhas pendentes com inatividade >= 30 min)
      if (localTimeStr === horarioReset) {
        this.logger.log(
          `[CronService] Iniciando reset diário para filial ${filial.nome} (${filial.id}) às ${horarioReset} no fuso ${timezone}...`,
        );

        const cutoffTime = new Date(agora.getTime() - 30 * 60000);

        const ticketsToClean = await this.prisma.senha.findMany({
          where: {
            filial_id: filial.id,
            status: { in: ['AGUARDANDO', 'CHAMADO'] },
          },
          include: {
            atendimento: {
              where: { fimAtendimento: null },
              orderBy: { id: 'desc' },
              take: 1,
            },
          },
        });

        for (const ticket of ticketsToClean) {
          const lastActivity =
            ticket.status === 'CHAMADO'
              ? (ticket.atendimento[0]?.inicioAtendimento || ticket.dataCriacao)
              : ticket.dataCriacao;

          if (new Date(lastActivity).getTime() >= cutoffTime.getTime()) {
            continue;
          }

          try {
            await this.filaService.cancelarSenha(ticket.id);
            this.logger.log(
              `[CronService] Ticket ${ticket.numeroDisplay} cancelado pelo reset diário (limpeza automática).`,
            );
          } catch (err) {
            this.logger.error(
              `[CronService] Falha ao limpar ticket ${ticket.numeroDisplay}:`,
              err,
            );
          }
        }
      }

      // Timeout de chamada excedida (CHAMADO -> NAO_COMPARECEU)
      const chamados = await this.prisma.senha.findMany({
        where: {
          filial_id: filial.id,
          status: 'CHAMADO',
        },
        include: {
          atendimento: {
            where: { fimAtendimento: null },
            orderBy: { id: 'desc' },
            take: 1,
          },
        },
      });

      for (const ticket of chamados) {
        const callingTime = ticket.atendimento[0]?.inicioAtendimento || ticket.dataCriacao;
        const diffMs = agora.getTime() - new Date(callingTime).getTime();
        const diffMinutes = diffMs / 60000;

        if (diffMinutes > tempoTolerancia) {
          this.logger.log(
            `[CronService] Ticket ${ticket.numeroDisplay} na filial ${filial.id} excedeu a tolerância de chamada (${tempoTolerancia} min).`,
          );
          try {
            await this.filaService.naoCompareceu(ticket.id);
          } catch (err) {
            this.logger.error(
              `[CronService] Falha ao marcar nao-comparecimento para ticket ${ticket.numeroDisplay}:`,
              err,
            );
          }
        }
      }
    }
  }

  private getLocalTime(timezone: string): Date {
    const now = new Date();
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const dateMap = new Map(parts.map(p => [p.type, p.value]));

      const year = parseInt(dateMap.get('year')!, 10);
      const month = parseInt(dateMap.get('month')!, 10) - 1;
      const day = parseInt(dateMap.get('day')!, 10);
      const hour = parseInt(dateMap.get('hour')!, 10);
      const minute = parseInt(dateMap.get('minute')!, 10);
      const second = parseInt(dateMap.get('second')!, 10);

      return new Date(year, month, day, hour, minute, second);
    } catch (e) {
      if (timezone.match(/^[+-]\d{2}:\d{2}$/)) {
        const sign = timezone.startsWith('+') ? 1 : -1;
        const [h, m] = timezone.slice(1).split(':').map(Number);
        const offsetMinutes = (h * 60 + m) * sign;
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        return new Date(utc + offsetMinutes * 60000);
      }
      return now;
    }
  }
}
