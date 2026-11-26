import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle, LucideAngularModule, Mail } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-recover',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, TranslatePipe],
  templateUrl: './recover.component.html',
  styleUrl: './recover.component.scss',
})
export class RecoverComponent {
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  readonly icons = { arrow: ArrowLeft, check: CheckCircle, mail: Mail };
  readonly status = signal<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  email = '';

  enviar() {
    const identifier = this.email.trim();
    if (!identifier || this.status() === 'sending') return;

    this.status.set('sending');
    this.auth.recover(identifier).subscribe({
      next: () => this.status.set('sent'),
      error: () => this.status.set('failed'),
    });
  }

  novoPedido() {
    this.email = '';
    this.status.set('idle');
  }
}
