import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
    LucideAngularModule, User, Phone, Briefcase, Hash,
    Play, CheckCircle, XCircle, RotateCcw, AlertTriangle, Users, Clock, Search, Truck, CreditCard, Calendar, LogOut, FileText, Package, Building2, Mail, History, Eye, X, AlertCircle, Lock, ChevronDown
} from 'lucide-angular';
import { GuicheService, GuicheOperador } from '../../../services/guiche.service';
import { AuthService } from '../../../services/auth.service';
import { finalize, switchMap, takeUntil, catchError, debounceTime } from 'rxjs/operators';
import { Subject, of, interval } from 'rxjs';
import { FilialService, Filial } from '../../../services/filial.service';
import { ApiService } from '../../../services/api.service';
import { DashboardService } from '../../../services/dashboard.service';
@Component({
    selector: 'app-painel-operador',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, LucideAngularModule],
    templateUrl: './painel.component.html',
    styleUrls: ['./painel.component.scss'],
    providers: [DashboardService]
})
export class PainelOperadorComponent implements OnInit, OnDestroy {
    atendimentosList: any[] = [];
    agendamentos: any[] = [];
    atendimentoSelecionado: any = null;
    showJustificativaModal = false;
    justificativaForm!: FormGroup;
    formatarDocumento(event: any) {
        let value = event.target.value.replace(/\D/g, '');
        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            value = value.replace(/^(\d{2})(\d)/, '$1.$2');
            value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
            value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        this.formCliente.documento = value;
    }

    formatarTelefone(event: any) {
        let value = event.target.value.replace(/\D/g, '');
        value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
        value = value.replace(/(\d)(\d{4})$/, '$1-$2');
        this.formCliente.telefone = value;
    }

    formatarPlaca(event: any) {
        let value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (value.length > 3) {
            value = value.replace(/^([A-Z]{3})([0-9A-Z]{1,4})$/, '$1-$2');
        }
        this.formCaminhao.placa = value;
    }

    salvarCadastroCliente() {
        const nome = this.tipoClienteCadastro === 'PJ' ? this.formCliente.nomeEmpresa : this.formCliente.nome;

        if (!nome || !this.formCliente.documento) {
            alert('Preencha os campos obrigatórios (Nome/Razão Social e Documento).');
            return;
        }

        const documentoLimpo = this.formCliente.documento.replace(/\D/g, '');

        const payload: any = {
            tipo: this.tipoClienteCadastro,
            nome: nome,
            telefone: this.formCliente.telefone.replace(/\D/g, ''),
            email: this.formCliente.email
        };

        if (this.tipoClienteCadastro === 'PJ') {
            payload.cnpj = documentoLimpo;
        } else {
            payload.cpf = documentoLimpo;
        }

        this.api.post<any>('/clientes', payload).subscribe({
            next: () => {
                this.formCliente = {
                    nomeEmpresa: '',
                    nome: '',
                    documento: '',
                    telefone: '',
                    email: '',
                };
                this.modalAberto = null;
                this.successModal = 'client';
                this.termoBuscaCliente = nome;
                this.atualizarBuscaCliente();
                this.cdr.markForCheck();
            },
            error: err => alert(err?.error?.message || 'Erro ao cadastrar cliente.')
        });
    }

