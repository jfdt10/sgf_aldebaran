import { QueueEngine } from './queue.engine';

describe('QueueEngine', () => {
  const engine = new QueueEngine();
  const now = new Date('2026-05-25T10:00:00').getTime();

  const senhaBase = {
    dataCriacao: new Date('2026-05-25T09:59:00'),
    tipo: 'Convencional',
    tipoOrigem: 'TOTEM',
    prioridade: 0,
    servico: { prioridadePeso: 1, tipo: null },
    agendamento: null,
  };

  it('prioriza agendamento proximo acima de preferencial comum', () => {
    const agendamentoProximo = {
      ...senhaBase,
      tipoOrigem: 'AGENDAMENTO',
      agendamento: { data: '2026-05-25', hora: '10:04' },
    };
    const preferencial = {
      ...senhaBase,
      tipo: 'Preferencial',
      agendamento: null,
    };

    expect(engine.calculateSenhaScore(agendamentoProximo, now)).toBeGreaterThan(
      engine.calculateSenhaScore(preferencial, now),
    );
  });

  it('prioriza senha preferencial acima de convencional equivalente', () => {
    const preferencial = { ...senhaBase, tipo: 'Preferencial' };
    const convencional = { ...senhaBase };

    expect(engine.calculateSenhaScore(preferencial, now)).toBeGreaterThan(
      engine.calculateSenhaScore(convencional, now),
    );
  });

  it('aplica fast-track para servico CLIENTE_RAPIDO', () => {
    const fastTrack = {
      ...senhaBase,
      servico: { prioridadePeso: 1, tipo: 'CLIENTE_RAPIDO' },
    };
    const normal = {
      ...senhaBase,
      servico: { prioridadePeso: 1, tipo: 'RETIRADA_PESADA' },
    };

    expect(engine.calculateSenhaScore(fastTrack, now)).toBe(
      engine.calculateSenhaScore(normal, now) + 1000,
    );
  });

  it('permite que aging eleve senha convencional antiga', () => {
    const antiga = {
      ...senhaBase,
      dataCriacao: new Date('2026-05-25T09:20:00'),
    };
    const preferencialNova = {
      ...senhaBase,
      tipo: 'Preferencial',
      dataCriacao: new Date('2026-05-25T09:59:00'),
    };

    expect(engine.calculateSenhaScore(antiga, now)).toBeGreaterThan(
      engine.calculateSenhaScore(preferencialNova, now),
    );
  });
});
