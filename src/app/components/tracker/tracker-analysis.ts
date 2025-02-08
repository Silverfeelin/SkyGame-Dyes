import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, signal, WritableSignal } from '@angular/core';
import { DateTime } from 'luxon';
import { trackerIcons } from './tracker-icons';
import L from 'leaflet';
import { DateHelper } from '../../helpers/date-helper';

interface IAnalysisResponseData {
  columns: Array<string>;
  markers: Array<Array<unknown>>;
}

interface IAnalysisMarker {
  marker?: L.Marker;
  createdOn: string;
  userId: string;
  username: string;
  id: number;
  epoch: number;
  lat: number;
  lng: number;
  size: number;
  date: DateTime;
}

type AnalysisFilters = {
  custom?: (m: IAnalysisMarker) => boolean;
  hourOfDay: WritableSignal<Array<number> | undefined>;
  dayOfWeek: WritableSignal<Array<number> | undefined>;
  dayOfMonth: WritableSignal<Array<number> | undefined>;
  weekOfYear: WritableSignal<Array<number> | undefined>;
  size: WritableSignal<Array<number> | undefined>;
  username: WritableSignal<string | undefined>;
}

@Injectable()
export class TrackerAnalysisService {
  loaded = signal(false);
  markers = signal<Array<IAnalysisMarker>>([]);
  readonly filters: AnalysisFilters = {
    hourOfDay: signal(undefined),
    dayOfWeek: signal(undefined),
    dayOfMonth: signal(undefined),
    weekOfYear: signal(undefined),
    size: signal(undefined),
    username: signal(undefined)
  };
  layer = signal<L.LayerGroup | undefined>(undefined);

  constructor(
    private readonly _http: HttpClient,
    private readonly _zone: NgZone
  ) {
  }

  bindWindow(): void {
    const w = window as any;
    w.analysisSetFilter = (f: (m: IAnalysisMarker) => boolean) => this._zone.run(() => this.setFilter(f));
    w.analysisDownload = () => this._zone.run(() => this.download());
    w.analysisPromptFile = () => this._zone.run(() => this.promptFile());
  }

  download(): void {
    this._http.get<IAnalysisResponseData>(`/api/export`).subscribe(data => {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analysis-data.json';
      a.click();
      window.URL.revokeObjectURL(url);

      const csv = [
        data.columns.join(','),
        ...data.markers.map(m => m.join(','))
      ].join('\n');
      const blobCsv = new Blob([csv], { type: 'text/csv' });
      const urlCsv = window.URL.createObjectURL(blobCsv);
      const aCsv = document.createElement('a');
      aCsv.href = urlCsv;
      aCsv.download = 'analysis-data.csv';
      aCsv.click();
      window.URL.revokeObjectURL(urlCsv);
    });
  }

  promptFile(): void {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) { return; }

        const reader = new FileReader();
        reader.onload = () => {
          const data = reader.result as string;
          let parsed: IAnalysisResponseData;
          try {
            parsed = JSON.parse(data) as IAnalysisResponseData;
          } catch (e) {
            alert('Invalid JSON data.');
            return;
          }
          this.load(parsed);
        };

