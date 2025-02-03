export const trackerMaps: Array<ITrackerMap> = [
  {
    name: 'Daylight Prairie',
    realm: 'Daylight Prairie',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/prairie.webp',
    size: [3508, 2480]
  },
  {
    name: 'Prairie Peaks',
    realm: 'Daylight Prairie',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/peaks.webp',
    size: [3508, 2480]
  },
  {
    name: 'Hidden Forest',
    realm: 'Hidden Forest',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/forest.webp',
    size: [3508, 2480]
  }
]

export interface ITrackerMap {
  name: string;
  realm: string;
  attribution?: string;
  src: string;
  size: L.LatLngTuple;
}
