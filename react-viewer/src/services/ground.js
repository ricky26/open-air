import {SectionRenderer} from "./tile";
import {aabbIntersects, rectContains} from "./coords";
import {PALETTE, parseStyle} from "./style";

const TEXT_SCALE = 0.6;
const FONT_FAMILY = 'Roboto';

export class GroundRenderer extends SectionRenderer {
  constructor(cache, sections, size) {
    super('ground-tile', cache, sections, size);
  }

  _renderTile(renderer, level, x, y, section) {
    const {context, transform} = renderer;
    const sectionAabb = renderer.viewTransform.worldBounds;

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
      context.beginPath();
      for (const [px, py] of shape.mapPoints) {
        const [tx, ty] = transform.project(px, py);

        if (first) {
          context.moveTo(tx, ty);
          first = false;
        } else {
          context.lineTo(tx, ty);
        }
      }

      if (strokeStyle) {
        context.strokeStyle = strokeStyle;
        context.lineWidth = shape.strokeWidth;
        context.stroke();
      }

      if (fillStyle) {
        context.closePath();
        context.fillStyle = fillStyle;
        context.fill();
      }
    }
  }
}

export class LabelsRenderer extends SectionRenderer {
  constructor(cache, sections, size) {
    super('labels', cache, sections, size);
  }

  _renderTile(renderer, level, x, y, section) {
    const {context, transform} = renderer;
    const viewAabb = renderer.viewTransform.viewBounds;
    const safeViewAabb = [
      viewAabb[0] - 100,
      viewAabb[1] - 100,
      viewAabb[2] + 100,
      viewAabb[3] + 100,
    ];

    for (const label of section.labels) {
      const fontSize = label.fontSize * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const [px, py] = transform.project(...label.mapPosition);
      if (!rectContains(safeViewAabb, [px, py])) {
        continue;
      }

      context.font = `bold ${fontSize}pt ${FONT_FAMILY}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = PALETTE.AIRPORTLABEL;
      context.shadowColor = 'rgba(255, 255, 255, 0.3)';
      context.shadowBlur = 0.2
      context.fillText(label.text, px, py);
    }

    for (const point of section.points) {
      const fontSize = 6 * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const [px, py] = transform.project(...point.position);
      if (!rectContains(safeViewAabb, [px, py])) {
        continue;
      }

      context.font = `${fontSize}pt ${FONT_FAMILY}`;
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillStyle = PALETTE.FIXLABEL;
      context.shadowColor = 'rgba(255, 255, 255, 0.3)';
      context.shadowBlur = 0.2;
      context.fillText(point.name, px, py);
    }
  }
}
