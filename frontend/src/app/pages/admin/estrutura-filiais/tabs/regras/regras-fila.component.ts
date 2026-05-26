import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Settings, Check, Clock, Headphones, Save, Trash2, ArrowRight, Truck, Package, Zap, User, Layers } from 'lucide-angular';
import { ApiService } from '../../../../../services/api.service';
import { forkJoin, map, catchError, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-regras-fila',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './regras-fila.component.html',
  styleUrls: ['./regras-fila.component.scss']
})
export class RegrasFilaComponent implements OnInit {
  servicos: any[] = [];
  configs: any = {
    MODIFICADOR_AGENDAMENTO: 'A',
    BONUS_PRIORIDADE_AGENDAMENTO: '2',
    HORARIO_RESET: '00:00',
    LIMPEZA_AUTOMATICA: 'true'
  };

  selectedFilialId: number | null = null;
  isRestricted = false;
  usuarioLogado: any = null;

  loading = false;
  showSuccessModal = false;
  calibrando = false;
  calibracaoResultado: any[] | null = null;


  readonly iconsArr = { 
    settings: Settings, check: Check, clock: Clock, headphones: Headphones,
    save: Save, trash: Trash2, arrowRight: ArrowRight, truck: Truck,
    package: Package, zap: Zap, user: User, layers: Layers
  };

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) { }

  getLucideIcon(iconName: string) {
    if (!iconName) return this.iconsArr.layers;
    const name = iconName.toLowerCase();
    if (name.includes('truck') || name.includes('caminhão')) return this.iconsArr.truck;
    if (name.includes('package') || name.includes('caixa') || name.includes('retirada')) return this.iconsArr.package;
    if (name.includes('zap') || name.includes('raio') || name.includes('rápido')) return this.iconsArr.zap;
    if (name.includes('user') || name.includes('usuário') || name.includes('pessoa')) return this.iconsArr.user;
    return (this.iconsArr as any)[name] || this.iconsArr.layers;
  }

  ngOnInit() {
    const salvo = localStorage.getItem('usuario_sgf');
    if (salvo) {
      this.usuarioLogado = JSON.parse(salvo);
      if (this.usuarioLogado.filial_id) {
        this.isRestricted = true;
        this.selectedFilialId = Number(this.usuarioLogado.filial_id);
      }
    }

    this.route.queryParamMap.subscribe(params => {
      if (!this.isRestricted) {
        const fid = params.get('filialId');
        this.selectedFilialId = fid ? Number(fid) : null;
      }
      this.carregarDados();
    });
  }

  carregarDados() {
    this.loading = true;
    const filialQuery = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
    
    forkJoin({
      servicos: this.api.get<any[]>(`/servicos${filialQuery}`).pipe(catchError(err => { console.error(err); return of([]); })),
      configs: this.api.get<any>(`/configuracoes/lista${filialQuery}`).pipe(catchError(err => { console.error(err); return of({}); }))
    }).subscribe({
      next: (res) => {
        this.servicos = res.servicos;
        // Transformar array do backend para o objeto esperado pelo form
        if (Array.isArray(res.configs)) {
          const configObj: any = {};
          res.configs.forEach((c: any) => configObj[c.chave] = c.valor);
          this.configs = { ...this.configs, ...configObj };
        } else {
          this.configs = { ...this.configs, ...res.configs };
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  salvarAlteracoes() {
    this.loading = true;
    
    // Prepare service observables
    const servicoRequests = this.servicos.map(s => 
      this.api.patch(`/servicos/${s.id}`, {
        prefixo: s.prefixo,
        prioridadePeso: Number(s.prioridadePeso) || 1,
        metaEspera: Number(s.metaEspera) || 20,
        metaAtendimento: Number(s.metaAtendimento) || 15
      })
    );

    // Prepare configuration observables
    // Transformar objeto local para array esperado pelo backend
    const configList = Object.keys(this.configs).map(chave => ({
      chave: chave,
      valor: String(this.configs[chave])
    }));

    const filialQuery = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
    const configRequest = this.api.post(`/configuracoes/bulk${filialQuery}`, { configs: configList });

    // Concurrent execution
    forkJoin([...servicoRequests, configRequest]).subscribe({
      next: () => {
        this.loading = false;
        this.showSuccessModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Erro ao salvar:", err);
        this.loading = false;
        alert("Erro ao salvar. Tente novamente em instantes.");
        this.cdr.detectChanges();
      }
    });
  }

  fecharSucesso() {
    this.showSuccessModal = false;
    this.cdr.detectChanges();
  }

  calibrarSLAs() {
    this.calibrando = true;
    this.calibracaoResultado = null;
    const filialQuery = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
    this.api.post<any>(`/configuracoes/calibrar-sla`, {
      filialId: this.selectedFilialId
    }).subscribe({
      next: (res) => {
        this.calibrando = false;
        this.calibracaoResultado = res.resultados || [];
        this.showSuccessModal = true;
        this.carregarDados(); // reload updated SLA values
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao calibrar SLA:', err);
        this.calibrando = false;
        alert('Erro ao calibrar SLA. Verifique se há dados suficientes.');
        this.cdr.detectChanges();
      }
    });
  }
}
