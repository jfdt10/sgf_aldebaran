import { LanguageService } from '../../../services/language.service';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { Component, OnInit, HostListener, ChangeDetectorRef, OnDestroy, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Plus, Edit2, Trash2, X, Truck, UserCircle, Hash, Briefcase, Users, User, CheckCircle, Check } from 'lucide-angular';
import { Subscription } from 'rxjs';
import { AdminLayoutComponent } from '../../../layouts/admin-layout/admin-layout.component';

@Component({
    selector: 'app-caminhoes',
    standalone: true,
    imports: [TranslatePipe, CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './caminhoes.component.html',
    styleUrls: ['./caminhoes.component.scss']
})
export class CaminhoesComponent implements OnInit, OnDestroy {
  private readonly language = inject(LanguageService);
    icons = { search: Search, plus: Plus, edit2: Edit2, trash2: Trash2, x: X, truck: Truck, userCircle: UserCircle, hash: Hash, briefcase: Briefcase, users: Users, user: User, checkCircle: CheckCircle, check: Check };

    caminhoes: any[] = [];
    motoristas: any[] = [];
    filtro = '';
    loading = false;
    selectedFilialId: number | null = null;

    showModal = false;
    showSuccessModal = false;
    isEditing = false;

    caminhaoForm = {
        id: null as number | null,
        placa: '',
        modelo: '',
        transportadora: '',
        capacidade: '',
        status: 'ATIVO',
        observacoes: '',
        motorista_id: null as number | null,
        filial_id: null as number | null
    };

    private searchSub?: Subscription;

    constructor(
        private api: ApiService, 
        private cdr: ChangeDetectorRef,
        private route: ActivatedRoute,
        @Optional() private layout?: AdminLayoutComponent
    ) { }

    ngOnInit(): void {
        this.route.queryParamMap.subscribe(params => {
            const fid = params.get('filialId');
            this.selectedFilialId = fid ? Number(fid) : null;
            this.carregarDados();
            this.carregarMotoristas();
        });

        if (this.layout) {
            this.searchSub = this.layout.globalSearch$.subscribe((term: string) => {
                this.filtro = term;
                this.carregarDados();
            });
        }
    }

    ngOnDestroy() {
        if (this.searchSub) {
            this.searchSub.unsubscribe();
        }
    }

    carregarDados() {
        this.loading = true;
        const filialQuery = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
        this.api.get<any[]>(`/caminhoes${filialQuery}`).subscribe({
            next: (data) => {
                if (this.filtro) {
                    const termo = this.filtro.toLowerCase();
                    this.caminhoes = data.filter(c => 
                        c.placa.toLowerCase().includes(termo) ||
                        c.modelo.toLowerCase().includes(termo) ||
                        c.transportadora.toLowerCase().includes(termo)
                    );
                } else {
                    this.caminhoes = data;
                }
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Erro ao carregar', err);
                this.loading = false;
            }
        });
    }

    checkPlaca() {
        if (this.isEditing) return;
        const placa = this.caminhaoForm.placa;
        if (placa && (placa.length >= 7)) {
            this.api.get<{exists: boolean}>(`/caminhoes/check`, {
                placa
            }).subscribe(res => {
                if (res.exists) {
                    alert(this.language.text("Placa já cadastrada no sistema!"));
                }
            });
        }
    }

    carregarMotoristas() {
        const filialQuery = this.selectedFilialId ? `?filialId=${this.selectedFilialId}` : '';
        this.api.get<any[]>(`/motoristas${filialQuery}`).subscribe({
            next: (data) => {
                this.motoristas = data;
                this.cdr.detectChanges();
            },
            error: (err) => console.error(err)
        });
    }

    buscar() {
        this.carregarDados();
    }

    abrirModalNovo() {
        this.isEditing = false;
        this.caminhaoForm = {
            id: null, placa: '', modelo: '', transportadora: '', capacidade: '', status: 'ATIVO', observacoes: '', motorista_id: null, filial_id: this.selectedFilialId
        };
        this.showModal = true;
    }

    abrirModalEditar(cam: any) {
        this.isEditing = true;
        this.caminhaoForm = { ...cam };
        if (this.caminhaoForm.filial_id === undefined) this.caminhaoForm.filial_id = null;
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
        if (!this.caminhaoForm.placa || !this.caminhaoForm.modelo || !this.caminhaoForm.transportadora || !this.caminhaoForm.capacidade) {
            alert(this.language.text("Placa, Modelo, Transportadora e Capacidade são obrigatórios!"));
            return;
        }

        const { id, ...payloadData } = this.caminhaoForm;
        const payload = {
            ...payloadData,
            filial_id: this.caminhaoForm.filial_id ? Number(this.caminhaoForm.filial_id) : null,
            motorista_id: this.caminhaoForm.motorista_id ? Number(this.caminhaoForm.motorista_id) : null,
            observacoes: this.caminhaoForm.observacoes || ''
        };

        if (this.isEditing) {
            this.api.put(`/caminhoes/${this.caminhaoForm.id}`, payload).subscribe({
                next: () => {
                    this.showModal = false;
                    this.showSuccessModal = true;
                    this.carregarDados();
                    this.cdr.detectChanges();
                },
                error: (err) => alert(this.language.text("Erro ao atualizar:") + " " + (err.error?.message || this.language.text("Erro desconhecido")))
            });
        } else {
            this.api.post('/caminhoes', payload).subscribe({
                next: () => {
                    this.showModal = false;
                    this.showSuccessModal = true;
                    this.carregarDados();
                    this.cdr.detectChanges();
                },
                error: (err) => alert(this.language.text("Erro ao salvar:") + " " + (err.error?.message || this.language.text("Erro desconhecido")))
            });
        }
    }

    alternarStatus(id: number) {
        this.api.patch(`/caminhoes/${id}/status`, {}).subscribe({
            next: () => {
                this.carregarDados();
                this.cdr.detectChanges();
            },
            error: (err) => alert(this.language.text("Erro ao alterar status"))
        });
    }
}
