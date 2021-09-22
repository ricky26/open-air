import {SectionRenderer} from "./tile";
import {aabbIntersects, normaliseAabb, rectContains} from "./coords";
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

    // Render ground shapes
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

    context.save();
    for (const runway of section.runways) {
      const [a, b] = runway.points;
      const aabb = normaliseAabb([a[0], a[1], b[0], b[1]]);
      if (!aabbIntersects(sectionAabb, aabb)) {
        continue;
      }

      context.strokeStyle = PALETTE.RUNWAYCENTER;
      context.setLineDash([10, 10]);

      const pa = transform.project(...a);
      const pb = transform.project(...b);

      context.beginPath();
      context.moveTo(...pa);
      context.lineTo(...pb);
      context.stroke();
    }
    context.restore();
  }
}

export class LabelsRenderer extends SectionRenderer {
  constructor(cache, sections, size) {
    super('labels', cache, sections, size);
  }

  _renderTile(renderer, level, x, y, section) {
    const {context, transform} = renderer;
    const {viewBounds} = renderer.viewTransform;
    const safeViewBounds = [
      viewBounds[0] - 100,
      viewBounds[1] - 100,
      viewBounds[2] + 100,
      viewBounds[3] + 100,
    ];

    context.save();
    for (const label of section.labels) {
      const fontSize = label.fontSize * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const [px, py] = transform.project(...label.mapPosition);
      if (!rectContains(safeViewBounds, [px, py])) {
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
    context.restore();

    context.save();
    for (const point of section.points) {
      const fontSize = 6 * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const [px, py] = transform.project(...point.position);
      if (!rectContains(safeViewBounds, [px, py])) {
        continue;
      }

      context.font = `${fontSize}pt ${FONT_FAMILY}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = PALETTE.FIXLABEL;
      context.shadowColor = 'rgba(255, 255, 255, 0.3)';
      context.shadowBlur = 0.2;
      context.fillText(point.name, px, py);
    }
    context.restore();

    if (level > 7) {
      context.save();
      for (const runway of section.runways) {
        const [a, b] = runway.points;

        const pa = transform.project(...a);
        const pb = transform.project(...b);
        if (!rectContains(safeViewBounds, pa) && !rectContains(safeViewBounds, pb)) {
          continue;
        }

        const fontSize = 6 * TEXT_SCALE * (1.1 ** level);
        context.font = `${fontSize}pt ${FONT_FAMILY}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = PALETTE.RUNWAYCENTER;
        context.fillText(runway.primaryId, ...pa);
        context.fillText(runway.oppositeId, ...pb);
      }
      context.restore();
    }
  }
}
