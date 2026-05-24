import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Edit2, Trash2, Search, Plus, X, CheckCircle } from 'lucide-angular';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { FilialService } from '../../../services/filial.service';
import { environment } from '../../../../environments/environment';
import { SettingsLinkItemComponent } from '../../client/configuracoes/components/settings-link-item/settings-link-item.component';
import { SettingsSectionCardComponent } from '../../client/configuracoes/components/settings-section-card/settings-section-card.component';

@Component({
  selector: 'app-supervisor-configuracoes',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ReactiveFormsModule, RouterLink, FormsModule, SettingsSectionCardComponent, SettingsLinkItemComponent],
  templateUrl: './configuracoes.component.html',
  styleUrls: ['./configuracoes.component.scss']
})
export class SupervisorConfiguracoesComponent implements OnInit {
  currentTab = 'geral';
  configForm!: FormGroup;
  novoUsuarioForm!: FormGroup;
  usuarioModal = false;
  isEditingUsuario = false;
  usuarioEmEdicao: any = null;
  showZerarModal = false;
  zerarInput = '';
  showSuccessModal = false;
  successMessage = '';

  usuarios: any[] = [];
  filteredUsuarios: any[] = [];
  filtroUsuario = '';
  perfilFiltro = '';

  icons = { edit: Edit2, trash: Trash2, search: Search, plus: Plus, x: X, check: CheckCircle };

  tabs = [
    { id: 'geral', label: 'Geral' },
    { id: 'regras', label: 'Regras da Fila' },
    { id: 'notificacoes', label: 'Notificações' },
    { id: 'usuarios', label: 'Gestão de Usuários' },
    { id: 'legal', label: 'Legal' }
  ];

  selectedFilialId: number | null = null;
  private filialSub?: any;
  private filiaisSub?: any;
  filiais: any[] = [];
  
  servicosDisponiveis: any[] = [];
  categoriasSom: number[] = [];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private filialService: FilialService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.configForm = this.fb.group({
      nomeFilial: [{ value: '', disabled: true }],
      fusoHorario: ['(GMT-03:00) Brasília'],
      modoEscuro: [false],
      sonsAlerta: [true],
      impressaoAutomatica: [true],

      // Regras da Fila
      tempoTolerancia: [15],
      limiteAtendimentos: [50],
      prioridadePcdIdoso: [true],
      redirecionarAusentes: [false],
      eficienciaMinima: [90],

      // Notificações
      notificarEmail: [true],
      notificarWhatsapp: [false]
    });

    this.novoUsuarioForm = this.fb.group({
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      perfil: ['OPERADOR', Validators.required],
      senha: ['', Validators.minLength(6)],
      confirmarSenha: ['']
    }, { validators: this.senhasIguais });

