export const trackerMaps: Array<ITrackerMap> = [
  {
    name: 'Daylight Prairie',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/prairie.webp',
    size: [3508, 2480]
  },
  {
    name: 'Prairie Peaks',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/peaks.webp',
    size: [3508, 2480]
  }
]

export interface ITrackerMap {
  name: string;
  attribution?: string;
  src: string;
  size: L.LatLngTuple;
}
