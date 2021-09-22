import {createCanvas, freeCanvas} from "./rendering";
import {hsv2rgb, rgbToStr} from "./palette";

const DEBUG_TILES = false;

export class TileRenderer {
  constructor(prefix, cache, size) {
    this.prefix = prefix;
    this.cache = cache;
    this.size = size;

    // TODO: implement retries and things properly.
    this.brokenTiles = new Set();
  }

  _key(level, x, y) {
    return `${this.prefix}:${this.size}:${level}:${x}:${y}`;
  }

  _tileData(level, x, y) {
    return null;
  }

  _renderTile(canvas, ctx, level, x, y) {
  }

  renderTile(level, x, y) {
    const key = this._key(level, x, y);
    const existing = this.cache.use(key);
    if (existing !== null) {
      return existing;
    }

    if (this.brokenTiles.has(key)) {
      return null;
    }

    let data = null;
    try {
      data = this._tileData(level, x, y);
    } catch (err) {
      console.error('failed to fetch tile data', this.prefix, level, x, y, err);
      this.brokenTiles.add(key);
    }
    if (data == null) {
      return null;
    }

    return this.cache.pull({
      key,
      allocate: () => {
        const {canvas, context: ctx} = createCanvas();
        canvas.width = this.size;
        canvas.height = this.size;

        if (DEBUG_TILES) {
          ctx.fillStyle = rgbToStr.apply(null, hsv2rgb(Math.random() * 360, 1, 1, 0.1));
          ctx.fillRect(0, 0, this.size, this.size);
        }

        this._renderTile(canvas, ctx, level, x, y, data);
        return {canvas};
      },
      free: freeCanvas,
    });
  }

  drawTile(renderer, level, x, y, dx, dy, dw, dh) {
    let entry = this.renderTile(level, x, y);
    let drawLevel = level;

    while ((entry === null) && (drawLevel > 0)) {
      // It's not ready yet, check lower levels.
      drawLevel--;

      const drawTileX = x >> (level - drawLevel);
      const drawTileY = y >> (level - drawLevel);
      const key = this._key(drawLevel, drawTileX, drawTileY);
      entry = this.cache.use(key);
    }

    if (entry === null) {
      return;
    }

    const {size} = this;
    let sx = 0, sy = 0, sw = size, sh = size;

    if (drawLevel < level) {
      const deltaLevel = level - drawLevel;
      const deltaBit = 1 << deltaLevel;
      const deltaBits = deltaBit - 1;
      sx = (x & deltaBits) * (size / deltaBit);
      sy = (y & deltaBits) * (size / deltaBit);
      sw >>= deltaLevel;
      sh >>= deltaLevel;
    }

    renderer.context.drawImage(entry.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  tileRange(renderer, level) {
    const {worldMinX, worldMinY, worldMaxX, worldMaxY} = renderer;
    const divisions = 1 << level;
    const scale = 1 / divisions;
    const minX = Math.max(0, Math.ceil(worldMinX * divisions) - 1);
    const maxX = Math.min(divisions, Math.ceil(worldMaxX * divisions));
    const minY = Math.max(0, Math.ceil(worldMinY * divisions) - 1);
    const maxY = Math.min(divisions, Math.ceil(worldMaxY * divisions));
    return [minX, minY, maxX, maxY, divisions, scale];
  }

  preload(renderer, level) {
    const [minX, minY, maxX, maxY] = this.tileRange(renderer, level);

    for (let x = minX; x < maxX; ++x) {
      for (let y = minY; y < maxY; ++y) {
        this.renderTile(level, x, y);
      }
    }
  }

  draw(renderer) {
    const level = renderer.levelForSize(this.size);

    if (level > 1) {
      this.preload(renderer, level - 2);
    }

    if (level > 0) {
      this.preload(renderer, level - 1);
    }

    const viewTileSize = renderer.viewScale / (1 << level);
    const [minX, minY, maxX, maxY] = this.tileRange(renderer, level);
    const [offX, offY] = renderer.worldToView(0, 0);

    // Render base geometry.
    for (let tx = minX; tx < maxX; ++tx) {
      for (let ty = minY; ty < maxY; ++ty) {
        this.drawTile(renderer, level, tx, ty, offX + tx * viewTileSize, offY + ty * viewTileSize, viewTileSize, viewTileSize);
      }
    }
  }
}

export class SectionRenderer extends TileRenderer {
  constructor(prefix, cache, sections, size) {
    super(prefix, cache, size);
    this.sections = sections;
  }

  _tileData(level, x, y) {
    return this.sections.get(level, x, y);
  }
}
