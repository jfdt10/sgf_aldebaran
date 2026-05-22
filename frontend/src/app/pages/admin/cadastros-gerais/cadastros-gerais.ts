import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink, ActivatedRoute } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule, Users, User, Building, Truck, Building2, ChevronDown } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-cadastros-gerais',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, LucideAngularModule, FormsModule],
  templateUrl: './cadastros-gerais.html',
  styleUrls: ['./cadastros-gerais.scss']
})
export class CadastrosGerais implements OnInit {
  currentTab = 'usuarios';
  filiais: any[] = [];
  selectedFilialId: number | null = null;
  selectedFilialName: string = '';
  isRestricted = false;
  usuarioLogado: any = null;

  readonly icons = { 
    users: Users, 
    user: User,
    building: Building, 
    truck: Truck,
    buildingSelect: Building2,
    chevronDown: ChevronDown
  };

  tabs = [
    { id: 'usuarios', label: 'Usuários do Sistema', icon: this.icons.users, route: '/admin/cadastros/usuarios' },
    { id: 'clientes', label: 'Clientes', icon: this.icons.building, route: '/admin/cadastros/clientes' },
    { id: 'motoristas', label: 'Caminhoneiros', icon: this.icons.user, route: '/admin/cadastros/motoristas' },
    { id: 'caminhoes', label: 'Caminhões', icon: this.icons.truck, route: '/admin/cadastros/caminhoes' }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService
  ) {
    this.router.events.subscribe((event: any) => {
      if (event instanceof NavigationEnd) {
        this.updateCurrentTab(event.urlAfterRedirects);
      }
    });
  }

  ngOnInit(): void {
    const salvo = localStorage.getItem('usuario_sgf');
    if (salvo) {
      this.usuarioLogado = JSON.parse(salvo);
      if (this.usuarioLogado.filial_id) {
        this.selectedFilialId = Number(this.usuarioLogado.filial_id);
        this.isRestricted = true;
      }
    }

    this.updateCurrentTab(this.router.url);
    this.carregarFiliais();
    
    // Pegar filial dos query params no carregamento inicial se não for restrito
    this.route.queryParams.subscribe(params => {
      if (!this.isRestricted && params['filialId']) {
        this.selectedFilialId = +params['filialId'];
        this.updateSelectedFilialName();
      }
    });
  }

  carregarFiliais() {
    this.api.get<any[]>('/filiais').subscribe({
      next: (res) => {
        if (this.isRestricted) {
          this.filiais = res.filter(f => f.ativo && f.id === this.selectedFilialId);
        } else {
          this.filiais = res.filter(f => f.ativo);
        }
        this.updateSelectedFilialName();
      },
      error: (err) => console.error('Erro ao carregar filiais:', err)
    });
  }

  onFilialChange() {
    this.updateSelectedFilialName();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filialId: this.selectedFilialId },
      queryParamsHandling: 'merge'
    });
  }

  updateSelectedFilialName() {
    const filial = this.filiais.find((f: any) => f.id === this.selectedFilialId);
    this.selectedFilialName = filial ? filial.nome : 'Todas as Unidades';
  }

  updateCurrentTab(url: string) {
    if (url.includes('/clientes')) this.currentTab = 'clientes';
    else if (url.includes('/motoristas')) this.currentTab = 'motoristas';
    else if (url.includes('/caminhoes')) this.currentTab = 'caminhoes';
    else this.currentTab = 'usuarios';
  }
}