    this.filialSub = this.filialService.selectedFilial$.subscribe((id: number | null) => {
      this.selectedFilialId = id;
      if (id) {
        this.configForm.get('nomeFilial')?.enable();
        this.carregarConfiguracoes();
        this.carregarUsuarios();
      } else {
        this.configForm.get('nomeFilial')?.disable();
        this.configForm.patchValue({ nomeFilial: '' });
        this.usuarios = [];
        this.filteredUsuarios = [];
      }
    });
  }

  ngOnDestroy() {
    if (this.filialSub) this.filialSub.unsubscribe();
  }

  carregarConfiguracoes() {
    const token = localStorage.getItem('token') || '';
    this.http.get<any[]>(`${environment.apiUrl}/configuracoes/lista?filialId=${this.selectedFilialId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (configs) => {
        const patch: any = {};
        configs.forEach(c => {
          if (c.chave === 'tempoTolerancia' || c.chave === 'TEMPO_TOLERANCIA') patch.tempoTolerancia = parseInt(c.valor, 10);
          if (c.chave === 'limiteAtendimentosDia' || c.chave === 'LIMITE_ATENDIMENTOS') patch.limiteAtendimentos = parseInt(c.valor, 10);
          if (c.chave === 'prioridadeAutomatica' || c.chave === 'PRIORIDADE_AUTOMATICA') patch.prioridadePcdIdoso = c.valor === 'true';
          if (c.chave === 'SONS_ALERTA') patch.sonsAlerta = c.valor === 'true';
          if (c.chave === 'SONS_ALERTA_CATEGORIAS') {
            try { this.categoriasSom = JSON.parse(c.valor); } catch (e) {}
          }
          if (c.chave === 'redirecionarAusentes' || c.chave === 'REDIRECIONAR_AUSENTES') patch.redirecionarAusentes = c.valor === 'true';
          if (c.chave === 'eficienciaMinima' || c.chave === 'EFICIENCIA_MINIMA') patch.eficienciaMinima = parseInt(c.valor, 10);
          if (c.chave === 'NOTIFICAR_EMAIL') patch.notificarEmail = c.valor === 'true';
          if (c.chave === 'NOTIFICAR_WHATSAPP') patch.notificarWhatsapp = c.valor === 'true';
        });

        // Carregar categorias (servicos)
        this.http.get<any[]>(`${environment.apiUrl}/servicos?filialId=${this.selectedFilialId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe(servicos => {
          this.servicosDisponiveis = servicos;
          if (this.categoriasSom.length === 0 && servicos.length > 0) {
             this.categoriasSom = servicos.map(s => s.id);
          }
        });

        // Carrega nome da filial
        this.filialService.getFiliais().subscribe((filiais: any[]) => {
          const f = filiais.find((fl: any) => fl.id === this.selectedFilialId);
          if (f) patch.nomeFilial = f.nome;
          this.configForm.patchValue(patch);
          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error('Erro ao carregar configurações:', err)
    });
  }

  senhasIguais(group: FormGroup) {
    const senha = group.get('senha')?.value;
    const confirmar = group.get('confirmarSenha')?.value;
    return senha === confirmar ? null : { senhasDiferentes: true };
  }

  getTabLabel(id: string) {
    return this.tabs.find(t => t.id === id)?.label;
  }

  setTab(tabId: string) {
    this.currentTab = tabId;
  }

  openLegalDocument(type: 'terms' | 'privacy'): void {
    const route =
      type === 'terms'
        ? '/supervisor/configuracoes/termos-de-uso'
        : '/supervisor/configuracoes/politica-de-privacidade';

    this.router.navigate([route]);
  }

  salvarConfiguracoes() {
    this.persistirConfiguracoes();
  }

  salvarRegras() {
    this.persistirConfiguracoes();
  }

  salvarNotificacoes() {
    this.persistirConfiguracoes();
  }

  private persistirConfiguracoes() {
    const vals = this.configForm.value;
    const payload = {
      filial_id: this.selectedFilialId,
      configs: [
        { chave: 'tempoTolerancia', valor: String(vals.tempoTolerancia) },
        { chave: 'limiteAtendimentosDia', valor: String(vals.limiteAtendimentos) },
        { chave: 'prioridadeAutomatica', valor: String(vals.prioridadePcdIdoso) },
        { chave: 'redirecionarAusentes', valor: String(vals.redirecionarAusentes) },
        { chave: 'eficienciaMinima', valor: String(vals.eficienciaMinima || 90) },
        { chave: 'FUSO_HORARIO', valor: vals.fusoHorario },
        { chave: 'MODO_ESCURO', valor: String(vals.modoEscuro) },
        { chave: 'SONS_ALERTA', valor: String(vals.sonsAlerta) },
        { chave: 'SONS_ALERTA_CATEGORIAS', valor: JSON.stringify(this.categoriasSom) },
        { chave: 'IMPRESSAO_AUTOMATICA', valor: String(vals.impressaoAutomatica) },
        { chave: 'NOTIFICAR_EMAIL', valor: String(vals.notificarEmail) },
        { chave: 'NOTIFICAR_WHATSAPP', valor: String(vals.notificarWhatsapp) }
      ]
    };

    const token = localStorage.getItem('token') || '';

    if (this.selectedFilialId && vals.nomeFilial) {
      this.http.patch(`${environment.apiUrl}/filiais/${this.selectedFilialId}`, { nome: vals.nomeFilial }, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: () => {
          this.filialService.fetchFiliais().subscribe();
        },
        error: (err) => console.error('Erro ao atualizar nome da filial', err)
      });
    }

    this.http.post(`${environment.apiUrl}/configuracoes/bulk?filialId=${this.selectedFilialId}`, { configs: payload.configs }, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.showSuccessModal = true;
        this.successMessage = 'Configurações salvas com sucesso!';
        this.filialService.setSelectedFilial(this.selectedFilialId);
        this.cdr.detectChanges();
      },
      error: (err) => alert('Erro ao salvar configurações')
    });
  }

  toggleCategoriaSom(servicoId: number, event: any) {
    const checked = event.target.checked;
    if (checked) {
      if (!this.categoriasSom.includes(servicoId)) {
        this.categoriasSom.push(servicoId);
      }
    } else {
      this.categoriasSom = this.categoriasSom.filter(id => id !== servicoId);
    }
  }

  fecharSuccessModal() {
    this.showSuccessModal = false;
    this.successMessage = '';
  }

  zerarFila() {
    this.showZerarModal = true;
    this.zerarInput = '';
  }

  confirmarZerar() {
    if (this.zerarInput.trim().toUpperCase() === 'ZERAR') {
      const token = localStorage.getItem('token') || '';
      this.http.post(`${environment.apiUrl}/fila/zerar`, { filialId: this.selectedFilialId }, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: () => {
          this.showZerarModal = false;
          this.zerarInput = '';
          this.showSuccessModal = true;
          this.successMessage = 'Fila zerada com sucesso. Numeração reiniciada.';
          this.filialService.setSelectedFilial(this.selectedFilialId);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Erro ao zerar fila', err);
          alert('Erro ao zerar fila. Tente novamente.');
        }
      });
    }
  }

  cancelarZerar() {
    this.showZerarModal = false;
    this.zerarInput = '';
  }

  abrirModalUsuario(usuario?: any) {
    this.usuarioModal = true;
    this.isEditingUsuario = !!usuario;
    this.usuarioEmEdicao = usuario || null;

    if (usuario) {
      this.novoUsuarioForm.patchValue({
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        senha: '',
        confirmarSenha: ''
      });
    } else {
      this.usuarioEmEdicao = null;
      this.novoUsuarioForm.reset({ perfil: 'OPERADOR' });
    }
  }

  fecharModalUsuario() {
    this.usuarioModal = false;
    this.isEditingUsuario = false;
    this.usuarioEmEdicao = null;
    this.novoUsuarioForm.reset({ perfil: 'OPERADOR' });
  }

  carregarUsuarios() {
    if (!this.selectedFilialId) {
      this.usuarios = [];
      this.filteredUsuarios = [];
      return;
    }

    const token = localStorage.getItem('token') || '';
    const filialQuery = `?filialId=${this.selectedFilialId}`;

    this.http.get<any[]>(`${environment.apiUrl}/usuarios${filialQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios.filter((u: any) => u.perfil !== 'ADMIN');
        this.aplicarFiltros();
      },
      error: (err) => {
        console.error('Erro ao carregar usuários:', err);
        this.usuarios = [];
        this.filteredUsuarios = [];
      }
    });
  }

  aplicarFiltros() {
    const termo = this.filtroUsuario?.toLowerCase().trim();
    this.filteredUsuarios = this.usuarios.filter((u: any) => {
      const combinacao = `${u.nome} ${u.email} ${u.login}`.toLowerCase();
      const correspondeFiltro = !this.perfilFiltro || u.perfil === this.perfilFiltro;
      const correspondeBusca = !termo || combinacao.includes(termo);
      return correspondeFiltro && correspondeBusca;
    });
  }

  buscarUsuarios() {
    this.aplicarFiltros();
  }

  salvarUsuario() {
    const val = this.novoUsuarioForm.value;

    if (!this.isEditingUsuario) {
      if (!val.senha || val.senha.length < 6) {
        alert('A senha é obrigatória e deve ter no mínimo 6 caracteres.');
        return;
      }
      if (val.senha !== val.confirmarSenha) {
        alert('As senhas não coincidem.');
        return;
      }
    } else {
      if (val.senha && val.senha.length < 6) {
        alert('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (val.senha && val.senha !== val.confirmarSenha) {
        alert('As senhas não coincidem.');
        return;
      }
    }

    const payload: any = {
      nome: val.nome,
      email: val.email,
      login: val.email.split('@')[0],
      perfil: val.perfil,
      filial_id: this.selectedFilialId,
    };

    const token = localStorage.getItem('token') || '';

    const finish = (message: string) => {
      this.fecharModalUsuario();
      this.showSuccessModal = true;
      this.successMessage = message;
      this.carregarUsuarios();
      this.cdr.detectChanges();
    };

    if (this.isEditingUsuario && this.usuarioEmEdicao) {
      this.http.patch(`${environment.apiUrl}/usuarios/${this.usuarioEmEdicao.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: () => {
          if (val.senha) {
            this.http.patch(`${environment.apiUrl}/usuarios/${this.usuarioEmEdicao.id}/senha`, { senha: val.senha }, {
              headers: { Authorization: `Bearer ${token}` }
            }).subscribe({
              next: () => finish(`Usuário "${val.nome}" atualizado com sucesso!`),
              error: (err) => {
                console.error('Erro ao atualizar senha', err);
                alert(err.error?.message || 'Erro ao atualizar senha.');
              }
            });
          } else {
            finish(`Usuário "${val.nome}" atualizado com sucesso!`);
          }
        },
        error: (err) => {
          console.error('Erro ao atualizar usuário', err);
          alert(err.error?.message || 'Erro ao atualizar usuário.');
        }
      });
    } else {
      payload.senha = val.senha;
      this.http.post(`${environment.apiUrl}/usuarios`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: () => finish(`Usuário "${val.nome}" criado com sucesso!`),
        error: (err) => {
          console.error('Erro ao criar usuário', err);
          alert(err.error?.message || 'Erro ao criar usuário.');
        }
      });
    }
  }

  alternarStatus(id: number, ativo: boolean) {
    const acao = ativo ? 'inativar' : 'ativar';
    if (!confirm(`Tem certeza que deseja ${acao} este usuário?`)) return;

    const token = localStorage.getItem('token') || '';
    this.http.patch(`${environment.apiUrl}/usuarios/${id}/status`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.carregarUsuarios();
      },
      error: (err) => {
        console.error('Erro ao alterar status do usuário', err);
        alert('Erro ao alterar status do usuário.');
      }
    });
  }

  excluirUsuario(id: number, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${nome}"? Esta ação é irreversível.`)) return;

    const token = localStorage.getItem('token') || '';
    this.http.delete(`${environment.apiUrl}/usuarios/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.showSuccessModal = true;
        this.successMessage = `Usuário "${nome}" excluído com sucesso.`;
        this.carregarUsuarios();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao excluir usuário', err);
        alert(err.error?.message || 'Erro ao excluir usuário.');
      }
    });
  }
}
