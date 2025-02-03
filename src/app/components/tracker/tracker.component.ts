import { AfterViewInit, Component, ElementRef, isDevMode, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DateTime } from 'luxon';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import L from 'leaflet';
import { trackerIcons } from './tracker-icons';
import { trackerMaps } from './tracker-maps';
import { DateHelper } from '../../helpers/date-helper';
import { IPanDialogData } from './tracker.interface';
import { TrackerMapMarkerDialogComponent } from './tracker-map-marker-dialog.component';
import { TrackerMapAreaDialogComponent } from './tracker-map-area-dialog.component';
import { DateTimePipe } from '../../pipes/date-time.pipe';

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

  constructor(
    private readonly _dialog: MatDialog
  ) {
    (window.L) = L;
    const edgeMarkerScript = document.createElement('script');
    edgeMarkerScript.src = '/assets/external/leaflet/edgemarker/Leaflet.EdgeMarker.js';
    document.body.appendChild(edgeMarkerScript);

    edgeMarkerScript.onload = () => {
      this.initializeEdgeMarkers();
    };
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
}
