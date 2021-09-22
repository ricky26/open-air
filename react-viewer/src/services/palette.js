
export const PALETTE = {
  COAST: '#272727',
  PIER: '#002412',
  DANGER: '#443402',
  RESTRICT: '#242300',
  PROHIBIT: '#310c02',
  TAXI_CENTER: '#0d0',
  TAXIWAY: '#00ea75',
  RUNWAY: '#2d1c2c',
  STOPBAR: '#b30000',
  BUILDING: '#a0a0a0',
  APRON: '#2c1c2c',
  AIRPORTLABEL: '#282828',
  FIXLABEL: '#404040',

  // Extras
  STOPLINE: 'white',
  GRASS: 'green',
  DYN_ACC_BKGND: 'transparent',
  DYN_ACC_CONTOUR: 'transparent',
  ILSDRAW: 'white',
  APTMARK: 'red',
  APPRON: 'gray',
  RWYFILL: 'gray',
  RWYEDGE: 'gray',
  APRFILL: 'gray',
  APREDGE: 'gray',
  TAXI_CENTER_BLUE: 'blue',
  ILSGATE: 'green',

  YELLOW: 'yellow',
  LIGHTGREY: 'lightgrey',
  DARKGREY: 'darkgrey',
  MIDDLEGREY: 'gray',
  '<RADARBACK>': 'blue',

  P_RUNWAY: 'gray',
  P_RUNWAY_MARK: 'red',
  P_RUNWAY_GRASS: 'green',
  P_BUILDING: 'gray',
  P_TAXIWAY: 'white',
  P_APRON: 'gray',
  P_RUNWAY_Y_MARK: 'gray',
  P_GRASS_BG: 'green',
};

export function hsv2rgb(h, s, v, a=1) {
  let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [f(5), f(3), f(1), a];
}

export function rgbToStr(r, g, b, a = 1) {
  const rs = Math.floor(r * 255).toFixed();
  const gs = Math.floor(g * 255).toFixed();
  const bs = Math.floor(b * 255).toFixed();
  return `rgba(${rs},${gs},${bs},${a})`;
}

export function parseStyle(style) {
  if (typeof style === 'number') {
    const s = '000000' + style.toString(16);
    return `#${s.substring(s.length - 6)}`;
  }

  const palette = PALETTE[style];
  if (palette !== undefined) {
    return palette;
  }

  return null;
}
