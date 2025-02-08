import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-overlay',
  templateUrl: './overlay.component.html',
  styleUrl: './overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverlayComponent {
  @Output() readonly close = new EventEmitter<void>();

  constructor(
  ) {
  }

  onClose(event: Event): void {
    event.stopImmediatePropagation();
    this.close.emit();
  }

  onClickOut(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.closest('.overlay-body')) { return; }
    this.onClose(event);
  }
}
