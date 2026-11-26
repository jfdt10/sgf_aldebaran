import { LanguageService } from '../../../services/language.service';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TotemService } from '../../../services/totem.service';
import { environment } from '../../../../environments/environment';


@Component({
  selector: 'app-totem-checkin',
  standalone: true,
  imports: [TranslatePipe, CommonModule, RouterLink, FormsModule],
  templateUrl: './totem-checkin.component.html',
  styleUrls: ['./totem-checkin.component.scss']
})
export class TotemCheckinComponent {
  readonly language = inject(LanguageService);

  mostrarModalCodigo: boolean = false;
  mostrarAjuda: boolean = false;

  codigoDigitado: string = '';
  checkinPreferencial: boolean = false;

  loading: boolean = false;
  erroMensagem: string | null = null;

  constructor(
    private router: Router,
    private totemService: TotemService,
    private cdr: ChangeDetectorRef
  ) { }


  abrirModalCodigo() {
    this.mostrarModalCodigo = true;
    this.codigoDigitado = '';
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


  abrirAjuda() {
    this.mostrarAjuda = true;
  }

  fecharAjuda() {
    this.mostrarAjuda = false;
  }

  @HostListener('window:keydown.enter', ['$event'])
  handleEnter(event: any) {
    if (this.mostrarModalCodigo) {
      this.confirmarCodigo();
    }
  }
}