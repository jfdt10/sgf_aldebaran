type QueueSenha = {
  id?: number;
  tipo?: string | null;
  tipoOrigem?: string | null;
  prioridade?: number | null;
  dataCriacao: Date | string;
  servico?: {
    prioridadePeso?: number | null;
    tipo?: string | null;
  } | null;
  agendamento?: {
    data?: string | null;
    hora?: string | null;
  } | null;
};

export class QueueEngine {
  private readonly WEIGHT_SCHEDULE_CRITICAL = 10000;
  private readonly WEIGHT_PREFERENTIAL = 5000;
  private readonly WEIGHT_FAST_TRACK = 1000;
  private readonly AGING_FACTOR_PER_MINUTE = 150;

  public calculateSenhaScore(
    senha: QueueSenha,
    currentTimeMs: number = Date.now(),
  ): number {
    let score = 0;
    const createdAtMs = new Date(senha.dataCriacao).getTime();
    const minutesWaiting = Math.max(
      0,
      Math.floor((currentTimeMs - createdAtMs) / 60000),
    );

    if (senha.tipoOrigem === 'AGENDAMENTO') {
      const scheduledMs = this.getScheduledTimeMs(senha);
      const minutesToSchedule = Math.floor(
        (scheduledMs - currentTimeMs) / 60000,
      );

      if (!Number.isNaN(scheduledMs) && minutesToSchedule <= 5) {
        score += this.WEIGHT_SCHEDULE_CRITICAL;
      }
    }

    if (senha.tipo === 'Preferencial') {
      score += this.WEIGHT_PREFERENTIAL;
    }

    if (senha.servico?.tipo === 'CLIENTE_RAPIDO') {
      score += this.WEIGHT_FAST_TRACK;
    }

    score += this.getBasePriority(senha);
    score += minutesWaiting * this.AGING_FACTOR_PER_MINUTE;

    return score;
  }

  private getBasePriority(senha: QueueSenha): number {
    const senhaPriority = Number(senha.prioridade ?? 0);
    if (senhaPriority > 0) return senhaPriority;

    return Number(senha.servico?.prioridadePeso ?? 0) || 0;
  }

  private getScheduledTimeMs(senha: QueueSenha): number {
    const data = senha.agendamento?.data;
    const hora = senha.agendamento?.hora;

    if (!data || !hora) return Number.NaN;

    return new Date(`${data}T${hora}:00`).getTime();
  }
}
