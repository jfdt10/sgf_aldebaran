import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TotemService } from '../../../services/totem.service';

@Component({
  selector: 'app-totem-tipo-atendimento',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './totem-tipo-atendimento.component.html',
  styleUrls: ['./totem-tipo-atendimento.component.scss']
})
export class TotemTipoAtendimentoComponent {

  constructor(private totemService: TotemService) {}

  selecionarConvencional() {
    this.totemService.escolherTipo('Convencional');
  }

  selecionarPreferencial() {
    this.totemService.escolherTipo('Preferencial');
  }
}