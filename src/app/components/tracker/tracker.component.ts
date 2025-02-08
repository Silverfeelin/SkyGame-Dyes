import { AfterViewInit, Component, ElementRef, isDevMode, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DateTime } from 'luxon';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import L from 'leaflet';
import 'leaflet.markercluster';
import { trackerIcons } from './tracker-icons';
import { trackerMaps } from './tracker-maps';
import { DateHelper } from '../../helpers/date-helper';
import { IPanDialogData } from './tracker.interface';
import { TrackerMapMarkerDialogComponent } from './tracker-map-marker-dialog.component';
import { TrackerMapAreaDialogComponent } from './tracker-map-area-dialog.component';
import { DateTimePipe } from '../../pipes/date-time.pipe';
import { HttpClient } from '@angular/common/http';

interface IMapMarker {
  marker?: L.Marker;
  id: number;
  epoch: number;
  lat: number;
  lng: number;
  size: number;
}

interface IWsAddMarker {
  lat: number;
  lng: number;
  size: 1 | 2 | 3;
}

type WsMarker = [ number, number, number, number, number ]; // [id, epoch, lat, lng, size ]

interface IReceivedMessage {
	type: 'marker' | 'markers' | 'delete' | 'validation';
  id?: number;
  markers?: Array<WsMarker>;
	marker?: WsMarker;
	message?: string;
}

interface IAnalysisResponseData {
  columns: Array<string>;
  markers: Array<Array<unknown>>;
}

interface IAnalysisMarker extends IMapMarker {
  userId: string;
  username: string;
  createdOn: string;
  date: DateTime;
}

type AnalysisFilters = {
  custom?: (m: IAnalysisMarker) => boolean;
  hourOfDay?: Array<number>;
  dayOfWeek?: Array<number>;
  dayOfMonth?: Array<number>;
  weekOfYear?: Array<number>;
  size?: Array<number>;
  username?: string;
}

