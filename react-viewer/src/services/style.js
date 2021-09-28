import {useMemo, useRef} from "react";
import {number2rgb} from "./colour";

const DEFAULT_FONT = 'Roboto';

export const DEFAULT_PALETTE = {
  COAST: '#272727',
  PIER: '#002412',
  DANGER: '#443402',
  RESTRICT: '#242300',
  PROHIBIT: '#310c02',
  TAXI_CENTER: '#0d0',
  TAXIWAY: '#00ea75',
  RUNWAY: '#2d1c2c',
  RUNWAYCENTER: '#9aa3f1',
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

export const DEFAULT_LAYERS = {
  RUNWAYS: true,
  GROUND: true,
  LABELS: true,
  PILOTS: true,

  COAST: true,
  PIER: true,
  DANGER: true,
  RESTRICT: true,
  PROHIBIT: true,
  TAXI_CENTER: true,
  TAXIWAY: true,
  RUNWAY: true,
  RUNWAYCENTER: true,
  STOPBAR: true,
  BUILDING: true,
  APRON: true,
  AIRPORTLABEL: true,
  FIXLABEL: true,
};

export function styleStroke(ctx, style, name, f) {
  if (typeof name === 'number') {
    ctx.strokeStyle = number2rgb(name);
    f();
    return true;
  }

  return style.styleStroke(ctx, name, f);
}

export function styleFill(ctx, style, name, f) {
  if (typeof name === 'number') {
    ctx.fillStyle = number2rgb(name);
    f();
    return true;
  }

  return style.styleFill(ctx, name, f);
}

function nullUndefined(v) {
  return v === undefined ? null : v;
}

export function useMapStyle(config) {
  const latestConfig = useRef();
  latestConfig.current = config;
  return useMemo(() => {
    const getConfig = () => latestConfig.current.config;
    const withConfig = f => f(getConfig());
    const getColour = name => nullUndefined(withConfig(config =>
      Object.prototype.hasOwnProperty.call(config.palette, name)
        ? config.palette[name] : DEFAULT_PALETTE[name]));

    const showLayer = name => {
      let pref = getConfig().layersVisible[name];
      if (pref === null || pref === undefined) {
        pref = DEFAULT_LAYERS[name];
      }
      return pref;
    };

    return {
      get keys() {
        return latestConfig.current.keys;
      },
      styleStroke(context, name, f) {
        const strokeStyle = getColour(name);
        if (strokeStyle) {
          if (showLayer(name)) {
            context.strokeStyle = strokeStyle;
            f();
          }
        } else if (name) {
          console.log('missing style', name);
        }
      },
      styleFill(context, name, f) {
        const fillStyle = getColour(name);
        if (fillStyle) {
          if (showLayer(name)) {
            context.fillStyle = fillStyle;
            f();
          }
        } else if (name) {
          console.log('missing style', name);
        }
      },
      styleText(context, name, f) {
        f();
      },
      showLayer,
    };
  }, [latestConfig]);
}
