import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from './language.service';

@Pipe({ name: 'tr', pure: false, standalone: true })
export class TranslatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: string | null | undefined): string {
    return this.language.text(value);
  }
}
