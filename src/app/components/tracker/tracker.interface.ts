import { ITrackerMap } from './tracker-maps';

export interface IPanDialogData {
  selectedMap?: ITrackerMap;
  maps?: Array<ITrackerMap>;
}

export interface IMarkerDialogData {
  size: 'small' | 'medium' | 'large';
  pos: L.LatLngExpression;
}
