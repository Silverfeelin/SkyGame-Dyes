import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-tracker-map-marker-dialog',
  templateUrl: './tracker-map-marker-dialog.component.html',
  imports: [ MatDialogModule, MatButtonModule ]
})
export class TrackerMapMarkerDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TrackerMapMarkerDialogComponent>);

  constructor() { }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
