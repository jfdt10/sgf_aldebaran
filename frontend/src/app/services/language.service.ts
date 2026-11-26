import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { english } from './english';

export type Language = 'PT' | 'EN';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'aldebaran-language';
  private readonly selected = signal<Language>('PT');
  readonly current = this.selected.asReadonly();
  readonly locale = computed(() => this.current() === 'EN' ? 'en' : 'pt-BR');

  constructor() {
    this.select(this.document.defaultView?.localStorage.getItem(this.storageKey) === 'EN' ? 'EN' : 'PT');
  }

  select(language: Language): void {
    this.selected.set(language);
    this.document.documentElement.lang = this.locale();
    this.document.defaultView?.localStorage.setItem(this.storageKey, language);
  }

  text(value: string | null | undefined, params?: Readonly<Record<string, string | number>>): string {
    if (typeof value !== 'string') return '';
    const translation = this.current() === 'EN' && Object.hasOwn(english, value) ? english[value] : value;
    return params ? translation.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match)) : translation;
  }
}
