import { TranslatePipe } from '../../../../../services/translate.pipe';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings-section-card',
  standalone: true,
  imports: [TranslatePipe, CommonModule],
  templateUrl: './settings-section-card.component.html',
  styleUrl: './settings-section-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSectionCardComponent {
  @Input({ required: true }) title = '';
  @Input() eyebrow = '';
}
