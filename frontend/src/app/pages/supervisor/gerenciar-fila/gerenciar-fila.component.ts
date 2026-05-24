import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { LucideAngularModule, Search, Clock, User, AlertCircle, ArrowUpCircle, CheckCircle, Users, ArrowLeft, Plus, X, Mail, MoreVertical, Trash2 } from 'lucide-angular';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';
import { GuicheService } from '../../../services/guiche.service';
import { FilialService } from '../../../services/filial.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-supervisor-gerenciar-fila',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './gerenciar-fila.component.html',
  styleUrls: ['./gerenciar-fila.component.scss']
})
export class SupervisorGerenciarFilaComponent implements OnInit, OnDestroy {
  icons = { search: Search, clock: Clock, user: User, alert: AlertCircle, up: ArrowUpCircle, check: CheckCircle, users: Users, arrowLeft: ArrowLeft, plus: Plus, x: X, mail: Mail, moreVertical: MoreVertical, trash: Trash2 };
  currentTab = 'espera';

  configForm!: FormGroup;
  showSuccessModal = false;
  tempoMedioAtendimentoGeral = 0;

  contextMenuGuicheId: number | null = null;
  showRemoveOperatorConfirmModal = false;
  guicheSelecionadoParaRemocao: any = null;

  operadorForm!: FormGroup;
  showCriarOperadorModal = false;

  filaEspera: any[] = [];
  private filaTimer: any;

  showCancelModal = false;
  itemParaCancelar: any = null;

  showZerarFilaModal = false;
  zerarFilaLoading = false;
  zerarFilaResultado: { sucesso: boolean; mensagem: string } | null = null;

  baias = [
    { numero: 1, status: 'ocupada', statusLabel: 'Ocupada', operador: 'João Santos', ticket: 'RP044', placa: 'GHI-9012', progresso: 65, tempoOcupado: 12, tempoOcupadoFormatado: '12:00', atrasado: false, startTime: new Date().getTime() - 12 * 60 * 1000 },
    { numero: 2, status: 'livre', statusLabel: 'Livre', operador: 'Ana Costa' },
    { numero: 3, status: 'ocupada', statusLabel: 'Ocupada', operador: 'Maria Silva', ticket: 'C041', placa: 'JKL-3456', progresso: 20, tempoOcupado: 4, tempoOcupadoFormatado: '04:00', atrasado: false, startTime: new Date().getTime() - 4 * 60 * 1000 },
    { numero: 4, status: 'manutencao', statusLabel: 'Manutenção' },
  ];

  guiches: any[] = [];
  filtroFila = '';
  filteredFilaEspera: any[] = [];
  filteredGuiches: any[] = [];
  private baiasTimer: any;

  showOperadorModal = false;
  guicheAtual: any = null;
  operadoresDisponiveis: any[] = [];
  operadorLoading = false;
  operadorError: string | null = null;
  private apiUrl = environment.apiUrl;

  formatarTituloGuiche(numero: string | number | undefined): string {
    if (numero === undefined || numero === null) return '';
    const limpo = String(numero).trim();
    if (/^Guich[êe]/i.test(limpo)) {
      return limpo.toUpperCase();
    }
    if (!isNaN(Number(limpo))) {
      return `GUICHÊ ${limpo}`;
    }
    return limpo.toUpperCase();
  }
  private relatoriosTimer: any;

  private filialSub?: any;
  selectedFilialId: number | null = null;
  selectedFilialNome: string = 'Carregando...';

