import {createContext, useContext} from "react";

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const SECTION_DEGREES = 10;

function hsv2rgb(h,s,v) {
  let f= (n,k=(n+h/60)%6) => v - v*s*Math.max( Math.min(k,4-k,1), 0);
  return [f(5),f(3),f(1)];
}

function rgbToStr(r, g, b) {
  const f = v => {
    const s = '00' + (v * 255).toFixed();
    return s.substring(s.length - 2);
  };
  return `#${f(r)}${f(g)}${f(b)}`;
}

export class SectionSource {
  constructor() {
    this.entries = {};
  }

  number(v) {
    let prefix = '+';
    if (v < 0) {
      prefix = '-';
      v = -v;
    }

    const digits = '000' + v.toFixed();
    return prefix + digits.substring(digits.length - 3);
  }

  key(x, y) {
    return `section_${this.number(x)}_${this.number(y)}`;
  }

  createEntry(x, y) {
    const key = this.key(x, y);
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

  getSection(x, y) {
    const entry = this.createEntry(x, y);
    return entry.value;
  }

  async fetchSection(x, y) {
    const entry = this.createEntry(x, y);
    return entry.promise ? entry.promise : entry.value;
  }
}

export class TileCache {
  constructor(size, count) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size * count;
    this.canvas.height = size;
    this.context = this.canvas.getContext("2d");
    this.sequence = 0;
    this.entries = {};
    this.free = [];
    for (let i = 0; i < count; ++i) {
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

    const x = index * this.size;
    this.context.setTransform(this.size, 0, 0, this.size, x, 0);
    this.context.beginPath();
    this.context.rect(0, 0, this.size, this.size);
    this.context.closePath();
    this.context.clip();
    this.context.clearRect(0, 0, 1, 1);
    return index;
  }

  allocatedAt(key) {
    const entry = this.entries[key];
    return (entry === undefined) ? null : entry.allocated;
  }

  draw(ctx, x, y, w, h, idx) {
    const ox = idx * this.size;
    ctx.drawImage(this.canvas, ox, 0, this.size, this.size, x, y, w, h);
  }
}

export class MapService {
  constructor() {
    this.sectionSource = new SectionSource();
    this.tileCache = new TileCache(512, 32);
  }

  renderTile(x, y) {
    const key = `${x},${y}`;
    let index = this.tileCache.use(key);
    if (index !== null) {
      return index;
    }

    const section = this.sectionSource.getSection(x, y);
    if (section === null) {
      return null;
    }

    index = this.tileCache.allocate(key);
    if (index === null) {
      return null;
    }

    const ctx = this.tileCache.context;
    const divisor = 1 / SECTION_DEGREES;
    const offsetX = x / SECTION_DEGREES;
    const offsetY = y / SECTION_DEGREES;
    ctx.transform(divisor, 0, 0, divisor, -offsetX, -offsetY);

    ctx.beginPath();
    ctx.rect(x, y, SECTION_DEGREES, SECTION_DEGREES);
    ctx.fillStyle = rgbToStr.apply(null, hsv2rgb(Math.random() * 360, 1, 0.5));
    ctx.fill();

    for (const shape of section.shapes) {
      let first = true;
      ctx.beginPath();
      for (const [px, py] of shape.points) {
        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.strokeStyle = 'white';
      ctx.lineWidth = 0.01;
      ctx.stroke();
    }

    return index;
  }

  draw(ctx, x, y, w, h, scaleX, scaleY) {
    const minX = Math.floor(x / SECTION_DEGREES) * SECTION_DEGREES;
    const maxX = Math.ceil((x + w) / SECTION_DEGREES) * SECTION_DEGREES;
    const minY = Math.floor(y / SECTION_DEGREES) * SECTION_DEGREES;
    const maxY = Math.ceil((y + h) / SECTION_DEGREES) * SECTION_DEGREES;

    for (let x = minX; x < maxX; x += SECTION_DEGREES) {
      for (let y = minY; y < maxY; y += SECTION_DEGREES) {
        let index = this.renderTile(x, y);
        if (index === null) {
          continue;
        }

        this.tileCache.draw(ctx, x, y, SECTION_DEGREES, SECTION_DEGREES, index);
      }
    }
  }
}

MapService.Context = createContext(new MapService());

export function useMap() {
  return useContext(MapService.Context);
}