        reader.readAsText(file);
      });

      input.click();
  }

  load(data: IAnalysisResponseData): void {
    console.log(data);

    this.layer()?.remove();
    const layer = L.markerClusterGroup({
      disableClusteringAtZoom: 1
    });
    this.layer.set(layer);

    const columnMap = new Map<string, number>();
    data.columns.forEach((c, i) => columnMap.set(c, i));
    const markers: Array<IAnalysisMarker> = data.markers.map((m, i) => {
      return {
        id: m[columnMap.get('id')!] as number,
        createdOn: m[columnMap.get('createdOn')!] as string,
        userId: m[columnMap.get('userId')!] as string,
        username: m[columnMap.get('username')!] as string,
        epoch: m[columnMap.get('epoch')!] as number,
        date: DateTime.fromMillis(m[columnMap.get('epoch')!] as number, { zone: DateHelper.skyTimeZone }),
        lat: m[columnMap.get('lat')!] as number,
        lng: m[columnMap.get('lng')!] as number,
        size: m[columnMap.get('size')!] as number
      };
    });

    this.markers.set(markers);

    markers.forEach(marker => {
      if (!this.layer) { return; }
      const sizeIcon = marker.size === 3 ? 'large'
        : marker.size === 1 ? 'small'
        : 'medium';
      const icon = trackerIcons[sizeIcon];
      const m = L.marker([ marker.lat, marker.lng ], { icon });
      marker.marker = m;

      const popup = L.popup({
        content: `
          <div>
            <div>ID: ${marker.id}</div>
            <div>Created by: ${marker.username} (${marker.userId})</div>
            <div>Created UTC: ${marker.createdOn}</div>
            <div>Epoch: ${marker.epoch}</div>
            <div>Sky Date: ${marker.date.toFormat('yyyy-MM-dd HH:mm')}</div>
          </div>
        `,
        offset: [0, -12],
      });
      m.bindPopup(popup);

      layer.addLayer(marker.marker);
    });

    this.applyFilters();
    this.loaded.set(true);
  }

  reset(): void {
    this.filters.hourOfDay.set(undefined);
    this.filters.dayOfWeek.set(undefined);
    this.filters.dayOfMonth.set(undefined);
    this.filters.weekOfYear.set(undefined);
    this.filters.size.set(undefined);
    this.filters.username.set(undefined);
    this.applyFilters();
  }

  setFilter(f: (m: IAnalysisMarker) => boolean): any {
    this.filters.custom = f;
  }

  promptDayOfWeek(): void {
    this.filterRange('Enter days (e.g. 1-7 / 1,3,5,7 / even / uneven):', 'dayOfWeek', 1, 7);
  }

  promptDayOfMonth(): void {
    this.filterRange('Enter days of the month (e.g. 1-31 / 1,15,31 / even / uneven):', 'dayOfMonth', 1, 31);
  }

  promptHourOfDay(): void {
    this.filterRange('Enter hours (e.g. 0-11 / 0,2,4 / even / uneven):', 'hourOfDay', 0, 23);
  }

  promptWeekOfYear(): void {
    this.filterRange('Enter weeks of the year (e.g. 1-53 / 1,5,9 / even / uneven):', 'weekOfYear', 1, 53);
  }

  promptSize(): void {
    this.filterRange('Enter sizes (e.g. 2 / 1,3):', 'size', 1, 3);
  }

  promptUsername(): void {
    if (!this.layer) { return; }
    const value = prompt('Enter username:');
    this.filters.username.set(value || undefined);
    this.applyFilters();
  }

  filterRange(msg: string, key: keyof AnalysisFilters, min: number, max: number): void {
    if (!this.layer) { return; }
    const value = prompt(msg);

    if (!value) {
      const signal = this.filters[key] as WritableSignal<Array<number> | undefined>;
      signal.set(undefined);
      this.applyFilters();
      return;
    }

    const parsed = this.parseRange(value, min, max);
    if (parsed.some(val => isNaN(val) || val < min || val > max)) {
      alert('Invalid value.');
      return;
    }
    console.log('Parsed', parsed);

    const signal = this.filters[key] as WritableSignal<Array<number> | undefined>;
    signal.set(parsed);
    this.applyFilters();
  }

  applyFilters(): void {
    const layer = this.layer();
    if (!layer) { return; }
    this.markers().forEach(marker => {
      const dayOfWeek = marker.date.weekday;
      const hourOfDay = marker.date.hour;

      let isValid = true;
      isValid &&= this.filters.username() ? marker.username === this.filters.username() : true;
      isValid &&= this.filters.hourOfDay() ? this.filters.hourOfDay()!.includes(hourOfDay) : true;
      isValid &&= this.filters.dayOfWeek() ? this.filters.dayOfWeek()!.includes(dayOfWeek) : true;
      isValid &&= this.filters.dayOfMonth() ? this.filters.dayOfMonth()!.includes(marker.date.day) : true;
      isValid &&= this.filters.weekOfYear() ? this.filters.weekOfYear()!.includes(marker.date.weekNumber) : true;
      isValid &&= this.filters.size() ? this.filters.size()!.includes(marker.size) : true;
      isValid &&= this.filters.custom ? this.filters.custom(marker) : true;

      isValid
        ? layer.addLayer(marker.marker!)
        : layer.removeLayer(marker.marker!);
    });
  }

  /** Utility function to parse range strings (e.g., "1-3,5"). */
  private parseRange(rangeStr: string, min: number, max: number): Array<number> {
    if (rangeStr === 'even') {
      return Array.from({ length: max - min + 1 }, (_, i) => i + min).filter(i => i % 2 === 0);
    } else if (rangeStr === 'uneven') {
      return Array.from({ length: max - min + 1 }, (_, i) => i + min).filter(i => i % 2 === 1);
    }

    return rangeStr.split(',').flatMap(part => {
      const range = part.split('-').map(Number);
      if (range.length === 1) {
        return range[0];
      } else if (range.length === 2) {
        const [start, end] = range;
        if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
          return [];
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      } else {
        return [];
      }
    });
  }

}
