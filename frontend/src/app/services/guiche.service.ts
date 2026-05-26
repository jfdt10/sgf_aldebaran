import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GuicheOperador {
  id: number;
  numero: string;
  ocupado: boolean;
  status: 'DISPONIVEL' | 'OCUPADO';
  operador: string | null;
  logado: string | null;
  codigoAtendimento: string | null;
  situacaoAtendimento?: 'CHAMANDO' | 'ATENDENDO' | null;
}

@Injectable({
  providedIn: 'root',
})
export class GuicheService {
  private readonly apiUrl = `${environment.apiUrl}/guiches`;
  private readonly dashboardApiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {
    this.refreshGuiches();
    this.iniciarTimer();
  }

  listOperatorGuiches(filialId?: number): Observable<GuicheOperador[]> {
    const params = filialId ? `?filialId=${filialId}` : '';
    return this.http
      .get<any[]>(`${this.apiUrl}/operador${params}`, {
        headers: this.authHeaders(),
      })
      .pipe(map((lista) => lista.map((item) => this.mapToOperadorGuiche(item))));
  }

  getCurrentOperatorGuiche(): Observable<GuicheOperador | null> {
    return this.http
      .get<any | null>(`${this.apiUrl}/operador/atual`, {
        headers: this.authHeaders(),
      })
      .pipe(map((item) => (item ? this.mapToOperadorGuiche(item) : null)));
  }

  private mapToOperadorGuiche(item: any): GuicheOperador {
    const statusTexto = (item?.status ?? '').toString().toUpperCase();
    const atendimentoAtual = Array.isArray(item?.atendimentos) ? item.atendimentos[0] : null;
    const ocupado =
      Boolean(item?.operadorAtualId) ||
      Boolean(atendimentoAtual) ||
      statusTexto === 'OCUPADO';
    const statusSenha = (atendimentoAtual?.senha?.status ?? '').toString().toUpperCase();
    const situacaoAtendimento =
      statusSenha === 'CHAMADO'
        ? 'CHAMANDO'
        : statusSenha === 'EM_ATENDIMENTO'
          ? 'ATENDENDO'
          : null;

    const logado = item?.loginOperadorEm
      ? new Date(item.loginOperadorEm).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      : null;

    const rawNumero = String(item?.numero ?? item?.nome ?? item?.id ?? '');
    const numeroSemPrefixo = rawNumero.replace(/^Guich[êe]\s*/i, '').trim();

    return {
      id: Number(item?.id),
      numero: numeroSemPrefixo,
      ocupado,
      status: ocupado ? 'OCUPADO' : 'DISPONIVEL',
      operador: item?.operadorAtual?.nome ?? null,
      logado,
      codigoAtendimento: situacaoAtendimento ? (atendimentoAtual?.senha?.numeroDisplay ?? item?.atendimentoAtualCodigo ?? null) : null,
      situacaoAtendimento,
    };
  }

  selectGuiche(guicheId: number): Observable<GuicheOperador> {
    return this.http.post<GuicheOperador>(
      `${this.apiUrl}/operador/selecionar`,
      { guicheId },
      { headers: this.authHeaders() },
    );
  }

