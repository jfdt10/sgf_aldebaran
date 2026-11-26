import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TotemConfigService } from '../../../services/totem-config.service';

@Component({
  selector: 'app-totem-inicial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './totem-inicial.component.html',
  styleUrls: ['./totem-inicial.component.scss']
})
export class TotemInicialComponent implements OnInit {
  filialNome: string | null = '';

  constructor(
    private router: Router,
    private configService: TotemConfigService
  ) {}

  ngOnInit() {
    if (!this.configService.isConfigurado()) {
      this.router.navigate(['/totem/setup']);
    } else {
      this.filialNome = this.configService.getFilialNome();
    }
  }

  navegarParaCheckin() {
    this.router.navigate(['/totem/checkin']);
  }

  navegarParaSenha() {
    this.router.navigate(['/totem/tipo-atendimento']);
  }
}