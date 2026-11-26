import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from './language.service';

@Pipe({ name: 'tr', pure: false, standalone: true })
export class TranslatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: string | null | undefined, params?: Readonly<Record<string, string | number>>): string {
    return this.language.text(value, params);
  }
}
