import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { english } from './english';

export type Language = 'PT' | 'EN';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'aldebaran-language';
  private readonly selected = signal<Language>('PT');
  readonly current = this.selected.asReadonly();

  constructor() {
    this.select(this.document.defaultView?.localStorage.getItem(this.storageKey) === 'EN' ? 'EN' : 'PT');
  }

  select(language: Language): void {
    this.selected.set(language);
    this.document.documentElement.lang = language === 'EN' ? 'en' : 'pt-BR';
    this.document.defaultView?.localStorage.setItem(this.storageKey, language);
  }

  text(value: string | null | undefined): string {
    if (typeof value !== 'string') return '';
    return this.selected() === 'EN' && Object.hasOwn(english, value) ? english[value] : value;
  }
}
