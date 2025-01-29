import L from 'leaflet';

export const trackerIcons = {
  small: L.icon({
    iconUrl : '/assets/external/icons/small.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 32, 32 ],
    shadowSize: [ 36, 36 ],
    shadowAnchor: [ 18, 18 ],
  }),
  medium: L.icon({
    iconUrl : '/assets/external/icons/medium.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 32, 32 ],
    shadowSize: [ 36, 36 ],
    shadowAnchor: [ 18, 18 ],
  }),
  large: L.icon({
    iconUrl : '/assets/external/icons/large.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 48, 48 ],
    shadowSize: [ 52, 52 ],
    shadowAnchor: [ 26, 26 ],
  }),
  new: L.icon({
    iconUrl : '/assets/icons/plus.png',
    shadowUrl: '/assets/external/icons/shadow.svg',
    iconSize: [ 32, 32 ],
    shadowSize: [ 36, 36 ],
    shadowAnchor: [ 18, 18 ],
  }),
};
