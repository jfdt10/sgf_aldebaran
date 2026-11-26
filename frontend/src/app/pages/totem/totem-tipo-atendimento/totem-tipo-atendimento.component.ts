import { LanguageService } from '../../../services/language.service';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TotemService } from '../../../services/totem.service';

@Component({
  selector: 'app-totem-tipo-atendimento',
  standalone: true,
  imports: [TranslatePipe, CommonModule, RouterLink],
  templateUrl: './totem-tipo-atendimento.component.html',
  styleUrls: ['./totem-tipo-atendimento.component.scss']
})
export class TotemTipoAtendimentoComponent {
  readonly language = inject(LanguageService);

  constructor(private totemService: TotemService) {}

  selecionarConvencional() {
    this.totemService.escolherTipo('Convencional');
  }

  selecionarPreferencial() {
    this.totemService.escolherTipo('Preferencial');
  }
}