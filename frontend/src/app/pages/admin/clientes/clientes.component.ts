import { LanguageService } from '../../../services/language.service';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { Component, OnInit, HostListener, ChangeDetectorRef, OnDestroy, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Plus, Filter, User, Users, Building, Phone, Edit2, AlertCircle, X, ShieldAlert, Check, Calendar, Trash2, CheckCircle } from 'lucide-angular';
import { Subscription } from 'rxjs';
import { AdminLayoutComponent } from '../../../layouts/admin-layout/admin-layout.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [TranslatePipe, CommonModule, FormsModule, LucideAngularModule],
  providers: [DatePipe],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss']
})
export class ClientesComponent implements OnInit, OnDestroy {
  private readonly language = inject(LanguageService);
  readonly icons = { search: Search, plus: Plus, filter: Filter, user: User, users: Users, building: Building, phone: Phone, edit: Edit2, alertCircle: AlertCircle, x: X, shieldAlert: ShieldAlert, check: Check, calendar: Calendar, trash2: Trash2, checkCircle: CheckCircle };

  clientes: any[] = [];
  loading = true;
  filtro = '';
  filtroStatus: 'TODOS' | 'ATIVOS' | 'INATIVOS' = 'TODOS';

  showModal = false;
  showSuccessModal = false;
  isEditing = false;
  passwordTarget?: { id: string; nome: string };
  tempPassword = '';
  identityConfirmed = false;
  savingPassword = false;
  passwordResult: 'success' | 'error' | '' = '';

  clienteForm = {
    id: null as number | null,
    nome: '',
    email: '',
    tipo: 'PF',
    cpf: '',
    cnpj: '',
    telefone: '',
    endereco: '',
    ativo: true,
    senha: '',
    filial_id: null as number | null
  };
  selectedFilialId: number | null = null;

  private searchSub?: Subscription;

