import {createContext, useContext} from "react";

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
const DEBUG_SECTIONS = false;

const PALETTE = {
  COAST: '#444',
  PIER: 'black',
  DANGER: '#4027bd',
  RESTRICT: '#4027bd',
  PROHIBIT: '#4027bd',
  TAXI_CENTER: 'white',
  RUNWAY: '#7b6245',
  STOPBAR: 'white',
  STOPLINE: 'white',
  BUILDING: 'black',
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
    const s = '000000' + style.toFixed();
    return `#${s.substring(s.length - 6)}`;
  }

  const palette = PALETTE[style];
  if (palette !== undefined) {
    return palette;
  }

  return null;
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

export class TileCache {
  constructor(size, count) {
    this.size = size;
    this.rows = Math.ceil(Math.log2(count));
    this.canvas = document.createElement('canvas');
    this.canvas.width = size * this.rows;
    this.canvas.height = size * this.rows;
    this.context = this.canvas.getContext("2d");
    this.sequence = 0;
    this.entries = {};
    this.free = [];

    for (let i = 0; i < this.rows * this.rows; ++i) {
      this.free.push(i);
    }
  }

  use(key) {
    if (!Object.prototype.hasOwnProperty.call(this.entries, key)) {
      return null;
    }

    const existing = this.entries[key];
    existing.accessed = this.sequence++;
    return existing.index;
  }

  allocateIndex(key) {
    if (Object.prototype.hasOwnProperty.call(this.entries, key)) {
      return this.entries[key].index;
    }

    if (this.free.length > 0) {
      const index = this.free.shift();
      this.entries[key] = {
        index,
        accessed: this.sequence++,
      };
      return index;
    }

    let bestKey = null;
    let bestValue = null;

    for (const key of Object.keys(this.entries)) {
      const existing = this.entries[key];
      if ((bestKey !== null) && (existing.accessed >= bestValue)) {
        continue;
      }

      bestKey = key;
      bestValue = existing.accessed;
    }

    if (bestKey === null) {
      return null;
    }

    const index = this.entries[bestKey].index;
    delete this.entries[bestKey];
    this.entries[key] = {
      index,
      accessed: this.sequence++,
      allocated: new Date(),
    };
    return index;
  }

  allocate(key) {
    const index = this.allocateIndex(key);
    if (index === null) {
      return null;
    }

    const x = (index % this.rows) * this.size;
    const y = Math.floor(index / this.rows) * this.size;
    this.context.save();
    this.context.setTransform(this.size, 0, 0, this.size, x, y);
    this.context.beginPath();
    this.context.rect(0, 0, 1, 1);
    this.context.clip();
    this.context.clearRect(0, 0, 1, 1);
    return index;
  }

  allocatedAt(key) {
    const entry = this.entries[key];
    return (entry === undefined) ? null : entry.allocated;
  }

  draw(ctx, sx, sy, sw, sh, dx, dy, dw, dh, idx) {
    const ox = (idx % this.rows) * this.size;
    const oy = Math.floor(idx / this.rows) * this.size;
    ctx.drawImage(this.canvas, ox + sx, oy + sy, sw, sh, dx, dy, dw, dh);
  }
}

export class MapService {
  constructor() {
    this.sectionSource = new SectionSource();
    this.tileCache = new TileCache(1024, 64);
  }

  get tileSize() {
    return this.tileCache.size;
  }

  renderTile(level, x, y) {
    const key = `${level},${x},${y}`;
    let index = this.tileCache.use(key);
    if (index !== null) {
      return index;
    }

    const dataLevel = Math.min(7, level);
    let dataX = x;
    let dataY = y;
    if (dataLevel !== level) {
      dataX = x >> (level - dataLevel);
      dataY = y >> (level - dataLevel);
    }

    const section = this.sectionSource.getSection(Math.min(7, level), dataX, dataY);
    if (section === null) {
      return null;
    }

    index = this.tileCache.allocate(key);
    if (index === null) {
      return null;
    }

    const ctx = this.tileCache.context;
    const divisions = 1 << level;
    const scale = 1 / divisions;
    const offsetX = x * scale;
    const offsetY = y * scale;
    ctx.transform(divisions, 0, 0, divisions, -x, -y);

    if (DEBUG_SECTIONS) {
      ctx.beginPath();
      ctx.rect(offsetX, offsetY, scale, scale);
      ctx.fillStyle = rgbToStr.apply(null, hsv2rgb(Math.random() * 360, 1, 0.05));
      ctx.fill();
    }

    for (const shape of section.shapes) {
      const strokeStyle = parseStyle(shape.strokeColour);
      const fillStyle = parseStyle(shape.fillColour);

      if (!strokeStyle && !fillStyle) {
        console.log('no style', shape.fillColour, shape.strokeColour);
        continue;
      }

      let first = true;
      ctx.beginPath();
      for (const [px, py] of shape.mapPoints) {
        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else {
          ctx.lineTo(px, py);
        }
      }

      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 0.5 * shape.strokeWidth / ((1 << Math.min(13, level)) * this.tileSize);
        ctx.stroke();
      }
    }

    ctx.restore();
    return index;
  }

  drawTile(ctx, level, x, y, dx, dy, dw, dh) {
    let index = this.renderTile(level, x, y);
    let drawLevel = level;

    while ((index === null) && (drawLevel > 0)) {
      // It's not ready yet, check lower levels.
      drawLevel--;

      const dx = x >> (level - drawLevel);
      const dy = y >> (level - drawLevel);

      const key = `${drawLevel},${dx},${dy}`;
      index = this.tileCache.use(key);
    }

    if (index === null) {
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

    this.tileCache.draw(ctx, sx, sy, sw, sh, dx, dy, dw, dh, index);
  }

  draw(ctx, x, y, w, h, level) {
    const divisions = 1 << level;
    const scale = 1 / divisions;
    const minX = Math.floor(x * divisions);
    const maxX = Math.ceil((x + w) * divisions);
    const minY = Math.floor(y * divisions);
    const maxY = Math.ceil((y + h) * divisions);

    for (let x = minX; x < maxX; ++x) {
      for (let y = minY; y < maxY; ++y) {
        this.drawTile(ctx, level, x, y, x * scale, y * scale, scale, scale);
      }
    }
  }
}

MapService.Context = createContext(new MapService());

export function useMap() {
  return useContext(MapService.Context);
}
