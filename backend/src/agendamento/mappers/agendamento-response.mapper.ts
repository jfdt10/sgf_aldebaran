import { AgendamentoResponseDto } from '../dto/agendamento-response.dto';
import {
  AGENDAMENTO_STATUS_ATIVOS,
  AgendamentoStatus,
} from '../enums/agendamento-status.enum';

export interface AgendamentoListItemSource {
  id: number;
  data: string;
  hora: string;
  status: string;
  filial_id?: number | null;
  servico_id?: number;
  servico?: {
    nome: string | null;
  } | null;
  filial?: {
    nome: string | null;
  } | null;
  senha?: {
    id: number;
    numeroDisplay: string;
    status: string;
    servico_id: number;
  }[];
}

export interface AgendamentoPresentationState {
  now: Date;
}

export function toAgendamentoResponse(
  agendamento: AgendamentoListItemSource,
  state: AgendamentoPresentationState,
): AgendamentoResponseDto {
  const inicio = buildAgendamentoDate(agendamento.data, agendamento.hora);
  const statusNormalizado = normalizeStatus(
    agendamento.status,
    inicio,
    state.now,
    agendamento.status === AgendamentoStatus.CHECKIN_REALIZADO ||
      agendamento.status === AgendamentoStatus.REALIZADO,
  );

  return {
    id: agendamento.id,
    categoriaNome: agendamento.servico?.nome?.trim() || 'Categoria não informada',
    filialNome: agendamento.filial?.nome?.trim() || 'Filial não informada',
    data: agendamento.data,
    horaInicio: normalizeTime(agendamento.hora),
    horaFim: addMinutes(agendamento.hora, 30),
    status: statusNormalizado,
    podeCancelar: false,
    podeReagendar: true,
    senha: agendamento.senha?.[0]?.numeroDisplay || null,
    senhaStatus: agendamento.senha?.[0]?.status || null,
    posicao: null,
    estimativa: null,
    filialId: agendamento.filial_id,
    servicoId: agendamento.servico_id,
  };
}

export function buildAgendamentoDate(data: string, hora: string, timezone: string = 'America/Sao_Paulo'): Date {
  if (timezone.match(/^[+-]\d{2}:\d{2}$/)) {
    return new Date(`${data}T${normalizeTime(hora)}:00${timezone}`);
  }

  try {
    const tempDate = new Date(`${data}T${normalizeTime(hora)}:00Z`);
    const formatterUTC = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    });
    const formatterTZ = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    });

    const parseParts = (parts: Intl.DateTimeFormatPart[]) => {
      const map = new Map(parts.map(p => [p.type, p.value]));
      return new Date(Date.UTC(
        parseInt(map.get('year')!, 10),
        parseInt(map.get('month')!, 10) - 1,
        parseInt(map.get('day')!, 10),
        parseInt(map.get('hour')!, 10),
        parseInt(map.get('minute')!, 10),
        parseInt(map.get('second')!, 10)
      ));
    };

    const utcDate = parseParts(formatterUTC.formatToParts(tempDate));
    const tzDate = parseParts(formatterTZ.formatToParts(tempDate));
    const offset = utcDate.getTime() - tzDate.getTime();

    return new Date(tempDate.getTime() + offset);
  } catch (e) {
    return new Date(`${data}T${normalizeTime(hora)}:00-03:00`);
  }
}

export function normalizeTime(hora: string): string {
  return hora.length >= 5 ? hora.slice(0, 5) : hora;
}

export function addMinutes(hora: string, minutesToAdd: number): string {
  const [hourRaw, minuteRaw] = normalizeTime(hora).split(':').map(Number);
  const totalMinutes = hourRaw * 60 + minuteRaw + minutesToAdd;
  const minutesInDay = 24 * 60;
  const normalizedMinutes =
    ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const finalHour = Math.floor(normalizedMinutes / 60)
    .toString()
    .padStart(2, '0');
  const finalMinute = (normalizedMinutes % 60).toString().padStart(2, '0');
  return `${finalHour}:${finalMinute}`;
}

function normalizeStatus(
  rawStatus: string,
  inicio: Date,
  now: Date,
  hasCheckIn: boolean,
): string {
  if (
    rawStatus === AgendamentoStatus.REALIZADO ||
    rawStatus === AgendamentoStatus.FINALIZADO ||
    rawStatus === AgendamentoStatus.CONCLUIDO
  ) {
    return AgendamentoStatus.CONCLUIDO;
  }

  if (rawStatus === AgendamentoStatus.NAO_COMPARECEU) {
    return AgendamentoStatus.NAO_COMPARECEU;
  }

  if (
    hasCheckIn ||
    rawStatus === AgendamentoStatus.CHECKIN_REALIZADO
  ) {
    return AgendamentoStatus.CHECKIN_REALIZADO;
  }

  if (
    AGENDAMENTO_STATUS_ATIVOS.has(rawStatus) &&
    now.getTime() > inicio.getTime() + 15 * 60 * 1000
  ) {
    return AgendamentoStatus.EXPIRADO;
  }

  return rawStatus;
}
