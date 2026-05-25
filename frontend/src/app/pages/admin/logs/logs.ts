import { Component, OnInit, ChangeDetectorRef, OnDestroy, Optional } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { LucideAngularModule, FileText, Search, Download, Lock, ChevronLeft, ChevronRight, Building2, ChevronDown } from 'lucide-angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subscription } from 'rxjs';
import { AdminLayoutComponent } from '../../../layouts/admin-layout/admin-layout.component';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  providers: [DatePipe],
  templateUrl: './logs.html',
  styleUrls: ['./logs.scss']
})
export class Logs implements OnInit, OnDestroy {
  logs: any[] = [];
  loading = false;
  total = 0;
  page = 1;
  limit = 10;
  lastPage = 1;
  pages: number[] = [];
  filiais: any[] = [];
  selectedFilialId: number | null = null;
  selectedFilialName: string = '';
  isRestricted = false;
  usuarioLogado: any = null;

  filters = {
    search: '',
    acao: '',
    de: '',
    ate: ''
  };

  private searchSubject = new Subject<string>();
  private globalSearchSub?: Subscription;

  readonly icons = {
    fileText: FileText,
    search: Search,
    download: Download,
    lock: Lock,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    building: Building2,
    chevronDown: ChevronDown
  };

  Math = Math;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    @Optional() private layout?: AdminLayoutComponent
  ) {
    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(() => {
      this.page = 1;
      this.carregar();
    });
  }

  ngOnInit() {
    const salvo = localStorage.getItem('usuario_sgf');
    if (salvo) {
      this.usuarioLogado = JSON.parse(salvo);
      if (this.usuarioLogado.filial_id) {
        this.selectedFilialId = Number(this.usuarioLogado.filial_id);
        this.isRestricted = true;
      }
    }
    this.carregarFiliais();
    this.carregar();

    if (this.layout) {
      this.globalSearchSub = this.layout.globalSearch$.subscribe((term: string) => {
        this.onSearchChange(term);
      });
    }
  }

  ngOnDestroy() {
    if (this.globalSearchSub) {
      this.globalSearchSub.unsubscribe();
    }
  }

  carregarFiliais() {
    this.api.get<any[]>('/filiais').subscribe({
      next: (res) => {
        if (this.isRestricted) {
          this.filiais = res.filter(f => f.ativo && f.id === this.selectedFilialId);
        } else {
          this.filiais = res.filter(f => f.ativo);
        }
        this.onFilialChange();
      },
      error: (err) => console.error('Erro ao carregar filiais:', err)
    });
  }

  onFilialChange() {
    const filial = this.filiais.find((f: any) => f.id === this.selectedFilialId);
    this.selectedFilialName = filial ? filial.nome : 'Todas as Unidades';
    this.page = 1;
    this.carregar();
  }

  carregar() {
    this.loading = true;
    const params = {
      page: this.page,
      limit: this.limit,
      filialId: this.selectedFilialId,
      ...this.filters
    };

    this.api.get<any>('/logs', params).subscribe({
      next: (res) => {
        this.logs = res.items;
        this.total = res.total;
        this.lastPage = res.lastPage;
        this.generatePages();
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err),
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange(value: string) {
    this.filters.search = value;
    this.searchSubject.next(value);
  }

  changePage(p: number) {
    if (p < 1 || p > this.lastPage) return;
    this.page = p;
    this.carregar();
  }

  generatePages() {
    this.pages = [];
    for (let i = 1; i <= this.lastPage; i++) {
      if (i <= 5 || i === this.lastPage || (i >= this.page - 1 && i <= this.page + 1)) {
        this.pages.push(i);
      }
    }
  }

  getActionClass(acao: string): string {
    const a = acao?.toLowerCase();
    if (a.includes('criação')) return 'criacao';
    if (a.includes('atualização')) return 'atualizacao';
    if (a.includes('exclusão')) return 'exclusao';
    if (a.includes('transicao') || a.includes('transferencia')) return 'fila';
    if (a.includes('calibracao')) return 'atualizacao';
    if (a.includes('login')) return 'login';
    if (a.includes('configuração')) return 'configuracao';
    return 'default';
  }

  formatDescription(descricao: string, acao: string): string {
    try {
      const parsed = JSON.parse(descricao);
      if (acao === 'TRANSICAO_STATUS') {
        const guicheTexto = parsed.guicheId ? ` no Guichê <strong>${parsed.guicheId}</strong>` : '';
        return `A senha <strong>#${parsed.senhaId}</strong> mudou de <span class="badge-status">${parsed.from}</span> para <span class="badge-status highlight">${parsed.to}</span>${guicheTexto}.`;
      }
      if (acao === 'TRANSFERENCIA_ATENDIMENTO') {
        return `A senha <strong>#${parsed.senhaId}</strong> foi transferida do Guichê <strong>${parsed.guicheOrigemId}</strong> para o Guichê <strong>${parsed.guicheDestinoId}</strong>.`;
      }
      if (acao === 'CALIBRACAO_SLA') {
        return `O SLA do serviço <strong>${parsed.nomeServico}</strong> foi calibrado: Espera atualizada de ${parsed.metaEsperaAntiga} para <strong>${parsed.metaEsperaNova}min</strong> (${parsed.amostrasEspera} amostras). Atendimento atualizado de ${parsed.metaAtendimentoAntiga} para <strong>${parsed.metaAtendimentoNova}min</strong> (${parsed.amostrasAtendimento} amostras).`;
      }

      // Se for JSON valido mas não conhecemos a ação, formatar bonito
      return `<pre style="margin: 0; font-size: 0.8rem; color: #64748b;">${JSON.stringify(parsed, null, 2)}</pre>`;
    } catch {
      // Se não for JSON, retorna string limpa ou escapa o HTML (simplesmente text)
      return descricao;
    }
  }

  exportPDF() {
    this.loading = true;
    const params = {
      page: 1,
      limit: 1000, // Busca uma quantidade maior para o relatório
      ...this.filters
    };

    this.api.get<any>('/logs', params).subscribe({
      next: (res) => {
        const doc = new jsPDF();
        const logsToExport = res.items;

        // Cabeçalho do PDF
        doc.setFontSize(18);
        doc.setTextColor(0, 153, 171); // #0099ab
        doc.text('Relatório de Logs e Auditoria', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        const dataEmissao = new Date().toLocaleString();
        doc.text(`Emitido em: ${dataEmissao}`, 14, 30);

        const tableData = logsToExport.map((log: any) => [
          new Date(log.criadoEm).toLocaleString(),
          log.acao,
          log.usuario?.nome || 'Sistema',
          log.entidade || '-',
          log.descricao,
          log.status || 'Sucesso'
        ]);

        autoTable(doc, {
          startY: 35,
          head: [['DATA/HORA', 'AÇÃO', 'USUÁRIO', 'ENTIDADE', 'DESCRIÇÃO', 'STATUS']],
          body: tableData,
          headStyles: { fillColor: [0, 153, 171], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { top: 35 },
          styles: { fontSize: 8, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { cellWidth: 30 },
            3: { cellWidth: 25 },
            5: { cellWidth: 20 }
          }
        });

        doc.save(`relatorio-logs-${new Date().getTime()}.pdf`);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        alert("Erro ao gerar PDF");
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
