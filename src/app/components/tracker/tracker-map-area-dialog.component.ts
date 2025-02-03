import { Component, inject } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatLabel } from '@angular/material/form-field';
import { ITrackerMap } from './tracker-maps';
import { IPanDialogData } from './tracker.interface';

@Component({
  selector: 'app-tracker-map-area-dialog',
  templateUrl: './tracker-map-area-dialog.component.html',
  imports: [ MatDialogModule, MatLabel, MatChipsModule ]
})
export class TrackerMapAreaDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TrackerMapAreaDialogComponent>);
  readonly data = inject<IPanDialogData>(MAT_DIALOG_DATA);

  realms: Array< { name: string, maps: Array<ITrackerMap> } > = [];
  constructor() {
    let lastRealm = '';
    for (const map of this.data.maps || []) {
      if (lastRealm !== map.realm) {
        this.realms.push({ name: map.realm, maps: [] });
        lastRealm = map.realm;
      }

      this.realms[this.realms.length - 1].maps.push(map);
    }
  }

  selectMap(map: ITrackerMap): void {
    this.data.selectedMap = map;
    this.dialogRef.close(this.data);
  }
}
