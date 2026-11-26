import { LanguageService } from '../../services/language.service';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Subscription, interval } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { ActivatedRoute, Router } from '@angular/router';
import { PainelConfigService } from '../../services/painel-config.service';

@Component({
  selector: 'app-painel-tv',
  standalone: true,
  imports: [TranslatePipe, CommonModule, DatePipe],
  templateUrl: './painel-tv.component.html',
  styleUrls: ['./painel-tv.component.scss']
})
export class PainelTvComponent implements OnInit, OnDestroy {
  readonly language = inject(LanguageService);
  dataAtual = new Date();
  dataAtualTexto = '';
  senhaAtual: any = null;
  ultimasChamadas: any[] = [];
  readonly idiomas = ['PT', 'EN'];
  categoriasServico: any[] = [];
  filialId: number | null = null;
  configurado = false;

  private subs: Subscription[] = [];
  private socket: Socket | null = null;
  private isInitialLoad = true;

  private ultimoIdChamado: string | null = null;
  exibirAlerta = false;
  iniciado = false;

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private configService: PainelConfigService,
  ) { }

  ngOnInit() {
    this.atualizarDataHora();
    this.subs.push(
      interval(1000).subscribe(() => {
        this.atualizarDataHora();
        this.cdr.detectChanges();
      }),
      interval(3000).subscribe(() => {
        if (this.iniciado && this.configurado) {
          this.atualizar();
        }
      })
    );
    this.route.queryParamMap.subscribe(params => {
      const fidParam = params.get('filialId');
      const fidConfig = this.configService.getFilialId();
      this.filialId = fidParam ? Number(fidParam) : fidConfig;
      this.configurado = !!this.filialId;

      if (!this.configurado) {
        this.router.navigate(['/painel/setup']);
        return;
      }

      if (this.configurado) {
        this.carregarCategorias();
        if (this.iniciado) {
          this.atualizar();
        }
      }
    });
    this.conectarWebSocket();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && this.configurado && !this.iniciado) {
      this.iniciarPainel();
    }
  }

  iniciarPainel() {
    if (!this.configurado) return;
    this.iniciado = true;

    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        const audioCtx = new AudioContextCtor();
        audioCtx.resume();
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance('');
        msg.volume = 0;
        window.speechSynthesis.speak(msg);
      }
    } catch (e) { }

    this.atualizar();
  }

  private conectarWebSocket() {
    this.socket = io(environment.apiUrl, {
      query: { panelType: 'GERAL' },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      if (!environment.production) console.log('[Painel-TV] WebSocket conectado!');
      if (this.iniciado && this.configurado) {
        this.atualizar();
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Painel-TV] Falha WebSocket:', err?.message || err);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[Painel-TV] WebSocket desconectado:', reason);
    });

    this.socket.on('ticket_called', (payload: any) => {
      if (this.iniciado && this.configurado) {
        const deveForcar = !!payload;
        this.atualizar(deveForcar, payload);
      }
    });
  }

  private carregarCategorias() {
    if (!this.filialId) {
      this.categoriasServico = [];
      return;
    }
    const query = this.filialId ? `?filialId=${this.filialId}` : '';
    this.apiService.get<any[]>(`/servicos/public/list${query}`).subscribe({
      next: (dados) => {
        if (dados) {
          this.categoriasServico = dados.filter(s => s.ativo);
        }
      },
      error: (err) => {
        console.error('[Painel-TV] Erro ao carregar categorias:', err);
      },
    });
  }

  private atualizarDataHora() {
    this.dataAtual = new Date();
    this.dataAtualTexto = this.dataAtual.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.socket) {
      this.socket.disconnect();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  atualizar(forceAlert = false, payload?: any) {
    if (!this.filialId) return;
    const query = this.filialId ? `?filialId=${this.filialId}` : '';
    this.apiService.get<any[]>(`/fila/painel${query}`).subscribe({
      next: (dados) => {
        if (dados && dados.length > 0) {

          if (forceAlert && payload && payload.ticketId) {
            const idxEncontrado = dados.findIndex(
              d => String(d.id) === String(payload.ticketId) || String(d.numero) === String(payload.ticketId)
            );

            if (idxEncontrado >= 0) {
              const novaSenha = dados[idxEncontrado];
              dados.splice(idxEncontrado, 1);
              this.senhaAtual = novaSenha;
              this.ultimasChamadas = dados.slice(0, 5);
              this.dispararAlertaNovaChamada();
              this.isInitialLoad = false;
              this.cdr.detectChanges();
              return;
            }
          }

          {
            if (!this.senhaAtual) {
              this.senhaAtual = dados.shift();
            } else {
              const idxEncontrado = dados.findIndex(
                d => String(d.id) === String(this.senhaAtual.id) || String(d.numero) === String(this.senhaAtual.numero)
              );
              if (idxEncontrado >= 0) {
                this.senhaAtual = dados[idxEncontrado];
                dados.splice(idxEncontrado, 1);
              } else {
                this.senhaAtual = dados.shift();
              }
            }
            this.ultimasChamadas = dados.slice(0, 5);

            const novoId = this.senhaAtual.id || this.senhaAtual.numero || this.senhaAtual.senha;
            if (!!this.ultimoIdChamado && this.ultimoIdChamado !== novoId || !this.ultimoIdChamado) {
              this.ultimoIdChamado = novoId;
            }
          }
        } else {
          if (this.isInitialLoad) {
            this.senhaAtual = null;
            this.ultimasChamadas = [];
          }
        }
        this.isInitialLoad = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Painel-TV] Erro ao atualizar painel:', err);
      },
    });
  }

  playAlertaSonoro() {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const audioCtx = new AudioContextCtor();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);

      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.error('AudioContext error:', e);
    }
  }

  dispararAlertaNovaChamada() {
    this.ultimoIdChamado = this.senhaAtual.id || this.senhaAtual.numero || this.senhaAtual.senha;
    this.exibirAlerta = true;

    this.playAlertaSonoro();

    setTimeout(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const numeroRaw = this.getSenhaNumero(this.senhaAtual);
        const numeroBase = numeroRaw.replace(/[^A-Za-z0-9]/g, '');
        const numero = numeroBase.split('').join(', ');

        const destinoTipo = this.getGuicheDestinoTipo(this.senhaAtual).toLowerCase();
        const destinoValor = this.getGuicheDestinoValor(this.senhaAtual);
        const destino = destinoValor && destinoValor !== '--'
          ? `${destinoTipo} ${destinoValor}`
          : destinoTipo;

        const mensagem = new SpeechSynthesisUtterance(`Senha. ${numero}, Dirija-se ao, ${destino}.`);
        mensagem.lang = this.language.current() === 'EN' ? 'en' : 'pt-BR';
        mensagem.rate = 0.85;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(mensagem);
      }
    }, 800);

    setTimeout(() => {
      this.exibirAlerta = false;
    }, 8000);
  }

  getSenhaNumero(item: any): string {
    return item?.numero || item?.senha || '---';
  }

  getServicoNome(item: any): string {
    return item?.servico?.nome || item?.categoria || '---';
  }

  getServicoCor(item: any): string {
    return item?.servico?.cor || '#00838f';
  }

  getGuiche(item: any): string {
    return String(item?.guiche || item?.guicheNumero || '--');
  }

  getGuicheDestinoTipo(item: any): string {
    const g = this.getGuiche(item).trim();
    if (g === '--') return 'GUICHÊ';
    const parts = g.split(' ');
    return parts.length > 1 ? parts.slice(0, -1).join(' ').toUpperCase() : 'GUICHÊ';
  }

  getGuicheDestinoValor(item: any): string {
    const g = this.getGuiche(item).trim();
    if (g === '--') return '--';
    const parts = g.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : g;
  }

  irParaConfiguracao() {
    this.router.navigate(['/painel/setup']);
  }
}