import {createContext, useContext} from "react";
import {Cache} from "./cache";

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
const MAX_SECTION_LEVEL = 8;
const DEBUG_SECTIONS = false;

const PALETTE = {
  COAST: '#444',
  PIER: '#444',
  DANGER: '#4027bd',
  RESTRICT: '#4027bd',
  PROHIBIT: '#4027bd',
  TAXI_CENTER: '#0d0',
  TAXIWAY: 'white',
  RUNWAY: '#7b6245',
  STOPBAR: 'white',
  STOPLINE: 'white',
  BUILDING: 'black',

  // Extras
  GRASS: 'green',
  APRON: 'gray',
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

function hsv2rgb(h, s, v) {
  let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [f(5), f(3), f(1)];
}

function rgbToStr(r, g, b) {
  const f = v => {
    const s = '00' + (v * 255).toFixed();
    return s.substring(s.length - 2);
  };
  return `#${f(r)}${f(g)}${f(b)}`;
}

function parseStyle(style) {
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

function normaliseAabb(a) {
  if (a[2] < a[0]) {
    const q = a[0];
    a[0] = a[2];
    a[2] = q;
  }

  if (a[3] < a[1]) {
    const q = a[1];
    a[1] = a[3];
    a[3] = q;
  }
}

function aabbIntersects(a, b) {
  normaliseAabb(a);
  normaliseAabb(b);

  const aw = a[2] - a[0];
  const ah = a[3] - a[1];
  const acx = (a[0] + a[2]) * 0.5;
  const acy = (a[1] + a[3]) * 0.5;

  const bw = b[2] - b[0];
  const bh = b[3] - b[1];
  const bcx = (b[0] + b[2]) * 0.5;
  const bcy = (b[1] + b[3]) * 0.5;

  const distX = Math.abs(acx - bcx);
  const distY = Math.abs(acy - bcy);
  const width = 0.5 * (aw + bw);
  const height = 0.5 * (ah + bh);

  return (distX < width) && (distY < height);
}

function createCanvas({width, height}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  return {canvas, context};
}

export class SectionSource {
  constructor() {
    this.entries = {};
  }

  number(v) {
    const digits = '000' + v.toFixed();
    return digits.substring(digits.length - 3);
  }

  key(level, x, y) {
    return `section_${this.number(level)}_${this.number(x)}_${this.number(y)}`;
  }

  createEntry(level, x, y) {
    const key = this.key(level, x, y);
    const entry = this.entries[key];
    if (entry === undefined) {
      // New section, start downloading it.
      const path = `sections/${key}.json`;
      const entry = {
        key,
        version: 0,
        promise: null,
        value: null,
      };
      this.entries[key] = entry;

      entry.promise = fetch(path)
        .then(res => res.json())
        .then(res => {
          res.version = entry.version++;
          entry.value = res;
          entry.promise = null;
          return res;
        }, err => {
          console.log('failed to fetch section', err);
          entry.promise = null;
        });
      return entry;
    }

    return entry;
  }

  getSection(level, x, y) {
    const entry = this.createEntry(level, x, y);
    return entry.value;
  }
}

export class MapService {
  constructor() {
    this.sectionSource = new SectionSource();
    this.tileCache = new Cache();
    this.tileSize = 512;
    this.quota = 0;
  }

  renderShapes(level, x, y) {
    const key = `shapes_${level}_${x}_${y}`;
    let index = this.tileCache.use(key);
    if (index !== null) {
      return index;
    }

    if (this.quota <= 0) {
      return null;
    }

    const dataLevel = Math.min(MAX_SECTION_LEVEL, level);
    let dataX = x;
    let dataY = y;
    if (dataLevel !== level) {
      dataX = x >> (level - dataLevel);
      dataY = y >> (level - dataLevel);
    }

    const section = this.sectionSource.getSection(dataLevel, dataX, dataY);
    if (section === null) {
      return null;
    }

    this.quota--;
    return this.tileCache.allocate(key, () => {
      const {canvas, context: ctx} = createCanvas({
        width: this.tileSize,
        height: this.tileSize,
      });
      const divisions = 1 << level;
      const scale = 1 / divisions;
      const minX = x * scale;
      const minY = y * scale;
      const maxX = minX + scale;
      const maxY = minY + scale;
      const sectionAabb = [minX, minY, maxX, maxY];
      ctx.setTransform(this.tileSize, 0, 0, this.tileSize, 0, 0);

      if (DEBUG_SECTIONS) {
        ctx.beginPath();
        ctx.rect(0, 0, 1, 1);
        ctx.fillStyle = rgbToStr.apply(null, hsv2rgb(Math.random() * 360, 1, 0.05));
        ctx.fill();
      }

      for (const shape of section.shapes) {
        const strokeStyle = parseStyle(shape.strokeColour);
        const fillStyle = parseStyle(shape.fillColour);

        if (!aabbIntersects(sectionAabb, shape.mapAabb)) {
          continue;
        }

        if (!strokeStyle && !fillStyle) {
          console.log('no style', shape.fillColour, shape.strokeColour);
          continue;
        }

        let first = true;
        ctx.beginPath();
        for (const [px, py] of shape.mapPoints) {
          const tx = (px - minX) * divisions;
          const ty = (py - minY) * divisions;

          if (first) {
            ctx.moveTo(tx, ty);
            first = false;
          } else {
            ctx.lineTo(tx, ty);
          }
        }

        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = shape.strokeWidth / this.tileSize;
          ctx.stroke();
        }

        if (fillStyle) {
          ctx.closePath();
          ctx.fillStyle = fillStyle;
          ctx.fill();
        }
      }

      ctx.restore();
      return canvas;
    }, canvas => {
      canvas.width = 0;
      canvas.height = 0;
    });
  }

  drawShapes(ctx, level, x, y, dx, dy, dw, dh) {
    let entry = this.renderShapes(level, x, y);
    let drawLevel = level;

    while ((entry === null) && (drawLevel > 0)) {
      // It's not ready yet, check lower levels.
      drawLevel--;

      const dx = x >> (level - drawLevel);
      const dy = y >> (level - drawLevel);

      const key = `shapes_${drawLevel}_${dx}_${dy}`;
      entry = this.tileCache.use(key);
    }

    if (entry === null) {
      return;
    }

    const tileSize = this.tileSize;
    let sx = 0, sy = 0, sw = tileSize, sh = tileSize;

    if (drawLevel < level) {
      const deltaLevel = level - drawLevel;
      const deltaBit = 1 << deltaLevel;
      const deltaBits = deltaBit - 1;
      sx = (x & deltaBits) * (tileSize / deltaBit);
      sy = (y & deltaBits) * (tileSize / deltaBit);
      sw >>= deltaLevel;
      sh >>= deltaLevel;
    }

    ctx.drawImage(entry.value, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  tileRange(x, y, w, h, level) {
    const divisions = 1 << level;
    const scale = 1 / divisions;
    const minX = Math.floor(x * divisions);
    const maxX = Math.ceil((x + w) * divisions);
    const minY = Math.floor(y * divisions);
    const maxY = Math.ceil((y + h) * divisions);
    return [minX, minY, maxX, maxY, divisions, scale];
  }

  preload(x, y, w, h, level) {
    const [minX, minY, maxX, maxY] = this.tileRange(x, y, w, h, level);

    for (let x = minX; x < maxX; ++x) {
      for (let y = minY; y < maxY; ++y) {
        this.renderShapes(level, x, y);
      }
    }
  }

  draw(ctx, x, y, w, h, level) {
    if (level > 1) {
      this.preload(x, y, w, h, level - 2);
    }

    if (level > 0) {
      this.preload(x, y, w, h, level - 1);
    }

    const [minX, minY, maxX, maxY, , scale] = this.tileRange(x, y, w, h, level);
    for (let x = minX; x < maxX; ++x) {
      for (let y = minY; y < maxY; ++y) {
        this.drawShapes(ctx, level, x, y, x * scale, y * scale, scale, scale);
      }
    }
  }
}

MapService
  .Context = createContext(new MapService());

export function

useMap() {
  return useContext(MapService.Context);
}
