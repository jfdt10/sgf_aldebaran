import { Component, inject } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
  selector: 'app-language-switch',
  imports: [TranslatePipe],
  template: `
    <div role="group" [attr.aria-label]="'Idioma' | tr">
      @for (option of options; track option) {
        <button type="button" [attr.aria-label]="option === 'PT' ? 'Português' : 'English'"
          [attr.lang]="option === 'PT' ? 'pt-BR' : 'en'"
          [attr.aria-pressed]="language.current() === option"
          (click)="language.select(option)">{{ option }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; }
    :host(.page-language) { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
    div {
      display: inline-flex;
      gap: 0.125rem;
      padding: 0.1875rem;
      background: var(--bg-body, #f1f5f9);
      border: 1px solid var(--border-color, #cbd5e1);
      border-radius: 0.625rem;
    }
    button {
      min-width: 2.25rem;
      min-height: 1.875rem;
      border: 0;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--text-primary, #1e293b);
      font: 700 0.75rem/1 system-ui;
      cursor: pointer;
    }
    button[aria-pressed='true'] { background: #075985; color: #fff; }
    button:focus-visible { outline: 2px solid #0ea5e9; outline-offset: 2px; }
  `,
})
export class LanguageSwitchComponent {
  protected readonly language = inject(LanguageService);
  protected readonly options = ['PT', 'EN'] as const;
}
