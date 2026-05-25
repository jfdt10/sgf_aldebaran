import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, LayoutDashboard, Ticket, Settings, Monitor, LogOut, Menu, Users, Calendar, Truck, User, Bell, Search, ChevronDown, ChevronUp, FileText, Moon, Power, History, Clock, UserPlus, CheckCircle, X, Building2, ChevronRight, AlignLeft } from 'lucide-angular';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { NavigationEnd, ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { FormsModule } from '@angular/forms';
import { FilialService, Filial } from '../../services/filial.service';
import { DashboardService } from '../../services/dashboard.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AlertSoundService } from '../../services/alert-sound.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, FormsModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = true;
  usuario: any = null;
  userInitials: string = 'CA';
  userName: string = 'Carlos Admin';
  userRole: string = 'Administrador';

  globalSearchQuery = '';
  globalSearch$ = new Subject<string>();

  filiais: Filial[] = [];
  selectedFilialId: number | null = null;
  loadingFiliais = false;

  showProfileMenu = false;
  showSupervisorProfileMenu = false;
  showNotifications = false;
  showLogoutModal = false;
  isDarkMode = false;
  activePageTitle = 'Dashboard';
  activePageGroup = 'Home';

  notificacoes: any[] = [];
  hasUnreadNotifications = false;

  // Contador para badges do Supervisor
  atendimentoCount = 0;
  agendamentoCount = 0;

  get notificacoesFiltradas() {
    return this.notificacoes.filter(n => !n.lida);
  }

  isFilialRestrita(): boolean {
    const role = (this.usuario?.perfil || this.usuario?.tipo || '').toString().toUpperCase();
    return Boolean(this.usuario?.filial_id) && (role === 'ADMIN' || role === 'SUPERVISOR');
  }

  readonly icons: Record<string, any> = {
    dashboard: LayoutDashboard,
    ticket: Ticket,
    settings: Settings,
    monitor: Monitor,
    logout: LogOut,
    menu: Menu,
    user: User,
    users: Users,
    calendar: Calendar,
    truck: Truck,
    bell: Bell,
    search: Search,
    chevronDown: ChevronDown,
    chevronUp: ChevronUp,
    fileText: FileText,
    moon: Moon,
    power: Power,
    history: History,
    clock: Clock,
    userPlus: UserPlus,
    checkCircle: CheckCircle,
    x: X,
    building: Building2,
    chevronRight: ChevronRight,
    alignLeft: AlignLeft
  };

  menuGroups: any[] = [];

  adminMenuGroups = [
    {
      title: 'PRINCIPAL',
      items: [
        { path: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' }
      ]
    },
    {
      title: 'GESTÃO',
      items: [
        { path: '/admin/cadastros', label: 'Cadastros Gerais', icon: 'users' },
        { path: '/admin/servicos', label: 'Estrutura & Filiais', icon: 'building' },
        { path: '/admin/logs', label: 'Logs e Auditoria', icon: 'fileText' }
      ]
    },
    {
      title: 'SISTEMA',
      items: [
        { path: '/admin/configuracoes', label: 'Configurações', icon: 'settings' },
        { path: '/painel', label: 'Painel TV', icon: 'monitor' },
        { path: '/totem', label: 'Modo Totem', icon: 'monitor', external: true }
      ]
    }
  ];

  supervisorMenuGroups = [
    {
      title: 'SISTEMA',
      items: [
        { path: '/supervisor/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { path: '/supervisor/relatorios', label: 'Ver Relatórios', icon: 'fileText' },
        { path: '/supervisor/gerenciar-fila', label: 'Gerenciar Fila', icon: 'monitor' },
        { path: '/supervisor/configuracoes', label: 'Configurações', icon: 'settings' }
      ]
    }
  ];

  constructor(
    private router: Router,
    private titleService: Title,
    private notificationService: NotificationService,
    private filialService: FilialService,
    private dashboardService: DashboardService,
    private http: HttpClient,
    private alertSoundService: AlertSoundService
  ) { }

  ngOnInit() {
    const salvo = localStorage.getItem('usuario_sgf');
    if (!salvo) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.usuario = JSON.parse(salvo);

      this.notificationService.fetchNotifications(this.usuario.id);
      this.notificationService.notifications$.subscribe((notifs: any[]) => {
        this.notificacoes = notifs;
        this.hasUnreadNotifications = notifs.some(n => !n.lida);
      });

      if (this.usuario.iniciais) {
        this.userInitials = this.usuario.iniciais;
      } else {
        const fallbackName = this.usuario.nome || 'Administrador';
        this.userInitials = fallbackName.length >= 2 ? fallbackName.substring(0, 2).toUpperCase() : 'AD';
      }

      // Determinar Perfil e Role
      const p = (this.usuario.perfil || '').toUpperCase();
      const t = (this.usuario.tipo || '').toUpperCase();

      if (p === 'SUPERVISOR' || t === 'SUPERVISOR') {
        this.menuGroups = this.supervisorMenuGroups;
        this.userRole = 'Supervisor';
      } else if (p === 'ADMIN' || t === 'ADMIN') {
        this.menuGroups = this.adminMenuGroups;
        this.userRole = 'Administrador';
      } else {
        this.menuGroups = this.adminMenuGroups;
        this.userRole = this.usuario.perfil || 'Usuário';
      }

      // Sincronização de Filiais (Global)
      this.filialService.selectedFilial$.subscribe((id: number | null) => {
        this.selectedFilialId = id;
        this.carregarContadores();
        this.carregarConfiguracoesAlertas();
      });

      this.isDarkMode = localStorage.getItem('theme_sgf') === 'dark';
      this.applyTheme();

      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        this.updateActivePageTitle();
        this.carregarContadores();
        this.globalSearchQuery = '';
        this.globalSearch$.next('');
      });

      this.updateActivePageTitle();
      this.carregarFiliais();

      // Poll contadores every 5 seconds
      setInterval(() => {
        this.carregarContadores();
      }, 5000);

    } catch (e) {
      console.error('Erro ao processar dados do usuário:', e);
      this.router.navigate(['/login']);
    }
  }

  private updateActivePageTitle() {
    const url = this.router.url;

    // Default
    this.activePageGroup = '';

    if (url.includes('/admin/dashboard')) {
      this.activePageTitle = 'Dashboard';
      this.activePageGroup = ''; // Home > Dashboard removed
    } else if (url.includes('/admin/servicos')) {
      this.activePageTitle = 'Estrutura & Filiais';
      this.activePageGroup = ''; // Removed Gestão >
    } else if (url.includes('/admin/cadastros')) {
      if (url.includes('/usuarios')) {
        this.activePageTitle = 'Operadores';
        this.activePageGroup = '';
      } else if (url.includes('/clientes')) {
        this.activePageTitle = 'Clientes';
        this.activePageGroup = '';
      } else if (url.includes('/motoristas')) {
        this.activePageTitle = 'Motoristas';
        this.activePageGroup = '';
      } else if (url.includes('/caminhoes')) {
        this.activePageTitle = 'Caminhões';
        this.activePageGroup = '';
      } else {
        this.activePageTitle = 'Cadastros Gerais';
        this.activePageGroup = '';
      }
    } else if (url.includes('/admin/logs')) {
      this.activePageTitle = 'Logs e Auditoria';
      this.activePageGroup = ''; // Just "Logs e Auditoria"
    } else if (url.includes('/admin/configuracoes')) {
      this.activePageTitle = 'Configurações';
      this.activePageGroup = ''; // Just "Configurações"
    } else if (url.includes('/admin/meu-perfil')) {
      this.activePageTitle = 'Meu Perfil';
      this.activePageGroup = 'Conta';
    } else if (url.includes('/admin/atendimento')) {
      this.activePageTitle = 'Atendimento';
      this.activePageGroup = 'Operacional';
    } else if (url.includes('/supervisor/dashboard')) {
      this.activePageTitle = 'Dashboard';
      this.activePageGroup = '';
    } else if (url.includes('/supervisor/relatorios')) {
      this.activePageTitle = 'Relatórios Gerenciais';
      this.activePageGroup = '';
    } else if (url.includes('/supervisor/gerenciar-fila')) {
      this.activePageTitle = 'Gerenciar Fila';
      this.activePageGroup = '';
    } else if (url.includes('/supervisor/configuracoes')) {
      this.activePageTitle = 'Configurações';
      this.activePageGroup = '';
    } else if (url.includes('/supervisor/meu-perfil')) {
      this.activePageTitle = 'Meu Perfil';
      this.activePageGroup = 'Conta';
    }

    this.titleService.setTitle(`Aldebaran - ${this.activePageTitle}`);
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleProfileMenu(event: Event) {
    event.stopPropagation();
    this.showProfileMenu = !this.showProfileMenu;
    this.showSupervisorProfileMenu = false;
    this.showNotifications = false;
  }

  toggleSupervisorProfileMenu(event: Event) {
    event.stopPropagation();
    this.showSupervisorProfileMenu = !this.showSupervisorProfileMenu;
    this.showProfileMenu = false;
    this.showNotifications = false;
  }

  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
    this.showProfileMenu = false;
    this.showSupervisorProfileMenu = false;
  }

  marcarTodasLidas() {
    this.notificationService.markAllAsRead(this.usuario?.id);
  }

  onNotificationClick(n: any) {
    if (!n.lida) {
      this.notificationService.markAsRead(n.id);
    }
    this.showNotifications = false;
    if (n.rota) {
      this.router.navigate([n.rota]);
    }
  }

  @HostListener('document:click')
  closeMenu() {
    this.showProfileMenu = false;
    this.showSupervisorProfileMenu = false;
    this.showNotifications = false;
  }

  toggleDarkMode(event: Event) {
    event.stopPropagation();
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('theme_sgf', this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  applyTheme() {
    if (this.isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  confirmLogout(event: Event) {
    event.stopPropagation();
    this.showProfileMenu = false;
    this.showSupervisorProfileMenu = false;
    this.showLogoutModal = true;
  }

  cancelLogout() {
    this.showLogoutModal = false;
  }

  carregarFiliais() {
    this.loadingFiliais = true;
    this.filialService.getFiliais().subscribe({
      next: (data: Filial[]) => {
        if (this.isFilialRestrita()) {
          this.filiais = data.filter(f => f.id === this.usuario.filial_id);
          this.filialService.setSelectedFilial(this.usuario.filial_id);
          this.selectedFilialId = this.usuario.filial_id;
        } else {
          this.filiais = data;
        }
        this.loadingFiliais = false;

        const currentId = this.filialService.getSelectedFilialId();

        if (!this.isFilialRestrita() && this.userRole === 'SUPERVISOR' && !currentId && this.usuario?.filial_id) {
          this.filialService.setSelectedFilial(this.usuario.filial_id);
          this.selectedFilialId = this.usuario.filial_id;
        } else {
          this.selectedFilialId = this.isFilialRestrita() ? this.usuario.filial_id : currentId;
        }
      },
      error: (err) => {
        this.loadingFiliais = false;
        this.selectedFilialId = this.filialService.getSelectedFilialId();
      }
    });
  }

  onFilialChange() {
    if (this.isFilialRestrita() && this.selectedFilialId !== this.usuario?.filial_id) {
      this.selectedFilialId = this.usuario?.filial_id ?? null;
      this.filialService.setSelectedFilial(this.selectedFilialId);
      return;
    }
    if (!environment.production) console.log('Filial alterada para ID:', this.selectedFilialId);
    this.filialService.setSelectedFilial(this.selectedFilialId);
    this.carregarContadores();
    this.carregarConfiguracoesAlertas();

    // Opcional: Feedback visual ou recarregar dados da página atual se necessário
    if (this.selectedFilialId) {
      const filial = this.filiais.find(f => f.id === this.selectedFilialId);
      // Silent: removed verbose console logging for production
    }
  }

  carregarConfiguracoesAlertas() {
    if (!this.selectedFilialId) {
      this.alertSoundService.disable();
      return;
    }
    const token = localStorage.getItem('token') || '';
    this.http.get<any[]>(`${environment.apiUrl}/configuracoes/lista?filialId=${this.selectedFilialId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (configs) => {
        const sonsAlertaStr = configs.find(c => c.chave === 'SONS_ALERTA')?.valor || 'true';
        const categoriasStr = configs.find(c => c.chave === 'SONS_ALERTA_CATEGORIAS')?.valor || '[]';

        const sonsAlerta = sonsAlertaStr === 'true';
        let categorias: number[] = [];
        try { categorias = JSON.parse(categoriasStr); } catch (e) { }

        if (sonsAlerta) {
          this.alertSoundService.enable(categorias);
        } else {
          this.alertSoundService.disable();
        }
      }
    });
  }

  carregarContadores() {
    // Apenas para Supervisor
    if (this.userRole !== 'Supervisor') return;

    this.dashboardService.getSupervisorOverview(this.selectedFilialId || undefined).subscribe({
      next: (res) => {
        // --- Agendamentos ---
        const activeAgendamentos = res.agendamentos.filter((a: any) => {
          return a.status === 'PENDENTE' || a.status === 'CONFIRMADO';
        });

        const seenAgendIdsStr = localStorage.getItem('seenAgendamentoIdsSupervisor') || '[]';
        let seenAgendIds: number[] = [];
        try {
          seenAgendIds = JSON.parse(seenAgendIdsStr);
          if (!Array.isArray(seenAgendIds)) seenAgendIds = [];
        } catch (e) {
          seenAgendIds = [];
        }

        const modalAberto = localStorage.getItem('modalAbertoSupervisor') || '';
        const isAgendamentosOpen = modalAberto === 'agendamentos';

        if (isAgendamentosOpen) {
          const currentIds = activeAgendamentos.map((a: any) => Number(a.id));
          const updatedSeen = Array.from(new Set([...seenAgendIds.map(Number), ...currentIds]));
          if (updatedSeen.length > 300) {
            updatedSeen.splice(0, updatedSeen.length - 300);
          }
          localStorage.setItem('seenAgendamentoIdsSupervisor', JSON.stringify(updatedSeen));
          this.agendamentoCount = 0;
        } else {
          this.agendamentoCount = activeAgendamentos.filter((a: any) => !seenAgendIds.map(Number).includes(Number(a.id))).length;
        }

        // --- Atendimentos ---
        const activeAtendimentos = res.atendimentos;
        const seenAtendIdsStr = localStorage.getItem('seenAtendimentoIdsSupervisor') || '[]';
        let seenAtendIds: string[] = [];
        try {
          seenAtendIds = JSON.parse(seenAtendIdsStr);
          if (!Array.isArray(seenAtendIds)) seenAtendIds = [];
        } catch (e) {
          seenAtendIds = [];
        }

        const isAtendimentosOpen = modalAberto === 'atendimentos';
        if (isAtendimentosOpen) {
          const currentIds = activeAtendimentos.map((a: any) => String(a.ticket));
          const updatedSeen = Array.from(new Set([...seenAtendIds.map(String), ...currentIds]));
          if (updatedSeen.length > 300) {
            updatedSeen.splice(0, updatedSeen.length - 300);
          }
          localStorage.setItem('seenAtendimentoIdsSupervisor', JSON.stringify(updatedSeen));
          this.atendimentoCount = 0;
        } else {
          this.atendimentoCount = activeAtendimentos.filter((a: any) => !seenAtendIds.map(String).includes(String(a.ticket))).length;
        }
      },
      error: (err) => console.error('Erro ao carregar contadores:', err)
    });
  }

  resetSupervisorContador(tipo: 'atendimentos' | 'agendamentos') {
    if (tipo === 'atendimentos') {
      this.atendimentoCount = 0;
      localStorage.setItem('modalAbertoSupervisor', 'atendimentos');
      this.dashboardService.getSupervisorOverview(this.selectedFilialId || undefined).subscribe({
        next: (res) => {
          const currentIds = res.atendimentos.map((a: any) => String(a.ticket));
          const seenIdsStr = localStorage.getItem('seenAtendimentoIdsSupervisor') || '[]';
          let seenIds: string[] = [];
          try {
            seenIds = JSON.parse(seenIdsStr);
            if (!Array.isArray(seenIds)) seenIds = [];
          } catch (e) { }
          const updated = Array.from(new Set([...seenIds.map(String), ...currentIds]));
          if (updated.length > 300) {
            updated.splice(0, updated.length - 300);
          }
          localStorage.setItem('seenAtendimentoIdsSupervisor', JSON.stringify(updated));
        }
      });
    } else if (tipo === 'agendamentos') {
      this.agendamentoCount = 0;
      localStorage.setItem('modalAbertoSupervisor', 'agendamentos');
      this.dashboardService.getSupervisorOverview(this.selectedFilialId || undefined).subscribe({
        next: (res) => {
          const activeAgendamentos = res.agendamentos.filter((a: any) => a.status === 'PENDENTE' || a.status === 'CONFIRMADO');
          const currentIds = activeAgendamentos.map((a: any) => Number(a.id));
          const seenIdsStr = localStorage.getItem('seenAgendamentoIdsSupervisor') || '[]';
          let seenIds: number[] = [];
          try {
            seenIds = JSON.parse(seenIdsStr);
            if (!Array.isArray(seenIds)) seenIds = [];
          } catch (e) { }
          const updated = Array.from(new Set([...seenIds.map(Number), ...currentIds]));
          if (updated.length > 300) {
            updated.splice(0, updated.length - 300);
          }
          localStorage.setItem('seenAgendamentoIdsSupervisor', JSON.stringify(updated));
        }
      });
    }
  }

  logout() {
    this.showLogoutModal = false;
    localStorage.removeItem('usuario_sgf');
    this.router.navigate(['/login']);
  }

  onGlobalSearchChange(value: string) {
    this.globalSearchQuery = value;
    this.globalSearch$.next(value);
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('dark-theme');
    }
  }
}