    salvarCadastroCaminhao() {
        if (!this.formCaminhao.placa || !this.formCaminhao.modelo || !this.formCaminhao.transportadora || !this.formCaminhao.capacidade) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }
        const filialIdNum = parseInt(this.filialSelecionada || '0', 10);
        // Tentar enviar dados sem id (gerado pelo Prisma)
        const payload = {
            placa: this.formCaminhao.placa.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7), // Remove traços, espaços e formata para 7 caracteres alfanuméricos
            modelo: this.formCaminhao.modelo,
            transportadora: this.formCaminhao.transportadora,
            capacidade: this.formCaminhao.capacidade,
            observacoes: this.formCaminhao.observacoes,
            filial_id: isNaN(filialIdNum) ? undefined : filialIdNum
        };
        this.api.post<any>('/caminhoes/operacional', payload).subscribe({
            next: () => {
                this.formCaminhao = {
                    placa: '',
                    modelo: '',
                    transportadora: '',
                    capacidade: '',
                    observacoes: '',
                };
                this.modalAberto = null;
                this.successModal = 'truck';
                this.cdr.markForCheck();
            },
            error: err => alert(err?.error?.message || 'Erro ao cadastrar caminhão.')
        });
    }

    nomeOperador = 'Operador (Carregando...)';
    numeroGuiche: string | number = 0;
    guicheAtualId: number | null = null;
    idiomaAtivo = 'PT';
    filialSelecionada = '';
    filiais: Filial[] = [];
    hasRestrictedFilial = false;

    tempoOciosoText = '00:00';
    ociosoIniciadoEm: number | null = null;
    ociosoTimer: any;

    // Ícones do sistema
    icons = {
        user: User, phone: Phone, briefcase: Briefcase, hash: Hash,
        play: Play, check: CheckCircle, close: X, recall: RotateCcw, rotateCcw: RotateCcw,
        alert: AlertTriangle, alertCircle: AlertCircle, users: Users, clock: Clock,
        search: Search, truck: Truck, creditCard: CreditCard,
        calendar: Calendar, logout: LogOut, queue: Users, phoneCall: Phone,
        building: Building2, package: Package, fileText: FileText, mail: Mail,
        history: History, eye: Eye, x: X, lock: Lock, chevronDown: ChevronDown
    };

    // Status de fila
    filaAguardando = 12;
    tempoMedio = '14 min';

    // Lista de próximas senhas
    filaProximas: any[] = [];

    // Ticket Atual
    ticketAtual: any = null;
    modalAberto: string | null = null;
    successModal: 'truck' | 'client' | null = null;
    mostrarToastRechamar: boolean = false;
    mostrarToastTimeout: any;
    guicheTransferenciaSelecionado: string | null = null;
    guicheTransferenciaDestino: { guiche: string; nome: string } | null = null;
    retornarFilaGeral = false;
    quantidadeGarrafoes = 0;
    tempoAtendimento = '00:00';
    atendimentoIniciadoEm: number | null = null;
    atendimentoTimer: any;

    termoBuscaCliente = '';
    mostrarSugestoesCliente = false;
    clientesFiltrados: Array<{ id?: string; nome: string; documento: string }> = [];
    readonly clientesBase = [
        { nome: 'João Silva', documento: '123.456.789-00' },
        { nome: 'José Oliveira', documento: '456.789.123-00' },
        { nome: 'Maria Santos', documento: '987.654.321-00' },
    ];

    classificacaoSelecionada = '';
    readonly classificacoesAtendimento = [
        'Compra',
        'Carga',
        'Descarga',
        'Devolução',
        'Documentação',
        'Pagamento',
        'Problema Operacional',
        'Dúvida / Orientação',
    ];

    tipoClienteCadastro: 'PF' | 'PJ' = 'PF';
    clienteDetalhes: any = null;

    abrirDetalhesCliente() {
        if (!this.ticketAtual?.documento) {
            alert('Cliente sem documento cadastrado.');
            return;
        }

        const documentoLimpo = this.ticketAtual.documento.replace(/\D/g, '');
        this.api.get<any[]>(`/clientes?busca=${encodeURIComponent(documentoLimpo)}`).subscribe({
            next: (clientes) => {
                if (clientes.length > 0) {
                    this.clienteDetalhes = clientes[0];
                    this.modalAberto = 'detalhes-cliente';
                } else {
                    this.clienteDetalhes = {
                        nome: this.ticketAtual.cliente,
                        documento: this.ticketAtual.documento,
                        nota: 'Apenas os dados básicos estão vinculados a este atendimento. Cadastro completo não encontrado na base.'
                    };
                    this.modalAberto = 'detalhes-cliente';
                }
                this.cdr.markForCheck();
            },
            error: () => alert('Ocorreu um erro ao buscar o cliente.')
        });
    }

    formCaminhao = {
        placa: '',
        modelo: '',
        transportadora: '',
        capacidade: '',
        observacoes: '',
    };
    formCliente = {
        nomeEmpresa: '',
        nome: '',
        documento: '',
        telefone: '',
        email: '',
    };

    guichesLista: Array<{ id: string; nome: string; guiche: string; status: string; atendimento: string }> = [];

    // Polling de sincronização
    private destroy$ = new Subject<void>();

    constructor(
        private router: Router,
        private guicheService: GuicheService,
        private authService: AuthService,
        private filialService: FilialService,
        private cdr: ChangeDetectorRef,
        private api: ApiService,
        private fb: FormBuilder,
        private dashboardService: DashboardService
    ) {
        this.justificativaForm = this.fb.group({
            motivo: ['', Validators.required],
            observacoes: ['']
        });
    }

    ngOnInit() {
        this.nomeOperador = localStorage.getItem('usuario_nome') || 'Atendente Padrão';
        this.carregarDadosPerfil();
        this.carregarFiliais();

        this.searchSubject.pipe(
            debounceTime(300),
            switchMap(termo => {
                if (!termo || termo.length < 3) {
                    return of([]);
                }
                const filialId = this.filialSelecionada || (this.filialService.getSelectedFilialId()?.toString() || '');
                const query = filialId ? `?filialId=${filialId}&busca=${encodeURIComponent(termo)}` : `?busca=${encodeURIComponent(termo)}`;
                return this.api.get<any[]>(`/clientes${query}`).pipe(
                    catchError(() => of([]))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(clientes => {
            this.clientesFiltrados = clientes.map(c => ({
                id: c.id,
                nome: c.nome,
                documento: c.documento || c.cpf || c.cnpj || 'Sem Documento'
            }));
            this.mostrarSugestoesCliente = this.clientesFiltrados.length > 0;
            this.cdr.markForCheck();
        });

        this.guicheService.getCurrentOperatorGuiche()
            .pipe(
                finalize(() => {
                    this.cdr.markForCheck();
                })
            )
            .subscribe({
                next: (guicheAtual) => {
                    if (!guicheAtual) {
                        this.router.navigate(['/operador/escolha-guiches']);
                        return;
                    }

                    localStorage.setItem('guicheAtual', guicheAtual.numero);

                    // Ajusta para mostrar "Guichê 01" via string ou pegar o número sem parse incorreto
                    this.numeroGuiche = guicheAtual.numero;

                    this.guicheAtualId = guicheAtual.id;

                    // Inicia cronometro Ocioso (pois começou sem ticket)
                    this.iniciarCronometroOcioso();
                    this.cdr.markForCheck();

                    // Carrega fila real e resumos
                    this.carregarFila();
                    this.carregarResumos();
                    this.carregarTicketAtual();

                    // Inicia polling para detectar perda de guichê e lista de fila
                    this.iniciarPollingGuiche();
                },
                error: (err) => {
                    console.error('Erro ao buscar guichê do operador:', err);
                    if (err.status === 401) {
                        this.authService.clearSession();
                        this.router.navigate(['/login']);
                    }
                }
            });
    }

    private carregarFiliais() {
        this.filialService.getFiliais().subscribe({
            next: (data) => {
                const usuarioRaw = localStorage.getItem('usuario_sgf');
                let usuarioFilialId: number | null = null;
                if (usuarioRaw) {
                    try {
                        const usuario = JSON.parse(usuarioRaw);
                        usuarioFilialId = usuario.filial_id || null;
                    } catch { }
                }

                if (usuarioFilialId) {
                    this.filiais = data.filter((f: any) => f.id === usuarioFilialId);
                    this.hasRestrictedFilial = true;
                } else {
                    this.filiais = data;
                    this.hasRestrictedFilial = false;
                }

                const savedId = this.filialService.getSelectedFilialId();
                if (savedId && this.filiais.some((f: any) => f.id === savedId)) {
                    this.filialSelecionada = savedId.toString();
                } else if (this.filiais.length > 0) {
                    this.filialSelecionada = this.filiais[0].id.toString();
                    this.filialService.setSelectedFilial(this.filiais[0].id);
                } else {
                    this.filialSelecionada = '';
                    this.filialService.setSelectedFilial(null);
                }
                this.cdr.markForCheck();
            }
        });
    }

    onFilialChange() {
        const id = this.filialSelecionada ? parseInt(this.filialSelecionada, 10) : null;
        this.filialService.setSelectedFilial(id);

        // Ao mudar a filial, recarrega a fila e os resumos (agendamentos daquela filial)
        this.carregarFila();
        this.carregarResumos();
        this.cdr.markForCheck();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.pararCronometroAtendimento();
        this.pararCronometroOcioso();
    }

    private iniciarPollingGuiche() {
        interval(5000) // Verifica a cada 5 segundos
            .pipe(
                switchMap(() => this.guicheService.getCurrentOperatorGuiche().pipe(
                    catchError(() => of(undefined))
                )),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (guicheSelecionado: GuicheOperador | null | undefined) => {
                    if (guicheSelecionado === undefined) return;

                    // Se não tem mais guichê, volta pra seleção
                    if (guicheSelecionado === null) {
                        this.router.navigate(['/operador/escolha-guiches']);
                        return;
                    }
                    // Atualiza a fila e resumos periodicamente
                    this.carregarFila();
                    this.carregarResumos();
                    this.carregarTicketAtual();
                    this.cdr.markForCheck();
                },
            });
    }

    sair() {
        this.modalAberto = 'sair';
    }

    confirmarSair() {
        this.modalAberto = null;
        this.destroy$.next(); // Para o polling imediatamente
        this.guicheService.releaseCurrentGuiche()
            .pipe(
                finalize(() => {
                    this.cdr.markForCheck();
                })
            )
            .subscribe({
                next: () => {
                    this.authService.logout();
                    this.router.navigate(['/login']);
                },
                error: () => {
                    this.authService.logout();
                    this.router.navigate(['/login']);
                }
            });
    }

    carregarFila() {
        if (!this.guicheAtualId) return;
        this.api.get<any[]>('/fila/operador/proximas', {}, { 'x-guiche-id': this.guicheAtualId.toString() }).subscribe({
            next: (res) => {
                this.filaProximas = res.map((item, index) => ({
                    id: item.id,
                    codigo: item.numeroDisplay,
                    tempo: this.formatarTempoFila(item.dataCriacao),
                    servico: item.servico?.nome || 'Serviço Geral',
                    posicao: index + 1,
                    qtdeGarrafoes: item.qtdeGarrafoes || 0
                }));
                this.filaAguardando = res.length;
                this.cdr.markForCheck();
            },
            error: () => { }
        });
    }

    carregarTicketAtual() {
        if (!this.guicheAtualId) return;
        this.api.get<any>('/fila/operador/atual', {}, { 'x-guiche-id': this.guicheAtualId.toString() }).subscribe({
            next: (senha) => {
                if (!senha) {
                    if (this.ticketAtual) {
                        this.ticketAtual = null;
                        this.pararCronometroAtendimento();
                        this.tempoAtendimento = '00:00';
                        this.iniciarCronometroOcioso();
                    }
                    return;
                }

                const clienteNome = senha.nomeCliente || senha.cliente?.nome || senha.agendamento?.nomeCliente || '';
                const clienteDocumento = senha.documentoCliente || senha.cliente?.cpf || senha.cliente?.cnpj || senha.agendamento?.documento || '';

                this.ticketAtual = {
                    id: senha.id,
                    senha: senha.numeroDisplay,
                    cliente: clienteNome,
                    documento: clienteDocumento,
                    servico: senha.servico?.nome || 'Serviço',
                    status: senha.status,
                    clienteSelecionado: !!clienteNome,
                    tempoEsperaReal: this.calcularTempoEsperaReal(senha.dataCriacao, senha.inicioAtendimento)
                };

                this.quantidadeGarrafoes = senha.qtdeGarrafoes || 0;
                this.pararCronometroOcioso();

                if (senha.status === 'EM_ATENDIMENTO') {
                    const inicio = senha.inicioAtendimento
                        ? new Date(senha.inicioAtendimento).getTime()
                        : undefined;
                    this.iniciarCronometroAtendimento(inicio);
                } else {
                    this.pararCronometroAtendimento();
                    this.tempoAtendimento = '00:00';
                }

                this.cdr.markForCheck();
            },
            error: () => { }
        });
    }

    chamarProximo() {
        if (this.ticketAtual && this.ticketAtual.status !== 'FINALIZADO' && this.ticketAtual.status !== 'CANCELADO') {
            // Block if already in progress
            return;
        }

        if (!this.guicheAtualId) {
            this.router.navigate(['/operador/escolha-guiches']);
            return;
        }

        this.api.post<any>('/fila/chamar_proximo', { guiche: this.guicheAtualId }).subscribe({
            next: (senha) => {
                const clienteNome = senha.nomeCliente || senha.cliente?.nome || senha.agendamento?.nomeCliente || '';
                const clienteDocumento = senha.documentoCliente || senha.cliente?.cpf || senha.cliente?.cnpj || senha.agendamento?.documento || '';

                this.ticketAtual = {
                    id: senha.id,
                    senha: senha.numeroDisplay,
                    cliente: clienteNome,
                    documento: clienteDocumento,
                    servico: senha.servico?.nome || 'Serviço',
                    status: 'CHAMADO',
                    clienteSelecionado: !!clienteNome,
                    tempoEsperaReal: this.calcularTempoEsperaReal(senha.dataCriacao, new Date().toISOString())
                };

                this.classificacaoSelecionada = '';
                this.quantidadeGarrafoes = senha.qtdeGarrafoes || 0;
                this.termoBuscaCliente = '';
                this.clientesFiltrados = [];
                this.mostrarSugestoesCliente = false;
                this.tempoAtendimento = '00:00';

                // Parar ocioso
                this.pararCronometroOcioso();
                this.pararCronometroAtendimento();
                this.carregarFila();
                this.cdr.markForCheck();
            },
            error: (err) => {
                const isMsg = err?.error?.message;
                alert(isMsg ? err.error.message : 'Nenhum cliente na fila no momento.');
            }
        });
    }

    iniciarAtendimento() {
        if (this.ticketAtual && this.ticketAtual.id) {
            this.api.post<any>('/fila/iniciar_atendimento', { senhaId: this.ticketAtual.id }).subscribe({
                next: () => {
                    this.ticketAtual.status = 'EM_ATENDIMENTO';
                    this.iniciarCronometroAtendimento();
                    this.cdr.markForCheck();
                },
                error: () => alert('Erro ao iniciar atendimento.')
            });
        }
    }

    finalizarAtendimento() {
        if (this.ticketAtual && this.ticketAtual.id) {
            this.api.post<any>('/fila/finalizar_atendimento', { senhaId: this.ticketAtual.id }).subscribe({
                next: () => {
                    this.ticketAtual = null; // Libera o guichê
                    this.pararCronometroAtendimento();
                    this.tempoAtendimento = '00:00';
                    this.termoBuscaCliente = '';
                    this.mostrarSugestoesCliente = false;

                    // Iniciar Ocioso novamente
                    this.iniciarCronometroOcioso();
                    this.cdr.markForCheck();
                },
                error: () => alert('Erro ao finalizar atendimento.')
            });
        }
    }



    // Removendo declarações duplicadas no escopo superior.
    trocarIdioma(idioma: string) {
        this.idiomaAtivo = idioma;
        console.log('Idioma alterado para:', idioma);
    }

    abrirModalTransferir() {
        if (!this.ticketAtual) return;
        if (this.ticketAtual.status !== 'CHAMADO') {
            alert('Transferencia permitida apenas antes de iniciar o atendimento.');
            return;
        }
        this.guicheTransferenciaSelecionado = null;
        this.guicheTransferenciaDestino = null;
        this.retornarFilaGeral = false;
        this.carregarGuichesTransferencia();
        this.modalAberto = "transferir";
    }

    fecharModal() {
        this.modalAberto = null;
        this.successModal = null;
    }

    confirmarNaoCompareceu() {
        if (!this.ticketAtual || !this.ticketAtual.id) {
            this.modalAberto = null;
            return;
        }

        this.api.post<any>('/fila/nao_compareceu', { senhaId: this.ticketAtual.id }).subscribe({
            next: () => {
                this.ticketAtual = null;
                this.pararCronometroAtendimento();
                this.tempoAtendimento = '00:00';
                this.modalAberto = null;

                // Iniciar Ocioso novamente
                this.iniciarCronometroOcioso();
                this.cdr.markForCheck();
            },
            error: () => {
                alert('Erro ao marcar não comparecimento.');
                this.modalAberto = null;
            }
        });
    }

    naoCompareceu() {
        if (!this.ticketAtual) return;
        this.modalAberto = "nao-compareceu";
    }

    rechamar() {
        if (!this.ticketAtual || !this.guicheAtualId) return;

        this.api.post<any>('/fila/chamar_proximo', {
            guiche: this.guicheAtualId,
            repetir: true
        }).subscribe({
            next: () => {
                this.mostrarToastRechamar = true;
                if (this.mostrarToastTimeout) clearTimeout(this.mostrarToastTimeout);
                this.mostrarToastTimeout = setTimeout(() => {
                    this.mostrarToastRechamar = false;
                    this.cdr.detectChanges();
                }, 3000);
                this.cdr.markForCheck();
            },
            error: (err) => {
                const isMsg = err?.error?.message;
                alert(isMsg ? err.error.message : 'Nao foi possivel rechamar a senha neste momento.');
            }
        });
    }

    selecionarGuicheTransferencia(id: string) {
        if (this.retornarFilaGeral) return;
        this.guicheTransferenciaSelecionado = id;
    }

    confirmarTransferencia() {
        if (!this.ticketAtual?.id) return;
        if (!this.retornarFilaGeral && !this.guicheTransferenciaSelecionado) return;

        const guicheDestinoId = this.retornarFilaGeral
            ? null
            : Number(this.guicheTransferenciaSelecionado);

        this.api.post<any>('/fila/transferir', {
            senhaId: this.ticketAtual.id,
            guicheDestinoId,
            retornarFila: this.retornarFilaGeral
        }).subscribe({
            next: () => {
                if (this.retornarFilaGeral) {
                    this.guicheTransferenciaDestino = { guiche: 'Fila Geral', nome: 'Sem operador' };
                } else {
                    const destino = this.guichesLista.find((g: any) => g.id === this.guicheTransferenciaSelecionado);
                    if (destino) {
                        this.guicheTransferenciaDestino = { guiche: destino.guiche, nome: destino.nome };
                    }
                }
                this.modalAberto = "transferir-sucesso";
            },
            error: (err) => {
                alert(err?.error?.message || 'Erro ao transferir atendimento.');
            }
        });
    }

    encerrarTransferencia() {
        this.ticketAtual = null; // Libera o guichê atual
        this.pararCronometroAtendimento();
        this.tempoAtendimento = '00:00';
        this.guicheTransferenciaSelecionado = null;
        this.guicheTransferenciaDestino = null;
        this.retornarFilaGeral = false;
        this.modalAberto = null;

        // Iniciar Ocioso novamente
        this.iniciarCronometroOcioso();
        this.carregarFila();
    }

    private carregarGuichesTransferencia() {
        const filialId = this.filialSelecionada ? parseInt(this.filialSelecionada, 10) : undefined;
        this.guicheService.listOperatorGuiches(filialId).subscribe({
            next: (lista) => {
                this.guichesLista = lista.map((g) => {
                    const temOperador = Boolean(g.operador);
                    let status = g.status === 'OCUPADO' ? 'OCUPADO' : 'DISPONÍVEL';
                    if (!temOperador) status = 'FECHADO';
                    return {
                        id: String(g.id),
                        nome: g.operador || '',
                        guiche: g.numero,
                        status,
                        atendimento: g.codigoAtendimento || ''
                    };
                });
                this.cdr.markForCheck();
            },
            error: () => {
                this.guichesLista = [];
            }
        });
    }

    incrementarGarrafoes() {
        this.quantidadeGarrafoes += 1;
    }

    decrementarGarrafoes() {
        this.quantidadeGarrafoes = Math.max(0, this.quantidadeGarrafoes - 1);
    }

    private searchSubject = new Subject<string>();

    atualizarBuscaCliente() {
        const termo = this.termoBuscaCliente.trim();
        if (!termo || termo.length < 3) {
            this.clientesFiltrados = [];
            this.mostrarSugestoesCliente = false;
            return;
        }
        this.searchSubject.next(termo);
    }

    selecionarCliente(cliente: { nome: string; documento: string, id?: string }) {
        if (!this.ticketAtual) return;
        this.ticketAtual.cliente = cliente.nome;
        this.ticketAtual.documento = cliente.documento;
        this.ticketAtual.clienteSelecionado = true;
        this.termoBuscaCliente = cliente.nome;
        this.mostrarSugestoesCliente = false;
        this.cdr.markForCheck();

        // Envia para o backend para persistir
        this.api.patch<any>(`/fila/senha/${this.ticketAtual.id}/cliente`, {
            nome: cliente.nome,
            documento: cliente.documento,
            clienteId: cliente.id
        }).subscribe({
            error: () => alert('Erro ao vincular cliente ao atendimento.')
        });
    }

    private iniciarCronometroAtendimento(inicioEm?: number) {
        this.pararCronometroAtendimento();
        this.atendimentoIniciadoEm = inicioEm ?? Date.now();
        this.atualizarTempoAtendimento();
        this.atendimentoTimer = setInterval(() => {
            this.atualizarTempoAtendimento();
            this.cdr.markForCheck();
        }, 1000);
    }

    private pararCronometroAtendimento() {
        if (this.atendimentoTimer) {
            clearInterval(this.atendimentoTimer);
            this.atendimentoTimer = null;
        }
        this.atendimentoIniciadoEm = null;
    }

    private atualizarTempoAtendimento() {
        if (!this.atendimentoIniciadoEm) {
            this.tempoAtendimento = '00:00';
            return;
        }
        const segundos = Math.floor((Date.now() - this.atendimentoIniciadoEm) / 1000);
        const mm = String(Math.floor(segundos / 60)).padStart(2, '0');
        const ss = String(segundos % 60).padStart(2, '0');
        this.tempoAtendimento = `${mm}:${ss}`;
    }

    abrirModalCadastro(tipo: 'caminhao' | 'cliente') {
        if (tipo === 'caminhao') {
            this.modalAberto = 'cadastro-caminhao';
            return;
        }
        if (tipo === 'cliente') {
            this.modalAberto = 'cadastro-cliente';
            return;
        }
    }

    // -- Resumos de Badges (Meus Atendimentos e Agendamentos) --
    private carregarResumos() {
        if (!this.filialSelecionada) return;
        const fid = parseInt(this.filialSelecionada, 10);

        this.dashboardService.getSupervisorOverview(fid).subscribe({
            next: (res) => {
                const activeAgendamentos = res.agendamentos.filter((a: any) => {
                    return a.status === 'PENDENTE' || a.status === 'CONFIRMADO';
                });

                this.agendamentos = res.agendamentos;

                const seenAgendIdsStr = localStorage.getItem('seenAgendamentoIds') || '[]';
                let seenAgendIds: number[] = [];
                try {
                    seenAgendIds = JSON.parse(seenAgendIdsStr);
                    if (!Array.isArray(seenAgendIds)) seenAgendIds = [];
                } catch (e) {
                    seenAgendIds = [];
                }

                if (this.modalAberto === 'agendamentos') {
                    const currentIds = activeAgendamentos.map((a: any) => a.id);
                    localStorage.setItem('seenAgendamentoIds', JSON.stringify(currentIds));
                    this.badgeAgendamentosCount = 0;
                } else {
                    this.badgeAgendamentosCount = activeAgendamentos.filter((a: any) => !seenAgendIds.includes(a.id)).length;
                }
                this.cdr.markForCheck();
            }
        });

        this.api.get<any[]>('/fila/operador/atendimentos', { filialId: fid }).subscribe({
            next: (res) => {
                this.atendimentosList = res;

                const seenIdsStr = localStorage.getItem('seenAtendimentoIds') || '[]';
                let seenIds: number[] = [];
                try {
                    seenIds = JSON.parse(seenIdsStr);
                    if (!Array.isArray(seenIds)) seenIds = [];
                } catch (e) {
                    seenIds = [];
                }

                if (this.modalAberto === 'atendimentos') {
                    const currentIds = res.map((a: any) => a.id);
                    localStorage.setItem('seenAtendimentoIds', JSON.stringify(currentIds));
                    this.badgeMeusAtendimentosCount = 0;
                } else {
                    this.badgeMeusAtendimentosCount = res.filter((a: any) => !seenIds.includes(a.id)).length;
                }
                this.cdr.markForCheck();
            },
            error: () => {
                this.atendimentosList = [];
                this.badgeMeusAtendimentosCount = 0;
            }
        });
    }

    badgeAgendamentosCount = 0;
    badgeMeusAtendimentosCount = 0;

    // Dropdown de Perfil e Edição
    showProfileMenu = false;
    operadorEmail = '';
    operadorForm = {
        nome: '',
        email: '',
        login: '',
        senha: '',
        confirmarSenha: ''
    };

    toggleProfileMenu(event: Event) {
        event.stopPropagation();
        this.showProfileMenu = !this.showProfileMenu;
    }

    @HostListener('document:click', ['$event'])
    onClickOutside(event: Event) {
        this.showProfileMenu = false;
    }

    carregarDadosPerfil() {
        const salvo = localStorage.getItem('usuario_sgf');
        if (salvo) {
            try {
                const user = JSON.parse(salvo);
                this.operadorForm = {
                    nome: user.nome || '',
                    email: user.email || '',
                    login: user.login || '',
                    senha: '',
                    confirmarSenha: ''
                };
                this.operadorEmail = user.email || '';
            } catch (e) {
                console.error('Erro ao ler usuario_sgf do localStorage', e);
            }
        }
    }

    abrirEditarPerfil() {
        this.carregarDadosPerfil();
        this.showProfileMenu = false;
        this.modalAberto = 'editar-perfil';
        this.cdr.markForCheck();
    }

    salvarPerfil(event?: Event) {
        if (event) event.preventDefault();

        if (!this.operadorForm.nome || !this.operadorForm.email || !this.operadorForm.login) {
            alert('Por favor, preencha os campos obrigatórios (Nome, E-mail e Login).');
            return;
        }

        if (this.operadorForm.senha) {
            if (this.operadorForm.senha.length < 6) {
                alert('A nova senha deve ter no mínimo 6 caracteres.');
                return;
            }
            if (this.operadorForm.senha !== this.operadorForm.confirmarSenha) {
                alert('A nova senha e a confirmação não conferem.');
                return;
            }
        }

        const salvo = localStorage.getItem('usuario_sgf');
        if (!salvo) {
            alert('Erro: operador não encontrado.');
            return;
        }

        let user: any;
        try {
            user = JSON.parse(salvo);
        } catch {
            alert('Erro ao processar dados da sessão.');
            return;
        }

        const payload = {
            nome: this.operadorForm.nome,
            email: this.operadorForm.email,
            login: this.operadorForm.login,
            perfil: user.perfil || 'OPERADOR',
            ativo: user.ativo ?? true,
            filial_id: user.filial_id
        };

        this.api.put<any>(`/usuarios/${user.id}`, payload).subscribe({
            next: (updatedUser) => {
                user.nome = updatedUser.nome;
                user.email = updatedUser.email;
                user.login = updatedUser.login;
                localStorage.setItem('usuario_sgf', JSON.stringify(user));
                localStorage.setItem('usuario_nome', updatedUser.nome);
                this.nomeOperador = updatedUser.nome;
                this.operadorEmail = updatedUser.email || '';

                if (this.operadorForm.senha) {
                    this.api.patch<any>(`/usuarios/${user.id}/senha`, { senha: this.operadorForm.senha }).subscribe({
                        next: () => {
                            this.fecharModal();
                            alert('Perfil e senha atualizados com sucesso!');
                            this.cdr.markForCheck();
                        },
                        error: (err) => {
                            alert('Perfil atualizado, mas houve erro ao salvar nova senha: ' + (err.error?.message || 'Erro desconhecido'));
                        }
                    });
                } else {
                    this.fecharModal();
                    alert('Perfil atualizado com sucesso!');
                    this.cdr.markForCheck();
                }
            },
            error: (err) => {
                alert('Erro ao atualizar perfil: ' + (err.error?.message || 'Erro desconhecido'));
            }
        });
    }

    navegarPara(secao: string) {
        if (secao === 'agendamentos') {
            this.modalAberto = 'agendamentos';
            const activeAgendamentos = this.agendamentos.filter((a: any) => {
                return a.status === 'PENDENTE' || a.status === 'CONFIRMADO';
            });
            const currentIds = activeAgendamentos.map((a: any) => a.id);
            localStorage.setItem('seenAgendamentoIds', JSON.stringify(currentIds));
            this.badgeAgendamentosCount = 0;
        } else if (secao === 'meus-atendimentos') {
            this.modalAberto = 'atendimentos';
            const currentIds = this.atendimentosList.map((a: any) => a.id);
            localStorage.setItem('seenAtendimentoIds', JSON.stringify(currentIds));
            this.badgeMeusAtendimentosCount = 0;
        }
        this.cdr.markForCheck();
    }

    private calcularTempoEsperaReal(dataCriacao: any, inicioAtendimento?: any): string {
        if (!dataCriacao) return '0 min';
        const criacao = new Date(dataCriacao).getTime();
        const fimEspera = inicioAtendimento ? new Date(inicioAtendimento).getTime() : new Date().getTime();
        const diffMin = Math.max(0, Math.floor((fimEspera - criacao) / 60000));
        return `${diffMin} minutos`;
    }

    private formatarTempoFila(dataCriacao: any): string {
        if (!dataCriacao) return 'AGUARDE';
        const criacao = new Date(dataCriacao).getTime();
        const agora = new Date().getTime();
        const diffMin = Math.max(0, Math.floor((agora - criacao) / 60000));
        return `${diffMin} min`;
    }

    verAtendimento(atendimento: any) {
        this.atendimentoSelecionado = atendimento;
        this.cdr.markForCheck();
    }

    fecharAtendimentoDetalhe() {
        this.atendimentoSelecionado = null;
        this.showJustificativaModal = false;
        this.cdr.markForCheck();
    }

    abrirJustificativa() {
        this.showJustificativaModal = true;
        this.cdr.markForCheck();
    }

    salvarJustificativa() {
        if (this.justificativaForm.invalid) return;
        const filialId = parseInt(this.filialSelecionada, 10) || 0;
        const payload = {
            atendimentoId: this.atendimentoSelecionado?.id,
            motivo: this.justificativaForm.value.motivo,
            observacoes: this.justificativaForm.value.observacoes,
            filial_id: filialId
        };
        this.api.post<any>('/atendimento/justificativa', payload).subscribe({
            next: () => {
                this.justificativaForm.reset();
                this.showJustificativaModal = false;
                this.atendimentoSelecionado = null;
                this.cdr.markForCheck();
            },
            error: () => {
                // salva localmente mesmo sem backend para não bloquear fluxo
                this.justificativaForm.reset();
                this.showJustificativaModal = false;
                this.atendimentoSelecionado = null;
                this.cdr.markForCheck();
            }
        });
    }

    agendamentoParaCheckin: any = null;
    agendamentoParaCancelar: any = null;
    agendamentoParaResgatar: any = null;

    abrirModalCheckin(agenda: any) {
        this.agendamentoParaCheckin = agenda;
        this.cdr.markForCheck();
    }

    fecharModalCheckin() {
        this.agendamentoParaCheckin = null;
        this.cdr.markForCheck();
    }

    confirmarCheckinOperador(tipo: string) {
        if (!this.agendamentoParaCheckin) return;
        
        const filialId = this.filialSelecionada ? parseInt(this.filialSelecionada, 10) : undefined;
        const payload = {
            codigo: this.agendamentoParaCheckin.codigo,
            filialId: filialId,
            tipo: tipo,
            ignorarRegras: true
        };

        this.api.post<any>('/fila/checkin/validar', payload).subscribe({
            next: () => {
                this.fecharModalCheckin();
                this.carregarResumos();
                this.carregarFila();
                this.cdr.markForCheck();
            },
            error: (err) => {
                alert(err?.error?.message || 'Erro ao realizar check-in.');
            }
        });
    }

    abrirModalCancelar(agenda: any) {
        this.agendamentoParaCancelar = agenda;
        this.cdr.markForCheck();
    }

    fecharModalCancelar() {
        this.agendamentoParaCancelar = null;
        this.cdr.markForCheck();
    }

    confirmarCancelarAgendamento() {
        if (!this.agendamentoParaCancelar) return;
        
        this.api.delete<any>(`/fila/agendamento/${this.agendamentoParaCancelar.id}`).subscribe({
            next: () => {
                this.fecharModalCancelar();
                this.carregarResumos();
                this.cdr.markForCheck();
            },
            error: (err) => {
                alert(err?.error?.message || 'Erro ao cancelar agendamento.');
            }
        });
    }

    abrirModalResgatar(agenda: any) {
        this.agendamentoParaResgatar = agenda;
        this.cdr.markForCheck();
    }

    fecharModalResgatar() {
        this.agendamentoParaResgatar = null;
        this.cdr.markForCheck();
    }

    confirmarResgatarAgendamento() {
        if (!this.agendamentoParaResgatar) return;

        this.api.post<any>(`/fila/agendamento/${this.agendamentoParaResgatar.id}/resgatar`, {}).subscribe({
            next: () => {
                this.fecharModalResgatar();
                this.carregarResumos();
                this.carregarFila();
                this.cdr.markForCheck();
            },
            error: (err) => {
                alert(err?.error?.message || 'Erro ao resgatar agendamento.');
            }
        });
    }

    // -- Cronômetro Ocioso --
    private iniciarCronometroOcioso() {
        this.pararCronometroOcioso();
        this.ociosoIniciadoEm = Date.now();
        this.atualizarTempoOcioso();
        this.ociosoTimer = setInterval(() => {
            this.atualizarTempoOcioso();
            this.cdr.markForCheck();
        }, 1000);
    }

    private pararCronometroOcioso() {
        if (this.ociosoTimer) {
            clearInterval(this.ociosoTimer);
            this.ociosoTimer = null;
        }
        this.ociosoIniciadoEm = null;
    }

    private atualizarTempoOcioso() {
        if (!this.ociosoIniciadoEm) {
            this.tempoOciosoText = '00:00';
            return;
        }
        const segundos = Math.floor((Date.now() - this.ociosoIniciadoEm) / 1000);
        const mm = String(Math.floor(segundos / 60)).padStart(2, '0');
        const ss = String(segundos % 60).padStart(2, '0');
        if (Math.floor(segundos / 3600) > 0) {
            const hh = String(Math.floor(segundos / 3600)).padStart(2, '0');
            this.tempoOciosoText = `${hh}:${mm}:${ss}`;
        } else {
            this.tempoOciosoText = `${mm}:${ss}`;
        }
    }

    formatarTituloGuiche(numero: string | number): string {
        const limpo = String(numero).trim();
        if (/^Guich[êe]/i.test(limpo)) {
            return limpo.toUpperCase();
        }

        // Se for apenas número, adiciona GUICHÊ, senão mantém o texto como veio
        if (!isNaN(Number(limpo))) {
            return `GUICHÊ ${limpo}`;
        }
        return limpo.toUpperCase();
    }
}