type WebSocketStatus = 'connecting' | 'open' | 'closed';
@Component({
  selector: 'app-tracker',
  imports: [ MatIconModule, MatButtonModule, MatDialogModule, DateTimePipe ],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.scss'
})
export class TrackerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('divMap', { static: true }) mapDiv!: ElementRef<HTMLDivElement>;

  // Map
  map?: L.Map;
  mapImageLayers: { [key: string]: L.ImageOverlay } = {};
  mapMarkerLayer?: L.LayerGroup;
  mapMarkers: Array<IMapMarker> = [];
  mapRealmLayers: { [key: string]: L.LayerGroup } = {};
  mapCurrentRealmIndex = 0;
  isEdgeMarkersInitialized = false;

  // Add marker
  isAddingMarker = false;
  addMarker?: L.Marker;
  isFirstMarker = localStorage.getItem('tracker-first-marker') !== 'false';

  // Socket
  ws?: WebSocket;
  wsStatus: WebSocketStatus = 'closed';
  wsStatusText = 'Disconnected';
  wsPollInterval?: number;

  clockInterval?: number;
  clockLastClear = DateTime.now().setZone(DateHelper.skyTimeZone).startOf('hour');
  clockSkyTime?: DateTime;

  // Analysis
  devMode = isDevMode();
  isAnalysisPanelVisible = false;
  analysisMarkers?: Array<IAnalysisMarker>;
  analysisFilters: AnalysisFilters = {};
  mapAnalysisLayer?: L.LayerGroup;

  constructor(
    private readonly _dialog: MatDialog,
    private readonly _zone: NgZone,
    private readonly _http: HttpClient
  ) {
    (window.L) = L;
    const edgeMarkerScript = document.createElement('script');
    edgeMarkerScript.src = '/assets/external/leaflet/edgemarker/Leaflet.EdgeMarker.js';
    document.body.appendChild(edgeMarkerScript);

    edgeMarkerScript.onload = () => {
      this.initializeEdgeMarkers();
    };

    (window as any).analysisDownload = () => _zone.run(() => this.analysisDownload());
    (window as any).analysisPromptFile = () => _zone.run(() => this.analysisPromptFile());
    (window as any).analysisSetFilter = (f: (m: IAnalysisMarker) => boolean) => _zone.run(() => this.analysisSetFilter(f));
  }

  ngOnInit(): void {
    this.wsConnect();

    // Set up clock
    this.mapClearInactiveMarkers();
    this.clockInterval = setInterval(() => {
      this.mapClearInactiveMarkers();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.ws) {
      try { this.ws.close(); console.log('Closed websocket.'); } catch (e) { console.error(e); }

    }
  }

  ngAfterViewInit(): void {
    const map = L.map(this.mapDiv.nativeElement, {
      attributionControl: false,
      crs: L.CRS.Simple,
      minZoom: -4,
      maxZoom: 3,
      zoom: -2,
      center: [ 1754, 1240 ],
      zoomControl: false
    });
    this.map = map;

    L.control.attribution({ position: 'bottomright', prefix: 'Leaflet | Maps provided by' }).addTo(this.map);

    const pad = 320;
    const realmPad = 100000;
    let x =  -realmPad;
    let lastRealm = '';
    let realmLayer: L.LayerGroup | undefined;
    let firstLayer = true;
    trackerMaps.forEach((m) => {
      if (m.realm !== lastRealm) {
        x += realmPad;
        lastRealm = m.realm;
        realmLayer = L.layerGroup();
        this.mapRealmLayers[m.realm] = realmLayer;
        if (firstLayer) {
          realmLayer.addTo(map);
          firstLayer = false;
        }
      }

      const p1: L.LatLngExpression = [0, x];
      const p2: L.LatLngExpression = [m.size[0], x + m.size[1]];

      // Lazy load on click (if someone scrolls really far without using the map dialog).
      const rect = L.rectangle([p1, p2], { color: '#ddd', weight: 1, fillOpacity: 0 }).addTo(this.map!);
      rect.addEventListener('click', e => {
        this.mapRealmLayers[m.realm]?.addTo(map);
      });

      // Add label above map.
      L.marker([p1[0] + m.size[0] + 30, p1[1] + m.size[1] / 2], {
        icon: L.divIcon({
          className: 'map-label',
          html: m.name,
          iconSize: [100, 20]
        })
      }).addTo(this.map!);

      // Add map image.
      const layer = L.imageOverlay(m.src, [p1, p2], { attribution: m.attribution }).addTo(realmLayer!);
      this.mapImageLayers[m.name] = layer;
      x += m.size[1] + pad;
    });

    // Marker layer
    this.mapMarkerLayer = L.layerGroup().addTo(map);

    // EdgeMarker plugin
    this.initializeEdgeMarkers();

    // Add marker on click.
    map.on('click', (e) => {
      if (isDevMode()) { navigator.clipboard.writeText(`[${e.latlng.lat}, ${e.latlng.lng}]`); }

      if (this.isAddingMarker && !this.addMarker) {
        this.mapPlaceCreateMarker(e.latlng);
      }
    });
  }

  mapNextRealm(): void {
    const currentRealm = trackerMaps[this.mapCurrentRealmIndex].realm;
    let i = -1;
    for (let j = this.mapCurrentRealmIndex + 1; j < trackerMaps.length; j++) {
      if (trackerMaps[j].realm !== currentRealm) { i = j; break; }
    }
    if (i < 0) { i = 0; }

    const map = trackerMaps[i];
    this.mapCurrentRealmIndex = i;
    this.mapRealmLayers[map.realm]?.addTo(this.map!);
    this.map!.fitBounds(this.mapImageLayers[map.name].getBounds(), {});
  }

  mapPreviousRealm(): void {
    const currentRealm = trackerMaps[this.mapCurrentRealmIndex].realm;
    let i = -1;
    for (let j = this.mapCurrentRealmIndex - 1; j >= 0; j--) {
      if (trackerMaps[j].realm !== currentRealm) { i = j; break; }
    }
    if (i < 0) { i = trackerMaps.length - 1; }

    const map = trackerMaps[i];
    this.mapCurrentRealmIndex = i;
    this.mapRealmLayers[map.realm]?.addTo(this.map!);
    this.map!.fitBounds(this.mapImageLayers[map.name].getBounds(), {});
  }

  /** Adds a marker to the map. */
  mapAddMarker(marker: IMapMarker): void {
    if (!this.mapMarkerLayer) { return; }

    const sizeIcon = marker.size === 3 ? 'large'
      : marker.size === 1 ? 'small'
      : 'medium';
    const icon = trackerIcons[sizeIcon];
    const m = L.marker([ marker.lat, marker.lng ], { icon });
    marker.marker = m;

    this.mapMarkerLayer.addLayer(marker.marker);
    this.mapMarkers.push(marker);

    // Create popup content
    const template = document.getElementById('template-marker-popup') as HTMLTemplateElement;
    const div = document.createElement('div');
    div.appendChild(template.content.cloneNode(true));

    div.querySelector('.marker-popup-delete')?.addEventListener('click', () => {
      if (!this.ws?.OPEN) {
        alert('Not connected. Please reconnect before deleting.');
        return;
      }

      const data = JSON.stringify({
        type: 'delete',
        id: marker.id
      });

      this.ws.send(data);
    });

    const popup = L.popup({
      content: div,
      offset: [0, -12],
    });
    m.bindPopup(popup);

    m.on('dblclick', () => {
      const opacity = m.options.opacity !== 0.3 ? 0.3 : 1;
      m.setOpacity(opacity);
      m.closePopup();
    });
  }

  mapClearInactiveMarkers(): void {
    const now = DateTime.now().setZone(DateHelper.skyTimeZone);
    this.clockSkyTime = now;
    const epoch = now.startOf('hour').toMillis();

    this.mapMarkers = this.mapMarkers.filter(marker => {
      if (marker.epoch < epoch) {
        this.mapMarkerLayer?.removeLayer(marker.marker!);
        return false;
      }
      return true;
    });
  }


  /** Starts adding a map marker.  */
  mapPlaceCreateMarker(pos: L.LatLng): void {
    // Create marker
    const marker = L.marker(pos, { icon: trackerIcons.new, draggable: true }).addTo(this.map!);
    this.addMarker = marker;

    const data: IWsAddMarker = {
      lat: pos.lat,
      lng: pos.lng,
      size: 2
    };

    // Create popup content
    const template = document.getElementById('template-create-popup') as HTMLTemplateElement;
    const div = document.createElement('div');
    div.appendChild(template.content.cloneNode(true));

    const sizes = [...div.querySelectorAll('.img-size')];
    sizes.forEach(s => s.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const size = +(target.dataset['size'] as any);
      data.size = (size >= 1 && size <= 3 ? size : 2) as 1 | 2 | 3;
      sizes.forEach(s => s.classList.remove('img-size-active'));
      target.classList.add('img-size-active');
    }));

    // Save
    div.querySelector('.marker-popup-save')?.addEventListener('click', () => {
      if (!this.ws?.OPEN) {
        alert('Not connected. Please reconnect before saving.');
        return;
      }

      const pos = marker.getLatLng();
      data.lat = pos.lat;
      data.lng = pos.lng;
      this.wsSaveMarker(data);

      marker.remove();
      this.addMarker = undefined;
    });

    // Cancel
    div.querySelector('.marker-popup-delete')?.addEventListener('click', () => {
      marker.remove();
      this.addMarker = undefined;
    });

    // Add popup
    const popup = L.popup({
      content: div,
      offset: [0, -12],
    });
    this.addMarker.bindPopup(popup).openPopup();
  }

  openMapDialog(): void {
    const dialogRef = this._dialog.open(TrackerMapAreaDialogComponent, {
      data: { maps: trackerMaps }
    });

    dialogRef.afterClosed().subscribe((result: IPanDialogData) => {
      if (!result?.selectedMap) { return; }
      const map = result.selectedMap;
      const layer = this.mapImageLayers[map.name];
      if (!layer) { return; }

      const realmLayer = this.mapRealmLayers[map.realm]!;
      realmLayer.addTo(this.map!);

      this.map?.fitBounds(layer.getBounds(), {});
    });
  }

  openMarkerDialog(): void {
    // Check if near the end of the rotation and prevent adding new markers.
    if (!this.isAddingMarker) {
      const now = DateTime.now().setZone(DateHelper.skyTimeZone);
      if (now.minute >= 55 && !isDevMode()) {
        alert('New dye plants are about to bloom! Please wait until the next hour starts.');
        return;
      }
    }

    // Warn before canceling.
    if (this.isAddingMarker && this.addMarker && !confirm('Are you sure you want to cancel adding your new marker?')) {
      return;
    }

    // Show instructions on first marker.
    this.isAddingMarker = !this.isAddingMarker;
    if (this.isAddingMarker && this.isFirstMarker) {
      this._dialog.open(TrackerMapMarkerDialogComponent);
      this.isFirstMarker = false;
      localStorage.setItem('tracker-first-marker', 'false');
    } else if (!this.isAddingMarker) {
      this.addMarker?.remove();
      this.addMarker = undefined;
    }
  }

  // #region Websocket stuff

  wsConnect(): void {
    if (this.ws) { return; }

    const url = new URL(location.origin);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.pathname = '/api/ws';

    const ws = new WebSocket(url.toString());
    this.ws = ws;
    this.wsUpdateStatus('connecting');

    ws.onopen = (evt) => {
      this.wsUpdateStatus('open');
      console.log('Connected to WebSocket.', evt);
      this.wsPoll();
    };

    ws.onmessage = (evt) => {
      if (evt.data === 'pong') { return; }
      console.log('Message from server:', evt.data);
      this.wsOnMessage(evt.data);
    };

    ws.onclose = (evt) => {
      console.log('WebSocket connection closed', evt);
      this.wsDisconnect();

      if (evt.reason) {
        setTimeout(() => {
          alert(`Lost connection. Please try to reconnect by pressing the cloud icon in the bottom left corner. Reason: ${evt.reason}`);
        });
      }
    };

    ws.onerror = (e) => {
      console.error('WebSocket error:', );
      this.wsDisconnect();
    };
  }

  wsPoll(): void {
    if (this.wsPollInterval) {
      clearInterval(this.wsPollInterval);
      this.wsPollInterval = undefined;
    }

    if (!this.ws) { return; }
    let pollCount = 0;
    this.wsPollInterval = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) { return; }
      this.ws.send('ping');
      if (++pollCount < 10) { return; }
      clearInterval(this.wsPollInterval);
      this.wsPollInterval = undefined;
    }, 60 * 1000);
  }

  wsDisconnect(): void {
    if (!this.ws) { return; }
    try { this.ws?.close(); } catch (e) { console.error(e); }
    this.wsUpdateStatus('closed');
    this.ws = undefined;
  }

  wsSaveMarker(result: IWsAddMarker): void {
    if (!this.ws) {
      console.error('WebSocket not connected.');
      return;
    }

    const data = JSON.stringify({
      type: 'marker',
      size: result.size,
      lat: result.lat,
      lng: result.lng
    });

    this.ws.send(data);
  }

  wsUpdateStatus(status: WebSocketStatus): void {
    this.wsStatus = status;
    switch (status) {
      case 'connecting': this.wsStatusText = 'Connecting...'; break;
      case 'open': this.wsStatusText = 'Connected'; break;
      case 'closed': this.wsStatusText = 'Disconnected'; break;
      default: this.wsStatusText = 'Unknown'; break;
    }
  }

  wsOnMessage(msg: string): void {
    try {
      const data = JSON.parse(msg) as IReceivedMessage;
      if (typeof data !== 'object') { throw new Error('Invalid message data structure.'); }
      switch (data.type) {
        case 'markers': this.wsOnMarkers(data); break;
        case 'marker': this.wsOnMarker(data); break;
        case 'delete': this.wsOnDelete(data); break;
        case 'validation': alert(data.message || 'Something went wrong.'); break;
        default: throw new Error('Invalid message type.');
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  }

  wsOnMarkers(msg: IReceivedMessage): void {
    const markers = (msg.markers || []).map(m => this.wsDeserializeMarker(m));
    const markerIds = new Set(markers.map(m => m.id));

    // Remove markers that are not in the new list.
    const mapMarkerIds = new Set();
    const mapMarkers: Array<IMapMarker> = [];
    this.mapMarkers.forEach(m => {
      if (markerIds.has(m.id)) {
        mapMarkers.push(m);
        mapMarkerIds.add(m.id);
      } else {
        m.marker?.remove();
      }
    });

    // Add new markers from the list.
    this.mapMarkers = mapMarkers;
    markers.filter(m => !mapMarkerIds.has(m.id)).forEach(m => {
      this.mapAddMarker(m);
    });
  }

  wsOnMarker(msg: IReceivedMessage): void {
    if (!msg?.marker) { throw new Error('Invalid marker data.'); }
    if (!this.map) { throw new Error('Map not initialized.'); }

    const marker = this.wsDeserializeMarker(msg.marker);
    this.mapAddMarker(marker);
  }

  wsOnDelete(msg: IReceivedMessage): void {
    if (!msg.id) { return; }
    const i = this.mapMarkers.findIndex(m => m.id === msg.id);
    if (i < 0) { return; }

    const marker = this.mapMarkers[i];
    marker.marker?.remove();
    this.mapMarkers.splice(i, 1);
  }

  wsDeserializeMarker(msg: WsMarker): IMapMarker {
    const marker: IMapMarker = {
      id: msg[0],
      epoch: msg[1],
      lat: msg[2],
      lng: msg[3],
      size: msg[4]
    };

    return marker;
  }

  wsOnValidation(msg: IReceivedMessage): void {
    if (!msg?.message) { throw new Error('Invalid validation message.'); }
    alert(msg.message);
  }

  // #endregion

  /** Attempts to initialize the Leaflet.EdgeMarker plugin. */
  private initializeEdgeMarkers(): void {
    // Disabled until I figure out how to target specific markers.

    // if (this.isEdgeMarkersInitialized || !this.map) { return; }
    // const edgeMarker = (L as any).edgeMarker;
    // if (!edgeMarker) { return; }
    // this.isEdgeMarkersInitialized = true;

    // edgeMarker({
    //   icon: (L as any).icon({
    //       iconUrl: '/assets/external/leaflet/edgemarker/arrow.png',
    //       clickable: true,
    //       iconSize: [48, 48],
    //       iconAnchor: [24, 24]
    //   }),
    //   rotateIcons: true,
    //   layerGroup: null
    // }).addTo(this.map);
  }

  // #region Analysis stuff

  analysisDownload(): void {
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

  analysisPromptFile(): void {
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
        this.analysisLoadData(parsed);
      };

      reader.readAsText(file);
    });

    input.click();
  }

  analysisLoadData(data: IAnalysisResponseData): void {
    console.log(data);
    this.mapMarkerLayer?.remove();
    this.mapAnalysisLayer?.remove();
    this.mapAnalysisLayer = L.markerClusterGroup({
      disableClusteringAtZoom: 1
    }).addTo(this.map!);

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

    this.analysisMarkers = markers;

    markers.forEach(marker => {
      if (!this.mapAnalysisLayer) { return; }
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

      this.mapAnalysisLayer.addLayer(marker.marker);
    });
  }

  analysisReset(): void {
    if (!this.mapAnalysisLayer) { return; }
    this.analysisFilters = {};
    this.analysisApplyFilters();
  }

  analysisFilterDayOfWeek(): void {
    this.analysisFilterRange('Enter days (e.g. 1-7 / 1,3,5,7 / even / uneven):', 'dayOfWeek', 1, 7);
  }

  analysisFilterDayOfMonth(): void {
    this.analysisFilterRange('Enter days of the month (e.g. 1-31 / 1,15,31 / even / uneven):', 'dayOfMonth', 1, 31);
  }

  analysisFilterHourOfDay(): void {
    this.analysisFilterRange('Enter hours (e.g. 0-11 / 0,2,4 / even / uneven):', 'hourOfDay', 0, 23);
  }

  analysisFilterWeekOfYear(): void {
    this.analysisFilterRange('Enter weeks of the year (e.g. 1-53 / 1,5,9 / even / uneven):', 'weekOfYear', 1, 53);
  }

  analysisFilterSize(): void {
    this.analysisFilterRange('Enter sizes (e.g. 2 / 1,3):', 'size', 1, 3);
  }

  analysisSetFilter(f: (m: IAnalysisMarker) => boolean): any {
    this.analysisFilters.custom = f;
  }

  analysisFilterUsername(): void {
    if (!this.mapAnalysisLayer) { return; }
    const value = prompt('Enter username:');
    this.analysisFilters.username = value || undefined;
    this.analysisApplyFilters();
  }

  analysisFilterRange(msg: string, key: keyof AnalysisFilters, min: number, max: number): void {
    if (!this.mapAnalysisLayer) { return; }
    const value = prompt(msg);

    if (!value) {
      this.analysisFilters[key] = undefined;
      this.analysisApplyFilters();
      return;
    }

    const parsed = this.parseRange(value, min, max);
    if (parsed.some(val => isNaN(val) || val < min || val > max)) {
      alert('Invalid value.');
      return;
    }
    console.log('Parsed', parsed);

    this.analysisFilters[key] = parsed as any;
    this.analysisApplyFilters();
  }

  analysisApplyFilters(): void {
    this.analysisMarkers?.forEach(marker => {
      const dayOfWeek = marker.date.weekday;
      const hourOfDay = marker.date.hour;

      let isValid = true;
      isValid &&= this.analysisFilters.username ? marker.username === this.analysisFilters.username : true;
      isValid &&= this.analysisFilters.hourOfDay?.length ? this.analysisFilters.hourOfDay.includes(hourOfDay) : true;
      isValid &&= this.analysisFilters.dayOfWeek?.length ? this.analysisFilters.dayOfWeek.includes(dayOfWeek) : true;
      isValid &&= this.analysisFilters.dayOfMonth?.length ? this.analysisFilters.dayOfMonth.includes(marker.date.day) : true;
      isValid &&= this.analysisFilters.weekOfYear?.length ? this.analysisFilters.weekOfYear.includes(marker.date.weekNumber) : true;
      isValid &&= this.analysisFilters.size?.length ? this.analysisFilters.size.includes(marker.size) : true;
      isValid &&= this.analysisFilters.custom ? this.analysisFilters.custom(marker) : true;

      isValid
        ? this.mapAnalysisLayer?.addLayer(marker.marker!)
        : this.mapAnalysisLayer?.removeLayer(marker.marker!);
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

  // #endregion
}