  constructor(
    private guicheService: GuicheService,
    private filialService: FilialService,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.configForm = new FormGroup({
      tempoTolerancia: new FormControl(this.guicheService.tempoTolerancia),
      limiteAtendimentos: new FormControl(200),
      prioridadePcdIdoso: new FormControl(true),
      redirecionarAusentes: new FormControl(false),
      eficienciaMinima: new FormControl(90)
    });

    this.operadorForm = this.fb.group({
      nome: ['', Validators.required],
      nomeUsuario: ['', Validators.required],
      senha: ['', [Validators.required, Validators.minLength(8)]],
      confirmarSenha: ['', Validators.required],
      filial: ['', Validators.required],
      telefone: [''],
      email: ['', [Validators.required, Validators.email]],
      funcao: ['Operador']
    });

    this.filialSub = this.filialService.selectedFilial$.subscribe((id: number | null) => {
      this.selectedFilialId = id;
      this.atualizarNomeFilial();
      this.guicheService.carregarGuichesDaApi(id || undefined);
      this.carregarFilaEspera();
      this.carregarConfiguracoes();
    });

    // Buscar estatística de tempo médio do dia e atualizar constantemente
    this.carregarDadosTempoMedio();
    this.relatoriosTimer = setInterval(() => {
      this.carregarDadosTempoMedio();
    }, 10000);

    // Timer da Fila
    this.filaTimer = setInterval(() => {
      this.carregarFilaEspera();
    }, 60000);

    // Inscrever aos dados de guichês do serviço
    this.guicheService.guiches$.subscribe((guiches: any[]) => {
      this.guiches = guiches;
      this.aplicarFiltroFila();
    });

    // Timer for baia occupancy countdowns
    this.baiasTimer = setInterval(() => {
      this.baias.forEach(baia => {
        if (baia.status === 'ocupada' && baia.startTime) {
          const now = new Date().getTime();
          const decorridoSegundos = Math.floor((now - baia.startTime) / 1000);

          const minutos = Math.floor(decorridoSegundos / 60);
          const segundos = decorridoSegundos % 60;
          baia.tempoOcupadoFormatado = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
          baia.tempoOcupado = minutos;

          const propTolerancia = this.guicheService.tempoTolerancia * 60;
          const progBruto = (decorridoSegundos / propTolerancia) * 100;
          baia.atrasado = progBruto >= 100;
          baia.progresso = Math.min(progBruto, 100);
        }
      });
      this.cdr.detectChanges();
    }, 1000);
  }

  private atualizarNomeFilial() {
    this.filialService.getFiliais().subscribe((filiais: any[]) => {
      const f = filiais.find((f: any) => f.id === this.selectedFilialId);
      if (f) this.selectedFilialNome = f.nome;
    });
  }

  ngOnDestroy() {
    if (this.baiasTimer) clearInterval(this.baiasTimer);
    if (this.relatoriosTimer) clearInterval(this.relatoriosTimer);
    if (this.filaTimer) clearInterval(this.filaTimer);
    if (this.filialSub) this.filialSub.unsubscribe();
  }

