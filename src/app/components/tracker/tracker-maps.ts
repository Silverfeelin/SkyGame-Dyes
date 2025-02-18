// Coordinates are [lat, lng] (y, x).
// Every map has an offset of 320.
// Every realm has an offset of 100,000.
export const trackerMaps: Array<ITrackerMap> = [
  {
    name: 'Daylight Prairie',
    realm: 'Daylight Prairie',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/prairie.webp',
    size: [3508, 2480],
    pos: [0, 0]
  },
  {
    name: 'Prairie Peaks',
    realm: 'Daylight Prairie',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/peaks.webp',
    size: [3508, 2480],
    pos: [0, 2800]
  },
  {
    name: 'Hidden Forest',
    realm: 'Hidden Forest',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/forest.webp',
    size: [3508, 2480],
    pos: [0, 105600]
  },
  {
    name: 'Valley of Triumph',
    realm: 'Valley of Triumph',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/valley.webp',
    size: [3508, 2480],
    pos: [100000, 0]
  },
  {
    name: 'Golden Wasteland',
    realm: 'Golden Wasteland',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/wasteland.webp',
    size: [3508, 2480],
    pos: [0, 208400]
  },
  {
    name: 'Treasure Reef',
    realm: 'Golden Wasteland',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/reef.webp',
    size: [3508, 2480],
    pos: [0, 211200]
  }
]

export interface ITrackerMap {
  name: string;
  realm: string;
  attribution?: string;
  src: string;
  size: L.LatLngTuple;
  pos: L.LatLngTuple;
}
