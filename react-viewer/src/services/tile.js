import {createCanvas, freeCanvas, Renderer, Transform} from "./rendering";
import {hsv2rgb, rgb2str} from "./colour";

const DEBUG_TILES = false;

export class TileRenderer {
  constructor(prefix, cache, size) {
    this.prefix = prefix;
    this.cache = cache;
    this.size = size;

    // TODO: implement retries and things properly.
    this.brokenTiles = new Set();
  }

  _key(style, level, x, y, key) {
    return `${this.prefix}:${key || style.keys[0]}:${this.size}:${level}:${x}:${y}`;
  }

  _tileData(level, x, y) {
    return null;
  }

  _renderTile(renderer, style, level, x, y) {
  }

  renderTile(style, level, x, y) {
    const key = this._key(style, level, x, y);
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
          ctx.fillStyle = rgb2str.apply(null, hsv2rgb(Math.random() * 360, 1, 1, 0.07));
          ctx.fillRect(0, 0, this.size, this.size);
        }

        const scale = 1 << level;
        const invScale = 1 / scale;
        const worldX = x * invScale;
        const worldY = y * invScale;

        const renderer = new Renderer(canvas);
        renderer.viewTransform.transform = Transform.from({
          x: worldX,
          y: worldY,
          scale: this.size * scale,
          rotation: 0,
        });
        renderer.viewTransform.viewRect = [0, 0, this.size, this.size];
        renderer.render(() => this._renderTile(renderer, style, level, x, y, data));
        return {canvas};
      },
      free: freeCanvas,
    });
  }

  drawTile(renderer, style, level, x, y, dx, dy, dw, dh) {
    let entry = this.renderTile(style, level, x, y);
    let drawLevel = level;

    // Check old style versions
    for (let versionIdx = 1; (entry === null) && (versionIdx < style.keys.length); ++versionIdx) {
      const key = this._key(style, level, x, y, style.keys[versionIdx]);
      entry = this.cache.use(key);
    }

    // Check lower levels
    while ((entry === null) && (drawLevel > 0)) {
      drawLevel--;

      const drawTileX = x >> (level - drawLevel);
      const drawTileY = y >> (level - drawLevel);
      const key = this._key(style, drawLevel, drawTileX, drawTileY);
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
    const [worldMinX, worldMinY, worldMaxX, worldMaxY] = renderer.viewTransform.worldBounds;
    const divisions = 1 << level;
    const scale = 1 / divisions;
    const minX = Math.max(0, Math.floor(worldMinX * divisions - 0.01));
    const maxX = Math.min(divisions, Math.ceil(worldMaxX * divisions + 0.01));
    const minY = Math.max(0, Math.floor(worldMinY * divisions - 0.01));
    const maxY = Math.min(divisions, Math.ceil(worldMaxY * divisions + 0.01));
    return [minX, minY, maxX, maxY, divisions, scale];
  }

  preload(renderer, style, level) {
    const [minX, minY, maxX, maxY] = this.tileRange(renderer, level);

    for (let x = minX; x < maxX; ++x) {
      for (let y = minY; y < maxY; ++y) {
        this.renderTile(style, level, x, y);
      }
    }
  }

  draw(renderer, style) {
    const level = renderer.levelForSize(this.size);

    if (level > 1) {
      this.preload(renderer, style, level - 2);
    }

    if (level > 0) {
      this.preload(renderer, style, level - 1);
    }

    const viewTileSize = renderer.transform.scale / (1 << level);
    const [minX, minY, maxX, maxY] = this.tileRange(renderer, level);
    const [offX, offY] = renderer.transform.project(0, 0);

    // Render tiles.
    const {context, transform} = renderer
    const {cos, sin, rotation} = transform;

    if (!rotation) {
      for (let tx = minX; tx < maxX; ++tx) {
        for (let ty = minY; ty < maxY; ++ty) {
          const dx = offX + tx * viewTileSize;
          const dy = offY + ty * viewTileSize;
          this.drawTile(renderer, style, level, tx, ty, dx, dy, viewTileSize, viewTileSize);
        }
      }
    } else {
      context.save();
      context.transform(cos, sin, -sin, cos, offX, offY);
      for (let tx = minX; tx < maxX; ++tx) {
        for (let ty = minY; ty < maxY; ++ty) {
          const dx = tx * viewTileSize;
          const dy = ty * viewTileSize;
          const dw = (tx + 1) * viewTileSize - dx + 0.5;
          const dh = (ty + 1) * viewTileSize - dy + 0.5;
          this.drawTile(renderer, style, level, tx, ty, dx, dy, dw, dh);
        }
      }
      context.restore();
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
