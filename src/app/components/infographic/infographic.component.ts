import { HttpClient } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { DomSanitizer, HammerModule, SafeHtml } from '@angular/platform-browser';
import L from 'leaflet';
import 'hammerjs';
import { OverlayComponent } from "../overlay/overlay.component";
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-infographic',
  templateUrl: './infographic.component.html',
  styleUrl: './infographic.component.scss',
  imports: [HammerModule, OverlayComponent, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfographicComponent implements AfterViewInit {
  @ViewChild('divMap', { static: true }) mapDiv!: ElementRef<HTMLDivElement>;

  map!: L.Map;

  private readonly _http = inject(HttpClient);
  private readonly _changeDetectorRef = inject(ChangeDetectorRef);
  private readonly _domSanitizer = inject(DomSanitizer);

  svgContent = signal<SafeHtml>('');
  isOverlayVisible = false;

  constructor(
  ) {

  }

  ngAfterViewInit(): void {
    this._http.get('/assets/external/maps/infographic/test.svg', { responseType: 'text' }).subscribe((svg) => {
      // Replace relative paths with asset path.
      svg = svg.replace(/xlink:href="([^"]+)"/g, (match, p1) => {
        return `xlink:href="/assets/external/maps/infographic/${p1}"`;
      }).replace(/\.png/g, '.webp');

      const sanitizedSvg = this._domSanitizer.bypassSecurityTrustHtml(svg);
      this.svgContent.set(sanitizedSvg);
    });
  }

  onMapClick(event: MouseEvent): void {
    // get element at cursor
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (element?.tagName === 'path') {
      this.selectPolygon(element as SVGPathElement);
    }

  }

  onSwipeLeft(e: Event): void {
    alert('Swipe left');
    console.log(e);
  }

  onSwipeRight(e: Event): void {
    alert('Swipe right');
    console.log(e);
  }

  onSwipeUp(e: Event): void {
    alert('Swipe up');
    console.log(e);
  }

  onSwipeDown(e: Event): void {
    alert('Swipe down');
    console.log(e);
  }

  selectPolygon(path: SVGPathElement): void {
    const description = path.dataset['description'];
    alert(`Select polygon: ${description}`);
  }
}
