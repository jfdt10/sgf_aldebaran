import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GuicheOperador, GuicheService } from '../../../services/guiche.service';
import { AuthService } from '../../../services/auth.service';
import { FilialService, Filial } from '../../../services/filial.service';
import { ApiService } from '../../../services/api.service';
import { finalize, takeUntil, switchMap, catchError } from 'rxjs/operators';
import { Subject, of, interval } from 'rxjs';
import { LucideAngularModule, User, LogOut, Lock, Mail, Eye, EyeOff, X, Building, ChevronDown } from 'lucide-angular';

@Component({
  selector: 'app-escolha-guiches',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './escolha-guiches.html',
  styleUrls: ['./escolha-guiches.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EscolhaGuiches implements OnInit, OnDestroy {
  operadorNome = 'Operador';
  operadorPerfil = 'Operador';
  operadorAvatar = 'OP';
  operadorEmail = '';

  // Ícones
  icons = { user: User, logout: LogOut, lock: Lock, mail: Mail, eye: Eye, eyeOff: EyeOff, close: X, building: Building, chevronDown: ChevronDown };

  // Dropdown de perfil
  showProfileMenu = false;

  // Modal editar perfil
  modalAberto: string | null = null;
  operadorForm = { nome: '', email: '', login: '', senha: '', confirmarSenha: '' };
  hasRestrictedFilial = false;

  // Configurações
  filialSelecionada = '';
  idiomaAtivo = 'PT';
  carregando = false;
  mensagemErro = '';
  selecaoEmAndamentoId: number | null = null;

  guiches: GuicheOperador[] = [];
  filiais: Filial[] = [];

  // Polling de sincronização
  private destroy$ = new Subject<void>();
  private pollingAtivo = false;

  constructor(
    private router: Router,
    private guicheService: GuicheService,
    private authService: AuthService,
    private filialService: FilialService,
    private cdr: ChangeDetectorRef,
    private api: ApiService,
  ) {
    this.carregarOperador();
  }

  ngOnInit() {
    this.carregarFiliais();
    this.verificarGuicheAtual();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private iniciarPolling() {
    if (this.pollingAtivo) {
      return;
    }

    this.pollingAtivo = true;
    this.atualizarGuichesEmTempoReal();
  }

  private atualizarGuichesEmTempoReal() {
    interval(2000) // Atualiza a cada 2 segundos
      .pipe(
        switchMap(() => {
          const fid = this.filialSelecionada ? parseInt(this.filialSelecionada, 10) : undefined;
          return this.guicheService.getCurrentOperatorGuiche().pipe(
            switchMap((guicheAtual) => {
              if (guicheAtual) {
                localStorage.setItem('guicheAtual', guicheAtual.numero);
                this.router.navigate(['/operador/painel']);
                return of(null);
              }
              return this.guicheService.listOperatorGuiches(fid);
            }),
            catchError(() => of(this.guiches))
          );
        }),
        takeUntil(this.destroy$),
        catchError(() => of(this.guiches)) // Mantém lista antiga em caso de erro
      )
      .subscribe({
        next: (lista: GuicheOperador[] | null) => {
          if (lista !== null) {
            this.guiches = lista;
            this.cdr.markForCheck();
          }
        },
      });
  }

  private carregarOperador() {
    const usuarioRaw = localStorage.getItem('usuario_sgf');
    if (!usuarioRaw) {
      return;
    }

    try {
      const usuario = JSON.parse(usuarioRaw);
      this.operadorNome = usuario?.nome || 'Operador';
      this.operadorEmail = usuario?.email || '';
      this.operadorPerfil = usuario?.perfil || 'OPERADOR';

      const partes = this.operadorNome.trim().split(' ').filter(Boolean);
      if (partes.length > 1) {
        this.operadorAvatar = `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
      } else if (partes.length === 1) {
        this.operadorAvatar = partes[0].slice(0, 2).toUpperCase();
      }
    } catch {
      this.operadorNome = localStorage.getItem('usuario_nome') || 'Operador';
      this.operadorPerfil = 'OPERADOR';
    }
  }

  private verificarGuicheAtual() {
    this.carregando = true;
    this.cdr.markForCheck();

    this.guicheService.getCurrentOperatorGuiche()
      .pipe(
        finalize(() => {
          this.carregando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (guicheAtual) => {
          if (guicheAtual) {
            localStorage.setItem('guicheAtual', guicheAtual.numero);
            this.router.navigate(['/operador/painel']);
            return;
          }
          this.carregarGuiches();
        },
        error: (erro) => {
          if (erro?.status === 401 || erro?.status === 403) {
            this.authService.clearSession();
            this.router.navigate(['/login']);
            return;
          }
          this.carregarGuiches();
        },
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
          } catch {}
        }

        // Filtra para exibir apenas a filial do operador (se tiver) ou todas se for global (null)
        if (usuarioFilialId) {
          this.filiais = data.filter((f: any) => f.id === usuarioFilialId);
          this.hasRestrictedFilial = true;
        } else {
          this.filiais = data;
          this.hasRestrictedFilial = false;
        }

        // Inicializa com a filial salva se existir e for válida
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
      },
      error: (err) => {
        console.error('Erro ao listar filiais no operador:', err);
      }
    });
  }

  onFilialChange() {
    if (this.filialSelecionada) {
      this.filialService.setSelectedFilial(parseInt(this.filialSelecionada, 10));
    } else {
      this.filialService.setSelectedFilial(null);
    }
    this.carregarGuiches(); // Recarrega guichês da nova filial
  }

  private carregarGuiches() {
    this.carregando = true;
    this.mensagemErro = '';
    this.cdr.markForCheck();

    const fid = this.filialSelecionada ? parseInt(this.filialSelecionada, 10) : undefined;

    this.guicheService.listOperatorGuiches(fid)
      .pipe(
        finalize(() => {
          this.carregando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (lista) => {
          this.guiches = lista;
          this.cdr.markForCheck();
          this.iniciarPolling(); // ← Inicia polling após carregar
        },
        error: () => {
          this.mensagemErro = 'Não foi possível carregar os guichês. Tente novamente.';
          this.cdr.markForCheck();
        },
      });
  }

  selecionar(guiche: GuicheOperador) {
    if (guiche.ocupado || this.selecaoEmAndamentoId !== null) {
      return;
    }

    this.mensagemErro = '';
    this.selecaoEmAndamentoId = guiche.id;
    this.cdr.markForCheck();

    this.guicheService.selectGuiche(guiche.id)
      .pipe(
        finalize(() => {
          if (this.selecaoEmAndamentoId === guiche.id) {
            this.selecaoEmAndamentoId = null;
          }
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (guicheSelecionado) => {
          localStorage.setItem('guicheAtual', guicheSelecionado.numero);
          this.router.navigate(['/operador/painel']);
        },
        error: (erro) => {
          const mensagemBackend = erro?.error?.message;
          this.mensagemErro =
            typeof mensagemBackend === 'string'
              ? mensagemBackend
              : 'Guichê em Uso. Selecione Outro Guichê Disponível.';
          this.cdr.markForCheck();

          // Recarrega imediatamente para mostrar que guichê foi ocupado
          setTimeout(() => {
            this.atualizarListaGuichesAgora();
          }, 300);
        },
      });
  }

  private atualizarListaGuichesAgora() {
    const fid = this.filialSelecionada ? parseInt(this.filialSelecionada, 10) : undefined;
    this.guicheService.listOperatorGuiches(fid)
      .pipe(
        catchError(() => of(this.guiches))
      )
      .subscribe({
        next: (lista: GuicheOperador[]) => {
          this.guiches = lista;
          this.cdr.markForCheck();
        },
      });
  }

  trocarIdioma(idioma: string) {
    this.idiomaAtivo = idioma;
  }

  toggleProfileMenu(event: Event) {
    event.stopPropagation();
    this.showProfileMenu = !this.showProfileMenu;
    this.cdr.markForCheck();
  }

  @HostListener('document:click')
  onClickOutside() {
    if (this.showProfileMenu) {
      this.showProfileMenu = false;
      this.cdr.markForCheck();
    }
  }

  abrirEditarPerfil() {
    this.showProfileMenu = false;
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
      } catch {}
    }
    this.modalAberto = 'editar-perfil';
    this.cdr.markForCheck();
  }

  fecharModal() {
    this.modalAberto = null;
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
    if (!salvo) { alert('Erro: operador não encontrado.'); return; }

    let user: any;
    try { user = JSON.parse(salvo); } catch { alert('Erro ao processar dados da sessão.'); return; }

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
        this.operadorNome = updatedUser.nome;
        this.operadorEmail = updatedUser.email || '';

        const partes = this.operadorNome.trim().split(' ').filter(Boolean);
        if (partes.length > 1) {
          this.operadorAvatar = `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
        } else if (partes.length === 1) {
          this.operadorAvatar = partes[0].slice(0, 2).toUpperCase();
        }

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

  formatarTituloGuiche(numero: string): string {
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

  sair() {
    this.showProfileMenu = false;
    this.modalAberto = 'sair';
    this.cdr.markForCheck();
  }

  confirmarSair() {
    this.modalAberto = null;
    this.carregando = true;
    this.cdr.markForCheck();

    this.guicheService.releaseCurrentGuiche()
      .pipe(
        finalize(() => {
          this.carregando = false;
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
        },
      });
  }
}
