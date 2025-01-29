import { AfterViewInit, Component, ElementRef, isDevMode, OnInit, ViewChild } from '@angular/core';
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

@Component({
  selector: 'app-tracker',
  imports: [ MatIconModule, MatButtonModule, MatDialogModule ],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.scss'
})
export class TrackerComponent implements OnInit, AfterViewInit {
  @ViewChild('divMap', { static: true }) mapDiv!: ElementRef<HTMLDivElement>;

  map?: L.Map;
  mapImageLayers: { [key: string]: L.ImageOverlay } = {};
  isEdgeMarkersInitialized = false;
  isAddingMarker = false;
  addMarker?: L.Marker;
  isFirstMarker = true;

  // Socket
  ws?: WebSocket;

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
    const url = new URL(location.origin);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.pathname = '/api/ws';

    const ws = new WebSocket(url.toString());
    this.ws = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket.');
    };

    ws.onmessage = (event) => {
      console.log('Message from server:', event.data);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
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

    this.initializeEdgeMarkers();

    // Add marker on click.
    map.on('click', (e) => {
      if (isDevMode()) { navigator.clipboard.writeText(`[${e.latlng.lat}, ${e.latlng.lng}]`); }

      if (this.isAddingMarker && !this.addMarker) {
        this.createAddMarker(e.latlng);
      }
    });
  }

  createAddMarker(pos: L.LatLng): void {
    // Create marker
    const marker = L.marker(pos, { icon: trackerIcons.newPlant, draggable: true }).addTo(this.map!);
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

  wsSaveMarker(result: IMarkerDialogData): void {
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
