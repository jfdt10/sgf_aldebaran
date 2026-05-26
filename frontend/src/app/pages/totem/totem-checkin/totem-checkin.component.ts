import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TotemService } from '../../../services/totem.service';
import { environment } from '../../../../environments/environment';


@Component({
  selector: 'app-totem-checkin',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './totem-checkin.component.html',
  styleUrls: ['./totem-checkin.component.scss']
})
export class TotemCheckinComponent {

  // Controle de Visibilidade dos Modais
  mostrarModalCodigo: boolean = false;
  mostrarAjuda: boolean = false;

  // Armazena o código digitado no input
  codigoDigitado: string = '';
  checkinPreferencial: boolean = false;

  loading: boolean = false;
  erroMensagem: string | null = null;

  constructor(
    private router: Router,
    private totemService: TotemService,
    private cdr: ChangeDetectorRef
  ) { }

  // --- MODAL DE CÓDIGO ---

  abrirModalCodigo() {
    this.mostrarModalCodigo = true;
    this.codigoDigitado = ''; // Limpa o campo ao abrir
    this.checkinPreferencial = false;
    this.erroMensagem = null;
    this.loading = false;
  }

  fecharModalCodigo() {
    this.mostrarModalCodigo = false;
    this.erroMensagem = null;
    this.loading = false;
  }

  confirmarCodigo() {
    const codigoNormalizado = this.codigoDigitado.trim();
    if (!codigoNormalizado) {
      this.erroMensagem = 'Informe um código válido.';
      return;
    }

    if (!environment.production) console.log('Código confirmado:', codigoNormalizado);
    const tipo = this.checkinPreferencial ? 'Preferencial' : 'Convencional';
    this.loading = true;
    this.erroMensagem = null;
    this.cdr.detectChanges();

    this.totemService.validarCheckin(codigoNormalizado, tipo).subscribe({
      next: (resposta) => {
        this.loading = false;
        this.fecharModalCodigo();
        this.cdr.detectChanges();
      },
      error: (erro) => {
        this.loading = false;
        console.error('Erro Checkin:', erro);
        const msg = erro?.error?.message;
        if (Array.isArray(msg) && msg.length) {
          this.erroMensagem = msg.join('\n');
        } else if (typeof msg === 'string' && msg.trim() !== '') {
          this.erroMensagem = msg;
        } else {
          this.erroMensagem = erro?.message || 'Erro ao validar código.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  // --- MODAL DE AJUDA ---

  abrirAjuda() {
    this.mostrarAjuda = true;
  }

  fecharAjuda() {
    this.mostrarAjuda = false;
  }

  // CORREÇÃO AQUI: Mudamos 'KeyboardEvent' para 'any' para evitar o erro do TypeScript
  @HostListener('window:keydown.enter', ['$event'])
  handleEnter(event: any) {
    // Se o modal de código estiver aberto, o Enter confirma
    if (this.mostrarModalCodigo) {
      this.confirmarCodigo();
    }
  }
}