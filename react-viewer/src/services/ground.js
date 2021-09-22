import {TileRenderer} from "./tile";
import {aabbIntersects} from "./coords";
import {parseStyle} from "./palette";

//const TEXT_SCALE = 0.5;
//const FONT_FAMILY = 'Roboto';

export class GroundRenderer extends TileRenderer {
  constructor(cache, sections, size) {
    super('ground-tile', cache, size);
    this.sections = sections;
  }

  _tileData(level, x, y) {
    return this.sections.get(level, x, y);
  }

  _renderTile(canvas, ctx, level, x, y, section) {
    const divisions = 1 << level;
    const scale = 1 / divisions;
    const minX = x * scale;
    const minY = y * scale;
    const maxX = minX + scale;
    const maxY = minY + scale;
    const sectionAabb = [minX, minY, maxX, maxY];
    ctx.setTransform(this.size, 0, 0, this.size, 0, 0);

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
        ctx.lineWidth = shape.strokeWidth / this.size;
        ctx.stroke();
      }

      if (fillStyle) {
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
    }
  }

  /*
  drawLabels(renderer, level, x, y, dx, dy, dw, dh) {
    const section = this.sections.get(level, x, y);
    if (section === null) {
      return;
    }

    const divisions = 1 << level;
    const scale = 1 / divisions;
    const worldMinX = x * scale;
    const worldMinY = y * scale;

    for (const label of section.labels) {
      const fontSize = label.fontSize * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const key = `label:${level}:${label.text}`;
      const entry = this.cache.allocate({
        key
        allocate: () => {
          const {canvas, context} = createCanvas();
          const font = `${fontSize}pt ${FONT_FAMILY}`;

          // Calculate text size.
          context.font = font;
          context.textAlign = 'left';
          context.textBaseline = 'top';
          const {width, actualBoundingBoxDescent: height} = context.measureText(label.text);
          canvas.width = width + 12;
          canvas.height = height + 12;

          // Render text
          context.font = font;
          context.textAlign = 'left';
          context.textBaseline = 'top';
          context.fillStyle = PALETTE.AIRPORTLABEL;
          context.shadowColor = 'rgba(255, 255, 255, 0.2)';
          context.shadowBlur = 3;
          context.fillText(label.text, 6, 6);

          return {canvas};
        },
        free: freeCanvas,
      });
      if (entry === null) {
        continue;
      }

      const x = dx + (label.mapPosition[0] - worldMinX) / scale * dw;
      const y = dy + (label.mapPosition[1] - worldMinY) / scale * dh;
      const {canvas} = entry.value;
      const w = canvas.width / pixelScale;
      const h = canvas.height / pixelScale;
      ctx.drawImage(canvas, x - w * 0.5, y - h * 0.5, w, h);
    }

    for (const point of section.points) {
      const fontSize = 6 * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const key = `point_${level}_${point.name}`;
      const entry = this.tileCache.allocate(key, () => {
        const {canvas, context} = createCanvas();
        const font = `${fontSize}pt ${FONT_FAMILY}`;

        // Calculate text size.
        context.font = font;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        const {width, actualBoundingBoxDescent: height} = context.measureText(point.name);
        canvas.width = width + 12;
        canvas.height = height + 12;

        // Render text
        context.font = font;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = PALETTE.FIXLABEL;
        context.shadowColor = 'rgba(0, 0, 0, 0.2)';
        context.shadowBlur = 4;
        context.fillText(point.name, 6, 6);

        return {canvas};
      }, freeCanvas);
      if (entry === null) {
        continue;
      }

      const x = dx + (point.position[0] - worldMinX) / scale * dw;
      const y = dy + (point.position[1] - worldMinY) / scale * dh;
      const {canvas} = entry.value;
      const w = canvas.width / pixelScale;
      const h = canvas.height / pixelScale;
      ctx.drawImage(canvas, x - w * 0.5, y - h * 0.5, w, h);

    }
  }

  draw(renderer) {
    const {worldX: x, worldY: y, worldWidth: w, worldHeight: h} = renderer;
    const level = renderer.levelForSize(this.size);
    const [minX, minY, maxX, maxY, , scale] = this.tileRange(x, y, w, h, level);

    super.draw(renderer);

    // Render labels
    for (let tx = minX; tx < maxX; ++tx) {
      for (let ty = minY; ty < maxY; ++ty) {
        this.drawLabels(ctx, level, pixelScale, tx, ty, tx * scale, ty * scale, scale, scale);
      }
    }
  }*/
}