  carregarFilaEspera() {
    const token = localStorage.getItem('token') || '';
    const filialParam = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
    this.http.get<any[]>(`${this.apiUrl}/dashboard/fila-espera${filialParam}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (dados) => {
        this.filaEspera = dados;
        this.aplicarFiltroFila();
      },
      error: (err) => console.error('Erro ao carregar fila:', err)
    });
  }

  aplicarFiltroFila() {
    const termo = this.filtroFila?.toLowerCase().trim();
    if (!termo) {
      this.filteredFilaEspera = this.filaEspera;
      this.filteredGuiches = this.guiches;
    } else {
      this.filteredFilaEspera = this.filaEspera.filter((item: any) => {
        const combinacao = `${item.ticket} ${item.motorista} ${item.servico}`.toLowerCase();
        return combinacao.includes(termo);
      });
      this.filteredGuiches = this.guiches.filter((g: any) => {
        const combinacao = `${g.numero} ${g.status} ${g.nomeOperador || ''} ${g.senha || ''} ${g.placa || ''}`.toLowerCase();
        return combinacao.includes(termo);
      });
    }
    this.cdr.detectChanges();
  }

  carregarConfiguracoes() {
    const token = localStorage.getItem('token') || '';
    const filialParam = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
    this.http.get<any[]>(`${this.apiUrl}/configuracoes/lista${filialParam}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (configs) => {
        const configMap: Record<string, string> = {};
        configs.forEach((c: any) => configMap[c.chave] = c.valor);
        
        const getVal = (keyCamel: string, keyUpper: string) => {
          return configMap[keyCamel] !== undefined ? configMap[keyCamel] : configMap[keyUpper];
        };

        const valTolerancia = getVal('tempoTolerancia', 'TEMPO_TOLERANCIA');
        const valLimite = getVal('limiteAtendimentosDia', 'LIMITE_ATENDIMENTOS');
        const valPrioridade = getVal('prioridadeAutomatica', 'PRIORIDADE_AUTOMATICA');
        const valRedirecionar = getVal('redirecionarAusentes', 'REDIRECIONAR_AUSENTES');
        const valEficiencia = getVal('eficienciaMinima', 'EFICIENCIA_MINIMA');

        this.configForm.patchValue({
          tempoTolerancia: valTolerancia ? parseInt(valTolerancia, 10) : 15,
          limiteAtendimentos: valLimite ? parseInt(valLimite, 10) : 200,
          prioridadePcdIdoso: valPrioridade !== 'false',
          redirecionarAusentes: valRedirecionar === 'true',
          eficienciaMinima: valEficiencia ? parseInt(valEficiencia, 10) : 90
        });
        
        this.guicheService.tempoTolerancia = this.configForm.value.tempoTolerancia;
      },
      error: (err) => console.error('Erro ao carregar configurações:', err)
    });
  }

  carregarDadosTempoMedio() {
    const token = localStorage.getItem('token') || '';
    const filialParam = this.selectedFilialId ? `&filialId=${this.selectedFilialId}` : '';
    this.http.get<any>(`${this.apiUrl}/dashboard/relatorios?periodo=dia${filialParam}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (dados: any) => {
        // O endpoint retorna { kpis: { mediaAtendimentoMinutos: X } }
        const rawMinutos = dados?.kpis?.mediaAtendimentoMinutos || 0;
        this.tempoMedioAtendimentoGeral = Math.round(rawMinutos);
        this.cdr.detectChanges();
      }
    });
  }

  chamar(item: any) {
    const guicheDisponivel = this.guiches.find(g => g.status === 'disponivel');
    
    if (!guicheDisponivel) {
      alert('Nenhum guichê disponível no momento.');
      return;
    }

    const token = localStorage.getItem('token') || '';
    this.http.post(`${this.apiUrl}/fila/chamar_especifico`, 
      { guiche: guicheDisponivel.id, senhaId: item.id }, 
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: () => {
        // Atualizar lista e guichês
        this.carregarFilaEspera();
        this.guicheService.refreshGuiches(this.selectedFilialId || undefined);
      },
      error: (err) => {
        console.error(err);
        alert('Erro ao chamar a senha.');
      }
    });
  }

  abrirModalCancelar(item: any) {
    this.itemParaCancelar = item;
    this.showCancelModal = true;
  }

  fecharModalCancelar() {
    this.itemParaCancelar = null;
    this.showCancelModal = false;
  }

  // --- Zerar Fila ---
  abrirModalZerarFila() {
    this.zerarFilaResultado = null;
    this.showZerarFilaModal = true;
  }

  fecharModalZerarFila() {
    this.showZerarFilaModal = false;
    this.zerarFilaLoading = false;
    this.zerarFilaResultado = null;
  }

  confirmarZerarFila() {
    this.zerarFilaLoading = true;
    this.zerarFilaResultado = null;
    const token = localStorage.getItem('token') || '';
    const body = this.selectedFilialId ? { filialId: this.selectedFilialId } : {};
    this.http.post<{ message: string; removidas: number }>(
      `${this.apiUrl}/fila/zerar`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: (res) => {
        this.zerarFilaLoading = false;
        this.zerarFilaResultado = {
          sucesso: true,
          mensagem: `${res.message}. ${res.removidas} senha(s) removida(s).`
        };
        this.carregarFilaEspera();
      },
      error: (err) => {
        this.zerarFilaLoading = false;
        this.zerarFilaResultado = {
          sucesso: false,
          mensagem: err.error?.message || 'Erro ao zerar a fila. Tente novamente.'
        };
      }
    });
  }

  confirmarCancelamento() {
    if (!this.itemParaCancelar) return;

    const token = localStorage.getItem('token') || '';
    this.http.patch(`${this.apiUrl}/fila/senha/${this.itemParaCancelar.id}/cancelar`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.fecharModalCancelar();
        this.carregarFilaEspera();
      },
      error: (err) => {
        console.error(err);
        alert('Erro ao cancelar a senha.');
      }
    });
  }

  chamarProximo(baia: any) {
    alert(`Chamando próximo cliente para a Baia ${baia.numero}.`);
  }

  encerrar(baia: any) {
    if (confirm(`Deseja encerrar o atendimento ${baia.ticket} na Baia ${baia.numero}?`)) {
      baia.status = 'livre';
      baia.statusLabel = 'Livre';
      baia.ticket = null;
      baia.placa = null;
    }
  }

  salvarConfiguracoes() {
    if (this.configForm.valid) {
      const formValue = this.configForm.value;
      
      const configs = [
        { chave: 'tempoTolerancia', valor: formValue.tempoTolerancia.toString() },
        { chave: 'limiteAtendimentosDia', valor: formValue.limiteAtendimentos.toString() },
        { chave: 'prioridadeAutomatica', valor: formValue.prioridadePcdIdoso.toString() },
        { chave: 'redirecionarAusentes', valor: formValue.redirecionarAusentes.toString() },
        { chave: 'eficienciaMinima', valor: formValue.eficienciaMinima.toString() }
      ];

      const token = localStorage.getItem('token') || '';
      const filialParam = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
      
      this.http.post(`${this.apiUrl}/configuracoes/bulk${filialParam}`, { configs }, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: () => {
          this.guicheService.tempoTolerancia = formValue.tempoTolerancia;
          this.showSuccessModal = true;
        },
        error: (err) => {
          console.error('Erro ao salvar configurações:', err);
          alert('Erro ao salvar configurações.');
        }
      });
    }
  }



  fecharSuccessModal() {
    this.showSuccessModal = false;
  }

  // --- Operators Management ---
  abrirModalAdicionarOperador(guiche: any) {
    this.guicheAtual = guiche;
    this.showOperadorModal = true;
    this.operadorLoading = true;
    this.operadorError = null;
    this.carregarOperadores();
  }

  carregarOperadores() {
    // Bug fix 1: Não filtrar por filialId — operadores cadastrados sem filial_id
    // ficam invisiveis quando o filtro é aplicado no backend (WHERE filial_id = X).
    // Bug fix 2: Incluir Authorization header — o endpoint é protegido por JwtAuthGuard.
    const token = localStorage.getItem('token') || '';
    this.http.get<any[]>(`${this.apiUrl}/usuarios`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(
      (usuarios: any[]) => {
        // Filtrar apenas usuários com perfil 'OPERADOR' e ativos
        let operadoresFiltrados = usuarios.filter(
          u => u.perfil === 'OPERADOR' && u.ativo
        );

        // Obter nomes dos operadores já atribuídos a guichês ativos
        const operadoresAtribuidos = this.guiches
          .filter(g => g.status !== 'vazio' && g.operador)
          .map(g => g.operador);

        // Remover operadores já atribuídos da lista disponível
        operadoresFiltrados = operadoresFiltrados.filter(
          op => !operadoresAtribuidos.includes(op.nome)
        );

        this.operadoresDisponiveis = operadoresFiltrados;
        this.operadorLoading = false;

        if (this.operadoresDisponiveis.length === 0) {
          this.operadorError = 'Nenhum operador disponível no momento.';
        }
      },
      (error) => {
        console.error('Erro ao carregar operadores:', error);
        this.operadorError = 'Erro ao buscar operadores. Tente novamente.';
        this.operadorLoading = false;
        this.operadoresDisponiveis = [];
      }
    );
  }

  fecharModalOperador() {
    this.showOperadorModal = false;
    this.guicheAtual = null;
    this.operadoresDisponiveis = [];
    this.operadorError = null;
  }

  selecionarOperador(operador: any) {
    if (this.guicheAtual) {
      this.operadorLoading = true;
      this.guicheService.atribuirOperador(this.guicheAtual.id, operador.id).subscribe({
        next: () => {
          this.guicheService.refreshGuiches(this.selectedFilialId || undefined);
          this.fecharModalOperador();
        },
        error: (err) => {
          console.error(err);
          this.operadorError = 'Erro ao atribuir operador ao guichê.';
          this.operadorLoading = false;
        }
      });
    }
  }

  chamarProximoGuiche(guiche: any) {
    this.guicheService.chamarProximo(guiche.id).subscribe({
      next: () => {
        this.guicheService.refreshGuiches(this.selectedFilialId || undefined);
      },
      error: (err) => {
        console.error(err);
        alert(err.error?.message || 'Erro ao chamar próximo.');
      }
    });
  }

  encerrarAtendimentoGuiche(guiche: any) {
    if (guiche.status === 'ocupado') {
      if (confirm(`Deseja encerrar o atendimento ${guiche.ticket} no Guichê ${guiche.displayLabel || guiche.nome || guiche.numero}?`)) {
        if (!guiche.senhaId) {
          alert('ID do atendimento não encontrado. Atualize a página e tente novamente.');
          return;
        }
        this.guicheService.encerrarAtendimento(guiche.senhaId).subscribe({
          next: () => {
             this.guicheService.refreshGuiches(this.selectedFilialId || undefined);
          },
          error: (err) => {
             console.error(err);
             alert(err.error?.message || 'Erro ao encerrar atendimento.');
          }
        });
      }
    }
  }

  irParaCadastroOperador() {
    this.showOperadorModal = false;
    this.showCriarOperadorModal = true;
  }

  fecharCriarOperadorModal() {
    this.showCriarOperadorModal = false;
    this.operadorForm.reset({ funcao: 'Operador' });
    this.showOperadorModal = true;
  }

  salvarNovoOperador() {
    if (this.operadorForm.invalid) {
      alert('Preencha os campos obrigatórios corretamente.');
      return;
    }
    const formValue = this.operadorForm.value;
    if (formValue.senha !== formValue.confirmarSenha) {
      alert('As senhas não conferem.');
      return;
    }

    const payload = {
      nome: formValue.nome,
      email: formValue.email,
      login: formValue.nomeUsuario,
      senha: formValue.senha,
      perfil: 'OPERADOR',
      ativo: true
    };

    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.post(`${this.apiUrl}/usuarios`, payload, { headers }).subscribe({
      next: () => {
        this.operadorForm.reset({ funcao: 'Operador' });
        this.showCriarOperadorModal = false;
        this.showOperadorModal = true;
        this.operadorLoading = true;
        this.carregarOperadores();
      },
      error: (err) => {
        alert('Erro ao cadastrar operador: ' + (err.error?.message || 'Erro desconhecido'));
      }
    });
  }

  formatarTempoEspera(minutos: number): string {
    if (minutos < 60) {
      return `${minutos} min`;
    }
    const hours = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (hours < 24) {
      return `${hours}h ${mins.toString().padStart(2, '0')}min`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  get guichesAtivos(): number {
    return this.guicheService.getGuichesAtivos();
  }

  get baiasAtivas(): number {
    return this.baias.filter(baia => baia.status !== 'manutencao').length;
  }

  toggleContextMenu(guiche: any, event: MouseEvent) {
    event.stopPropagation();
    this.contextMenuGuicheId = this.contextMenuGuicheId === guiche.id ? null : guiche.id;
  }

  closeContextMenu() {
    this.contextMenuGuicheId = null;
  }

  openRemoveOperatorConfirmation(guiche: any, event: MouseEvent) {
    event.stopPropagation();
    this.guicheSelecionadoParaRemocao = guiche;
    this.showRemoveOperatorConfirmModal = true;
    this.closeContextMenu();
  }

  cancelarRemocaoOperador() {
    this.showRemoveOperatorConfirmModal = false;
    this.guicheSelecionadoParaRemocao = null;
  }

  confirmarRemocaoOperador() {
    if (this.guicheSelecionadoParaRemocao) {
      this.guicheService.liberarGuiche(this.guicheSelecionadoParaRemocao.id).subscribe({
        next: () => {
          this.guicheService.refreshGuiches(this.selectedFilialId || undefined);
          this.guicheSelecionadoParaRemocao = null;
          this.showRemoveOperatorConfirmModal = false;
        },
        error: (err) => {
          console.error(err);
          alert('Erro ao remover o operador.');
        }
      });
    } else {
      this.showRemoveOperatorConfirmModal = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.context-menu-wrapper')) {
      this.closeContextMenu();
    }
  }
}
