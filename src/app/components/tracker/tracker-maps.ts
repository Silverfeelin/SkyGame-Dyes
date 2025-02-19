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
    pos: [0, 0],
    areas: [
      {
        name: 'Village Islands',
        polygon: [[2130,68],[2148,1270],[2666,1116],[2750.5,897],[2735.5,530],[2628,96]]
      },
      {
        name: 'Prairie Cave',
        polygon: [[1146,182],[1302,1028],[1644,1094],[2074,814],[2108,174],[1794,92]]
      },
      {
        name: 'Bird\'s Nest',
        polygon: [[1470,2200],[1628,1938],[1574,1422],[1460,1256],[1184,1314],[1012,1512],[936,1708],[1182,2212]]
      },
      {
        name: 'Sanctuary Island',
        polygon: [[1647,1407],[1655,2019],[1513,2193],[1519,2458],[2770,2432],[2744,1834],[2546,1530],[2356,1362]]
      },
      {
        name: 'Temple Entrance',
        polygon: [[3079,800],[2887,804],[2756,1045],[2864,1248],[3175,1236],[3169,807]]
      }
    ]
  },
  {
    name: 'Prairie Peaks',
    realm: 'Daylight Prairie',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/peaks.webp',
    size: [3508, 2480],
    pos: [0, 2800],
    areas: [
      {
        name: 'Prairie Peaks',
        polygon: [[0,2800],[0,5280],[3508,5280],[3508,2800]]
      }
    ]
  },
  {
    name: 'Hidden Forest',
    realm: 'Hidden Forest',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/forest.webp',
    size: [3508, 2480],
    pos: [0, 105600],
    areas: [
      {
        name: 'Forest Social Space',
        polygon: [[152,105822],[171,106407],[472,106382],[474,105783]]
      },
      {
        name: 'Forest Clearing',
        polygon: [[1044.5,106399],[1046.5,105825],[962,105755],[685,105832],[520,105925],[481,106098.5],[471.5,106360],[608,106366],[710,106310],[863,106330],[974,106402]]
      },
      {
        name: 'Rainy Forest',
        polygon: [[1057,105818],[1057,106396],[1171,106490],[1506,106424],[1928,106380],[1960,106198],[1947,105746],[1661,105677],[1432,105816]]
      },
      {
        name: 'Forest Brook',
        polygon: [[2050,106044],[2004,106450],[2196,106660],[2690,106708],[2830,106862],[2998,106844],[3268,106382],[3310,105886],[3096,105736],[2408,105776],[2156,105864]]
      },
      {
        name: 'Elevated Clearing',
        polygon: [[900,107012],[590,107018],[156,107388],[151,107810.5],[396,108026],[867,107995],[892,107580]]
      },
      {
        name: 'Underground Cavern',
        polygon: [[912,107010],[914,107942],[1310,107918],[1324,108045],[1708,108028],[1704,107700],[1619,107458],[1600,107088],[1406.5,107000]]
      },
      {
        name: 'Broken Bridge',
        polygon: [[2254,106782],[1686,107242],[1880,107850],[2178,107852],[2436,107660],[2722,107644],[3190,107406],[3184,106996],[2714,106938],[2550,106782]]
      },
    ]
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
    pos: [0, 208400],
    areas: [
      {
        name: 'Broken Temple',
        polygon: [[878,208416],[50,208422],[64,209736],[678,209716],[970,209480],[970,208578]]
      },
      {
        name: 'Graveyard',
        polygon: [[1006,208446],[1028,209552],[1654,209376],[1834,209370],[2064,209850],[2420,209852],[2718,209312],[2746,208996],[2662,208624],[2304,208488]]
      },
      {
        name: 'Crab Fields',
        polygon: [[2152,210200],[1864,209476],[1542,209512],[1406,209802],[1412,210762],[1750,210822],[2108,210750]]
      },
      {
        name: 'Battlefield',
        polygon: [[2608,209528],[2252,210406],[3104,210812],[3182,210704],[3176,210122],[2992,209686],[2776,209646]]
      },
      {
        name: 'Forgotten Ark',
        polygon: [[1380,210018],[1220,209566],[904,209554],[787,209615],[582,209924],[602,210758],[1176,210790],[1326,210470]]
      }
    ]
  },
  {
    name: 'Treasure Reef',
    realm: 'Golden Wasteland',
    attribution: '@sky_solsuga',
    src: '/assets/external/maps/solsuga/reef.webp',
    size: [3508, 2480],
    pos: [0, 211200],
    areas: [
      {
        name: 'Treasure Reef',
        polygon: [[0,211200],[0,213680],[3508,213680],[3508,211200]]
      }
    ]
  }
]

export interface ITrackerMap {
  name: string;
  realm: string;
  attribution?: string;
  src: string;
  size: L.LatLngTuple;
  pos: L.LatLngTuple;
  areas?: Array<ITrackerMapArea>;
}

export interface ITrackerMapArea {
  name: string;
  polygon: Array<L.LatLngTuple>;
}
