import { LanguageService } from '../../../../services/language.service';
import { TranslatePipe } from '../../../../services/translate.pipe';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ArrowLeft, FileText, LucideAngularModule } from 'lucide-angular';
import { LegalDocumentContent } from './legal-content';

@Component({
  selector: 'app-legal-document',
  standalone: true,
  imports: [TranslatePipe, CommonModule, LucideAngularModule],
  templateUrl: './legal-document.component.html',
  styleUrl: './legal-document.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalDocumentComponent {
  @Input({ required: true }) content!: LegalDocumentContent;
  @Input({ required: true }) englishContent!: LegalDocumentContent;

  private readonly language = inject(LanguageService);

  get activeContent(): LegalDocumentContent {
    return this.language.current() === 'EN' ? this.englishContent : this.content;
  }

  protected readonly icons = {
    back: ArrowLeft,
    document: FileText,
  };

  constructor(private readonly router: Router) {}

  get eyebrow(): string {
    return this.router.url.includes('/supervisor') ? 'Portal do Supervisor' : 'Portal do Cliente';
  }

  protected back(): void {
    if (this.router.url.includes('/supervisor')) {
      this.router.navigate(['/supervisor/configuracoes']);
    } else {
      this.router.navigate(['/client/configuracoes']);
    }
  }
}
