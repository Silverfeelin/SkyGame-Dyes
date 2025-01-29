import L from 'leaflet';

export const trackerIcons = {
  smallPlant: L.icon({
    iconUrl : '/assets/external/icons/small.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 32, 32 ],
    shadowSize: [ 36, 36 ],
    shadowAnchor: [ 18, 18 ],
  }),
  mediumPlant: L.icon({
    iconUrl : '/assets/external/icons/medium.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 32, 32 ],
    shadowSize: [ 36, 36 ],
    shadowAnchor: [ 18, 18 ],
  }),
  largePlant: L.icon({
    iconUrl : '/assets/external/icons/large.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 48, 48 ],
    shadowSize: [ 52, 52 ],
    shadowAnchor: [ 26, 26 ],
  }),
  newPlant: L.icon({
    iconUrl : '/assets/icons/plus.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 32, 32 ],
    shadowSize: [ 36, 36 ],
    shadowAnchor: [ 18, 18 ],
  }),
};
