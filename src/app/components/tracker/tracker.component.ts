import { AfterViewInit, Component, ElementRef, isDevMode, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DateTime } from 'luxon';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import L from 'leaflet';
import { trackerIcons } from './tracker-icons';
import { trackerMaps } from './tracker-maps';
import { DateHelper } from '../../helpers/date-helper';
import { IMarkerDialogData, IPanDialogData } from './tracker.interface';
import { TrackerMapMarkerDialogComponent } from './tracker-map-marker-dialog.component';
import { TrackerMapAreaDialogComponent } from './tracker-map-area-dialog.component';
import { TrackerMapSaveDialogComponent } from './tracker-map-save-dialog.component';

interface IMapMarker {
  marker?: L.Marker;
  epoch: number;
  lat: number;
  lng: number;
  size: 'small' | 'medium' | 'large';
}

interface IReceivedMessage {
	type: 'marker' | 'validation';
	marker?: { epoch: number; lat: number; lng: number; size: number; }
	message?: string;
}

type WebSocketStatus = 'connecting' | 'open' | 'closed';
@Component({
  selector: 'app-tracker',
  imports: [ MatIconModule, MatButtonModule, MatDialogModule ],
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
  isEdgeMarkersInitialized = false;

  // Add marker
  isAddingMarker = false;
  addMarker?: L.Marker;
  isFirstMarker = true;

  // Socket
  ws?: WebSocket;
  wsStatus: WebSocketStatus = 'closed';
  wsStatusText = 'Disconnected';

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
    let x = 0;
    trackerMaps.forEach((m) => {
      const layer = L.imageOverlay(m.src, [[0, x], [m.size[0], x + m.size[1]]], { attribution: m.attribution }).addTo(map);
      this.mapImageLayers[m.name] = layer;
      x += m.size[1] + pad;
    });

    // Test markers
    // L.marker([ 250, 250 ], { icon: trackerIcons.smallPlant }).addTo(map);
    // L.marker([ 500, 500 ], { icon: trackerIcons.mediumPlant }).addTo(map);
    // L.marker([ 750, 750 ], { icon: trackerIcons.largePlant }).addTo(map);

    // Marker layer
    this.mapMarkerLayer = L.layerGroup().addTo(map);

    // EdgeMarker plugin
    this.initializeEdgeMarkers();

    // Add marker on click.
    map.on('click', (e) => {
      if (isDevMode()) { navigator.clipboard.writeText(`[${e.latlng.lat}, ${e.latlng.lng}]`); }

      if (this.isAddingMarker && !this.addMarker) {
        this.createAddMarker(e.latlng);
      }
    });
  }

  mapAddMarker(marker: IMapMarker): void {
    if (!this.mapMarkerLayer) { return; }

    const icon = trackerIcons[marker.size];
    const m = L.marker([ marker.lat, marker.lng ], { icon });
    marker.marker = m;

    this.mapMarkerLayer.addLayer(marker.marker);
    this.mapMarkers.push(marker);
  }

  createAddMarker(pos: L.LatLng): void {
    // Create marker
    const marker = L.marker(pos, { icon: trackerIcons.new, draggable: true }).addTo(this.map!);
    this.addMarker = marker;

    // Create popup content
    const template = document.getElementById('template-marker-popup') as HTMLTemplateElement;
    const div = document.createElement('div');
    div.appendChild(template.content.cloneNode(true));

    // Go to details
    const data: IMarkerDialogData = { lat: pos.lat, lng: pos.lng, size: 'medium' };
    div.querySelector('.marker-popup-save')?.addEventListener('click', () => {
      const dialogRef = this._dialog.open(TrackerMapSaveDialogComponent, { data, disableClose: true });
      dialogRef.afterClosed().subscribe((result: IMarkerDialogData) => {
        if (!result) { return; }
        this.wsSaveMarker(result);
        this.addMarker?.remove();
        this.addMarker = undefined;
        this.isAddingMarker = false;
      });
    });

    // Cancel
    div.querySelector('.marker-popup-delete')?.addEventListener('click', () => {
      marker.remove();
      this.addMarker = undefined;
      this.isAddingMarker = false;
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
    };

    ws.onmessage = (evt) => {
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

  wsDisconnect(): void {
    if (!this.ws) { return; }
    try { this.ws?.close(); } catch (e) { console.error(e); }
    this.wsUpdateStatus('closed');
    this.ws = undefined;
  }

  wsSaveMarker(result: IMarkerDialogData): void {
    if (!this.ws) {
      console.error('WebSocket not connected.');
      return;
    }

    let size = 1;
    switch (result.size) {
      case 'medium': size = 2; break;
      case 'large': size = 3; break;
      default: break;
    }

    const data = JSON.stringify({
      type: 'marker',
      size,
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
        case 'marker': this.wsOnMarker(data); break;
        case 'validation': alert(data); break;
        default: throw new Error('Invalid message type.');
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  }

  wsOnMarker(msg: IReceivedMessage): void {
    if (!msg?.marker) { throw new Error('Invalid marker data.'); }
    if (!this.map) { throw new Error('Map not initialized.'); }

    const marker: IMapMarker = {
      epoch: msg.marker.epoch,
      lat: msg.marker.lat,
      lng: msg.marker.lng,
      size: 'small'
    }

    switch (msg.marker.size) {
      case 2: marker.size = 'medium'; break;
      case 3: marker.size = 'large'; break;
      default: break;
    }

    this.mapAddMarker(marker);
  }

  wsOnValidation(msg: IReceivedMessage): void {
    if (!msg?.message) { throw new Error('Invalid validation message.'); }
    alert(msg.message);
  }

  // #endregion

  /** Attempts to initialize the Leaflet.EdgeMarker plugin. */
  private initializeEdgeMarkers(): void {
    if (this.isEdgeMarkersInitialized || !this.map) { return; }
    const edgeMarker = (L as any).edgeMarker;
    if (!edgeMarker) { return; }
    this.isEdgeMarkersInitialized = true;

    edgeMarker({
      icon: (L as any).icon({
          iconUrl: '/assets/external/leaflet/edgemarker/arrow.png',
          clickable: true,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
      }),
      rotateIcons: true,
      layerGroup: null
    }).addTo(this.map);
  }
}
