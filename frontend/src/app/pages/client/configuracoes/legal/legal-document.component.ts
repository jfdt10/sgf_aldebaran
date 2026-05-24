import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ArrowLeft, FileText, LucideAngularModule } from 'lucide-angular';
import { LegalDocumentContent } from './legal-content';

@Component({
  selector: 'app-legal-document',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './legal-document.component.html',
  styleUrl: './legal-document.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalDocumentComponent {
  @Input({ required: true }) content!: LegalDocumentContent;

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
