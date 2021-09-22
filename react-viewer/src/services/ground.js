import {SectionRenderer} from "./tile";
import {aabbIntersects} from "./coords";
import {PALETTE, parseStyle} from "./palette";

const TEXT_SCALE = 0.5;
const FONT_FAMILY = 'Roboto';

export class GroundRenderer extends SectionRenderer {
  constructor(cache, sections, size) {
    super('ground-tile', cache, sections, size);
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
}

export class LabelsRenderer extends SectionRenderer {
  constructor(cache, sections, size) {
    super('labels', cache, sections, size);
  }

  _renderTile(canvas, ctx, level, x, y, section) {
    //const divisions = 1 << level;
    //const scale = 1 / divisions;
    //const minX = x * scale;
    //const minY = y * scale;
    //const maxX = minX + scale;
    //const maxY = minY + scale;
    ctx.setTransform(this.size, 0, 0, this.size, 0, 0);

    ctx.moveTo(0, 0);
    ctx.lineTo(1, 1);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 0.001;
    ctx.stroke();

    for (const label of section.labels) {
      const fontSize = label.fontSize * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const font = `${fontSize}pt ${FONT_FAMILY}`;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PALETTE.AIRPORTLABEL;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 3;
      ctx.fillText(label.text, 6, 6);
    }

    for (const point of section.points) {
      const fontSize = 6 * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const font = `${fontSize}pt ${FONT_FAMILY}`;
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = PALETTE.FIXLABEL;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 4;
      ctx.fillText(point.name, 6, 6);
    }
  }
}