  constructor(
    private api: ApiService, 
    private datePipe: DatePipe, 
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    @Optional() private layout?: AdminLayoutComponent
  ) { }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
        const fid = params.get('filialId');
        this.selectedFilialId = fid ? Number(fid) : null;
        this.carregarClientes();
    });

    if (this.layout) {
      this.searchSub = this.layout.globalSearch$.subscribe((term: string) => {
        this.filtro = term;
        this.carregarClientes();
      });
    }
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  carregarClientes() {
    this.loading = true;
    const filialQuery = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
    this.api.get<any[]>(`/clientes${filialQuery}`).subscribe({
      next: (data) => {
        let filtrados = data;

        if (this.filtro) {
          const termo = this.filtro.toLowerCase();
          filtrados = filtrados.filter(c =>
            c.nome.toLowerCase().includes(termo) ||
            (c.cpf && c.cpf.includes(termo)) ||
            (c.cnpj && c.cnpj.includes(termo)) ||
            (c.email && c.email.toLowerCase().includes(termo))
          );
        }

        if (this.filtroStatus === 'ATIVOS') {
          filtrados = filtrados.filter(c => c.deletedAt === null);
        } else if (this.filtroStatus === 'INATIVOS') {
          filtrados = filtrados.filter(c => c.deletedAt !== null);
        }

        this.clientes = filtrados;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar clientes', err);
        if (err.status === 401) alert(this.language.text("Sessão expirada ou usuário não autenticado."));
        this.loading = false;
      }
    });
  }

  checkDocumento() {
    const cpf = this.clienteForm.tipo === 'PF' ? this.clienteForm.cpf : '';
    const cnpj = this.clienteForm.tipo === 'PJ' ? this.clienteForm.cnpj : '';
    
    if ((this.clienteForm.tipo === 'PF' && cpf.length === 11) || (this.clienteForm.tipo === 'PJ' && cnpj.length === 14)) {
      this.api.get<{exists: boolean}>(`/clientes/check`, {
        cpf, cnpj
      }).subscribe(res => {
        if (res.exists) {
            alert(`${this.clienteForm.tipo === 'PF' ? 'CPF' : 'CNPJ'} já cadastrado no sistema!`);
        }
      });
    }
  }

  abrirModalNovo() {
    this.isEditing = false;
    this.clienteForm = { id: null, nome: '', email: '', tipo: 'PF', cpf: '', cnpj: '', telefone: '', endereco: '', ativo: true, senha: '', filial_id: this.selectedFilialId };
    this.showModal = true;
  }

  abrirModalEditar(cliente: any) {
    this.isEditing = true;
    this.clienteForm = { ...cliente, senha: '' };
    if (!this.clienteForm.tipo) this.clienteForm.tipo = (cliente.cnpj) ? 'PJ' : 'PF';
    this.showModal = true;
  }

  fecharModal() {
    this.showModal = false;
    this.showSuccessModal = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: Event) {
    if (this.showModal || this.showSuccessModal) {
      this.fecharModal();
    }
  }

  salvar() {
    if (!this.clienteForm.nome || !this.clienteForm.email) {
      alert(this.language.text("Nome e E-mail são obrigatórios!"));
      return;
    }
    if (this.clienteForm.tipo === 'PF' && !this.clienteForm.cpf) {
      alert(this.language.text("CPF é obrigatório para Pessoa Física.")); return;
    }
    if (this.clienteForm.tipo === 'PJ' && !this.clienteForm.cnpj) {
      alert(this.language.text("CNPJ é obrigatório para Pessoa Jurídica.")); return;
    }

    const payload: any = {
      nome: this.clienteForm.nome,
      email: this.clienteForm.email,
      tipo: this.clienteForm.tipo,
      telefone: this.clienteForm.telefone,
      endereco: this.clienteForm.endereco,
      ativo: this.clienteForm.ativo,
      filial_id: this.clienteForm.filial_id ? Number(this.clienteForm.filial_id) : null
    };
    if (this.clienteForm.tipo === 'PF') payload.cpf = this.clienteForm.cpf;
    if (this.clienteForm.tipo === 'PJ') payload.cnpj = this.clienteForm.cnpj;

    if (!this.isEditing && this.clienteForm.senha) {
      payload.senha = this.clienteForm.senha;
    }

    if (this.isEditing) {
      this.api.put(`/clientes/${this.clienteForm.id}`, payload)
        .subscribe({
          next: () => {
            this.showModal = false;
            this.showSuccessModal = true;
            this.carregarClientes();
            this.cdr.detectChanges();
          },
          error: (err) => this.handleError(err, 'Erro ao atualizar.')
        });
    } else {
      this.api.post('/clientes', payload)
        .subscribe({
          next: () => {
            this.showModal = false;
            this.showSuccessModal = true;
            this.carregarClientes();
            this.cdr.detectChanges();
          },
          error: (err) => this.handleError(err, 'Erro ao criar cliente.')
        });
    }
  }

  abrirRedefinicao(cliente: { id: string; nome: string }) {
    this.passwordTarget = cliente;
    this.tempPassword = '';
    this.identityConfirmed = false;
    this.passwordResult = '';
  }

  redefinirAcesso() {
    const id = this.passwordTarget?.id;
    if (!id || !this.identityConfirmed || this.tempPassword.length < 8 || this.savingPassword) return;
    this.savingPassword = true;
    this.api.patch('/clientes/' + id + '/senha', { senha: this.tempPassword }).subscribe({
      next: () => {
        this.passwordTarget = undefined;
        this.tempPassword = '';
        this.passwordResult = 'success';
        this.savingPassword = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.passwordResult = 'error';
        this.savingPassword = false;
        this.cdr.detectChanges();
      },
    });
  }

  alternarStatus(id: string) {
    this.api.patch(`/clientes/${id}/status`, {})
      .subscribe({
        next: () => {
            this.carregarClientes();
            this.cdr.detectChanges();
        },
        error: (err) => console.error('Erro ao alterar status', err)
      });
  }

  private handleError(err: any, defaultMsg: string) {
    console.error(defaultMsg, err);
    alert(err.error?.message || defaultMsg);
  }

  isAtivo(cliente: any): boolean {
    return cliente.deletedAt === null;
  }

  getDocument(cliente: any): string {
    if (cliente.cpf) return `CPF: ${cliente.cpf}`;
    if (cliente.cnpj) return `CNPJ: ${cliente.cnpj}`;
    return 'Sem Doc';
  }
}