  releaseCurrentGuiche(): Observable<{ message: string; guiche: { id: number; numero: number } | null }> {
    return this.http.post<{ message: string; guiche: { id: number; numero: number } | null }>(
      `${this.apiUrl}/operador/liberar`,
      {},
      { headers: this.authHeaders() },
    );
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  private guichesSubject = new BehaviorSubject<any[]>([]);

  guiches$ = this.guichesSubject.asObservable();
  private lastFilialId?: number;
  private mapGuicheData(g: any, correntes: any[]) {
    const displayLabel = g.nome || g.numero || String(g.id);
    let temOperador = Boolean(g.operadorAtualId);

    const atendimentos = Array.isArray(g.atendimentos) ? g.atendimentos : [];
    const atendimentoAtivo = atendimentos.length > 0 ? atendimentos[0] : null;
    const temAtendimentoAtivo = Boolean(atendimentoAtivo);
    if (temAtendimentoAtivo) temOperador = true;
    const statusSenha = (atendimentoAtivo?.senha?.status || '').toString().toUpperCase();

    let statusCorreto = 'vazio';
    let statusLabelCorreto = 'Vazio';

    if (temOperador) {
      if (temAtendimentoAtivo) {
        if (statusSenha === 'CHAMADO') {
          statusCorreto = 'chamando';
          statusLabelCorreto = 'Chamando';
        } else {
          statusCorreto = 'ocupado';
          statusLabelCorreto = 'Ocupado';
        }
      } else {
        statusCorreto = 'disponivel';
        statusLabelCorreto = 'Disponível';
      }
    }

    const m = correntes.find((c: any) => c.id === g.id);

    let tempoOcupado = 0;
    let tempoOcupadoFormatado = '00:00';
    let tempoOcupadoSegundos = 0;
    let progresso = 0;
    let atrasado = false;
    let startTime = null;
    let idleStartTime = null;

    if (statusCorreto === 'chamando') {
      tempoOcupadoFormatado = '00:00';
    } else if (temAtendimentoAtivo && atendimentoAtivo.inicioAtendimento && statusCorreto === 'ocupado') {
      startTime = new Date(atendimentoAtivo.inicioAtendimento).getTime();
      if (m && m.status === 'ocupado') {
        tempoOcupado = m.tempoOcupado;
        tempoOcupadoFormatado = m.tempoOcupadoFormatado;
        tempoOcupadoSegundos = m.tempoOcupadoSegundos;
        progresso = m.progresso;
        atrasado = m.atrasado;
      }
    } else if (statusCorreto === 'disponivel') {
      if (m && m.status === 'disponivel' && m.idleStartTime) {
        idleStartTime = m.idleStartTime;
        tempoOcupadoFormatado = m.tempoOcupadoFormatado || '00:00';
      } else {
        idleStartTime = Date.now();
      }
    }

    return {
      id: g.id,
      displayLabel,
      numero: g.numero,
      nome: g.nome,
      operadorAtualId: g.operadorAtualId ?? null,
      status: statusCorreto,
      statusLabel: statusLabelCorreto,
      operador: g.operadorAtual?.nome || null,
      ticket: atendimentoAtivo ? atendimentoAtivo.senha?.numeroDisplay : null,
      senhaId: atendimentoAtivo ? atendimentoAtivo.senha_id : null,
      placa: null,
      tempoOcupado,
      tempoOcupadoFormatado,
      tempoOcupadoSegundos,
      progresso,
      atrasado,
      startTime,
      idleStartTime
    };
  }

  carregarGuichesDaApi(filialId?: number) {
    this.lastFilialId = filialId;
    const params = filialId ? `?filialId=${filialId}` : '';
    this.http.get<any[]>(`${this.apiUrl}${params}`, { headers: this.authHeaders() }).subscribe({
      next: (guichesDb) => {
        const ativos = guichesDb.filter(g => g.ativo !== false);
        const correntes = this.guichesSubject.value;

        const mapped = ativos.map(g => this.mapGuicheData(g, correntes));

        mapped.sort((a, b) => {
          // Ordenar pelo nome configurado, mas tentar numericalmente primeiro
          const numA = parseInt(a.nome || a.numero, 10);
          const numB = parseInt(b.nome || b.numero, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return (a.displayLabel || '').localeCompare(b.displayLabel || '');
        });

        this.guichesSubject.next(mapped);
      },
      error: (err) => console.error('Erro ao carregar guichês:', err)
    });
  }

  private _tempoTolerancia: number = 15; // in minutos
  private timer: any;

  refreshGuiches(filialId?: number) {
    this.lastFilialId = filialId;
    const params = filialId ? `?filialId=${filialId}` : '';
    this.http.get<any[]>(`${this.apiUrl}${params}`, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        const ativos = data.filter(g => g.ativo !== false);
        const correntes = this.guichesSubject.value;
        const mapped = ativos.map(g => this.mapGuicheData(g, correntes));

        mapped.sort((a, b) => {
          const numA = parseInt(a.nome || a.numero, 10);
          const numB = parseInt(b.nome || b.numero, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return (a.displayLabel || '').localeCompare(b.displayLabel || '');
        });

        this.guichesSubject.next(mapped);
      },
      error: (err) => console.error('Erro ao buscar guichês:', err)
    });
  }

  get tempoTolerancia(): number {
    return this._tempoTolerancia;
  }

  set tempoTolerancia(valor: number) {
    this._tempoTolerancia = valor;
  }

  private iniciarTimer() {
    this.timer = setInterval(() => {
      // Sync with server every 10 seconds
      if (Math.floor(Date.now() / 1000) % 10 === 0) {
        this.refreshGuiches(this.lastFilialId);
      }

      // Smooth timer updates for the UI
      let needsUpdate = false;
      const guiches = this.guichesSubject.value.map(g => {
        if (g.status === 'ocupado' && g.startTime) {
          const now = new Date().getTime();
          const tempoDecorridoSegundos = Math.floor((now - g.startTime) / 1000);

          const minutos = Math.floor(tempoDecorridoSegundos / 60);
          const segundos = tempoDecorridoSegundos % 60;
          const tempoOcupadoFormatado = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

          const toleranciaSegundos = this._tempoTolerancia * 60;
          const progressoBruto = (tempoDecorridoSegundos / toleranciaSegundos) * 100;
          const atrasado = progressoBruto >= 100;
          const progresso = Math.min(progressoBruto, 100);

          if (g.tempoOcupadoFormatado !== tempoOcupadoFormatado || g.progresso !== progresso || g.atrasado !== atrasado) {
            needsUpdate = true;
          }
          return {
            ...g,
            tempoOcupado: minutos,
            tempoOcupadoSegundos: tempoDecorridoSegundos,
            tempoOcupadoFormatado,
            progresso,
            atrasado
          };
        } else if (g.status === 'disponivel' && g.idleStartTime) {
          const now = new Date().getTime();
          const tempoOciosoSegundos = Math.floor((now - g.idleStartTime) / 1000);

          const minutos = Math.floor(tempoOciosoSegundos / 60);
          const segundos = tempoOciosoSegundos % 60;
          const tempoOciosoFormatado = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

          if (g.tempoOcupadoFormatado !== tempoOciosoFormatado) {
            needsUpdate = true;
          }
          return {
            ...g,
            tempoOcupadoFormatado: tempoOciosoFormatado
          };
        } else if (g.status === 'chamando') {
          if (g.tempoOcupadoFormatado !== '00:00' || g.tempoOcupadoSegundos !== 0) {
            needsUpdate = true;
          }
          return {
            ...g,
            tempoOcupadoFormatado: '00:00',
            tempoOcupadoSegundos: 0,
            progresso: 0,
            atrasado: false
          };
        }
        return g;
      });
      if (needsUpdate) {
        this.guichesSubject.next(guiches);
      }
    }, 1000);
  }

  getGuiches(): any[] {
    return this.guichesSubject.value;
  }

  atualizarGuiche(numeroGuiche: number, novosDados: any) {
    const guiches = this.guichesSubject.value;
    const index = guiches.findIndex(g => g.numero === numeroGuiche);
    if (index !== -1) {
      guiches[index] = { ...guiches[index], ...novosDados };
      this.guichesSubject.next([...guiches]);
    }
  }

  atribuirOperador(guicheId: number, operadorId: number) {
    return this.http.patch(
      `${this.apiUrl}/${guicheId}`,
      {
        operadorAtualId: operadorId,
        status: 'Online',
        loginOperadorEm: new Date()
      },
      { headers: this.authHeaders() }
    );
  }

  chamarProximo(guicheId: number) {
    return this.http.post(`${environment.apiUrl}/fila/chamar_proximo`, { guiche: guicheId }, { headers: this.authHeaders() });
  }

  encerrarAtendimento(senhaId: number) {
    return this.http.post(`${environment.apiUrl}/fila/finalizar_atendimento`, { senhaId: senhaId }, { headers: this.authHeaders() });
  }

  liberarGuiche(guicheId: number) {
    return this.http.patch(
      `${this.apiUrl}/${guicheId}`,
      {
        operadorAtualId: null,
        status: 'Offline',
        loginOperadorEm: null
      },
      { headers: this.authHeaders() }
    );
  }

  getGuichesAtivos(): number {
    return this.guichesSubject.value.filter(g => g.status !== 'vazio' && g.status !== 'manutencao').length;
  }

}
