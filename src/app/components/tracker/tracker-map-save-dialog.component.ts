import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatLabel } from '@angular/material/form-field';
import { IMarkerDialogData } from './tracker.interface';

@Component({
  selector: 'app-tracker-map-save-dialog',
  templateUrl: './tracker-map-save-dialog.component.html',
  styleUrl: './tracker-map-save-dialog.component.scss',
  imports: [ MatDialogModule, MatButtonModule, MatLabel, MatButtonToggleModule ]
})
export class TrackerMapSaveDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TrackerMapSaveDialogComponent>);
  readonly data = inject<IMarkerDialogData>(MAT_DIALOG_DATA);

  size: 'small' | 'medium' | 'large';

  constructor() {
    this.size = this.data.size || 'small';
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.data.size = this.size as 'small' | 'medium' | 'large';
    this.dialogRef.close(this.data);
  }

  onSizeChange(event: MatButtonToggleChange): void {
    const value = event.value;
    this.size = value;
  }
}
