import {SectionRenderer} from "./tile";
import {normaliseRect, rectContains, rectIntersects} from "./coords";
import {DEFAULT_PALETTE, styleFill, styleStroke} from "./style";

const TEXT_SCALE = 0.6;
const FONT_FAMILY = 'Roboto';

export class GroundRenderer extends SectionRenderer {
  constructor(cache, sections, size) {
    super('ground-tile', cache, sections, size);
  }

  _renderTile(renderer, style, level, x, y, section) {
    const {context, transform} = renderer;
    const {worldBounds} = renderer.viewTransform;

    // Render ground shapes
    for (const shape of section.shapes) {
      if (!rectIntersects(worldBounds, shape.mapBounds)) {
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

      styleStroke(context, style, shape.strokeColour, () => {
        context.lineWidth = shape.strokeWidth;
        context.stroke();
      });

      styleFill(context, style, shape.fillColour, () => {
        context.closePath();
        context.fill();
      });
    }

    if (style.showLayer("RUNWAYS")) {
      context.save();
      for (const runway of section.runways) {
        const [a, b] = runway.mapPoints;
        const bounds = normaliseRect([a[0], a[1], b[0], b[1]]);
        if (!rectIntersects(worldBounds, bounds)) {
          continue;
        }

        styleStroke(context, style, 'RUNWAYCENTER', () => {
          context.setLineDash([10, 10]);

          const pa = transform.project(...a);
          const pb = transform.project(...b);

          context.beginPath();
          context.moveTo(...pa);
          context.lineTo(...pb);
          context.stroke();
        });
      }
      context.restore();
    }
  }
}

export class LabelsRenderer extends SectionRenderer {
  constructor(cache, sections, size) {
    super('labels', cache, sections, size);
  }

  _renderTile(renderer, style, level, x, y, section) {
    const {context, transform} = renderer;
    const {viewBounds} = renderer.viewTransform;
    const safeViewBounds = [
      viewBounds[0] - 100,
      viewBounds[1] - 100,
      viewBounds[2] + 100,
      viewBounds[3] + 100,
    ];

    if (style.showLayer("LABELS")) {
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
        context.fillStyle = DEFAULT_PALETTE.AIRPORTLABEL;
        context.shadowColor = 'rgba(255, 255, 255, 0.3)';
        context.shadowBlur = 0.2
        context.fillText(label.text, px, py);
      }
      context.restore();
    }

    context.save();
    for (const point of section.points) {
      if (!style.showLayer(point.type.toUpperCase())) {
        continue;
      }

      const fontSize = 6 * TEXT_SCALE * (1.1 ** level);
      if (fontSize < 8) {
        continue;
      }

      const [px, py] = transform.project(...point.mapPosition);
      if (!rectContains(safeViewBounds, [px, py])) {
        continue;
      }

      context.font = `${fontSize}pt ${FONT_FAMILY}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = DEFAULT_PALETTE.FIXLABEL;
      context.shadowColor = 'rgba(255, 255, 255, 0.3)';
      context.shadowBlur = 0.2;
      context.fillText(point.name, px, py);
    }
    context.restore();

    if (level > 7 && style.showLayer("RUNWAYS")) {
      context.save();
      for (const runway of section.runways) {
        const [a, b] = runway.mapPoints;

        const pa = transform.project(...a);
        const pb = transform.project(...b);
        if (!rectContains(safeViewBounds, pa) && !rectContains(safeViewBounds, pb)) {
          continue;
        }

        const fontSize = 6 * TEXT_SCALE * (1.1 ** level);
        context.font = `${fontSize}pt ${FONT_FAMILY}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = DEFAULT_PALETTE.RUNWAYCENTER;
        context.fillText(runway.primaryId, ...pa);
        context.fillText(runway.oppositeId, ...pb);
      }
      context.restore();
    }
  }
}
