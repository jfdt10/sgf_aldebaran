import { LanguageService } from '../../../services/language.service';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TotemConfigService } from '../../../services/totem-config.service';

@Component({
  selector: 'app-totem-inicial',
  standalone: true,
  imports: [TranslatePipe, CommonModule],
  templateUrl: './totem-inicial.component.html',
  styleUrls: ['./totem-inicial.component.scss']
})
export class TotemInicialComponent implements OnInit {
  readonly language = inject(LanguageService);
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