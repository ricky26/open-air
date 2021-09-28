import {DEG2RAD, rectContains} from "./coords";
import {styleStroke} from "./style";

function rotatePoint(x, y, sin, cos) {
  return [x * cos - y * sin, x * sin + y * cos];
}

function addPoints([x0, y0], [x1, y1]) {
  return [x0 + x1, y0 + y1];
}

export class PilotRenderer {
  constructor(whazzup, airlines) {
    this.whazzup = whazzup;
    this.airlines = airlines;
  }

  draw(renderer, style) {
    const {context} = renderer;
    const {viewBounds, transform, viewMinor} = renderer.viewTransform;
    const {scale} = transform;
    const safeViewBounds = [
      viewBounds[0] - 100,
      viewBounds[1] - 100,
      viewBounds[2] + 100,
      viewBounds[3] + 100,
    ];
    const viewScale = transform.scale / viewMinor;

    context.save();
    for (const pilot of Object.values(this.whazzup.pilots)) {
      if (!pilot.lastTrack) {
        continue;
      }

      const {mapX, mapY, heading, groundSpeed = 0} = pilot.lastTrack;
      const pos = transform.project(mapX, mapY);
      if (!rectContains(safeViewBounds, pos)) {
        continue;
      }

      const lineHeight = 20 * devicePixelRatio;
      const fontSize = Math.trunc(lineHeight * 0.8);
      const angle = heading * DEG2RAD;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      context.fillStyle = 'white';
      context.font = `${fontSize}px Roboto`;
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.lineWidth = 2;

      // Projected speed line
      styleStroke(context, style, 'RUNWAYCENTER', () => {
        context.beginPath();
        context.moveTo(...pos);
        context.lineTo(...addPoints(pos, rotatePoint(0, -1e-7 * groundSpeed * scale, sin, cos)));
        context.stroke();
      });

      // Blip
      context.beginPath();
      context.ellipse(...pos, 3, 3, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(...addPoints(pos, rotatePoint(-3, 0, sin, cos)));
      context.lineTo(...addPoints(pos, rotatePoint(3, 0, sin, cos)));
      context.lineTo(...addPoints(pos, rotatePoint(0, -10, sin, cos)));
      context.closePath();
      context.fill();

      if (viewScale < 15) {
        continue;
      }

      const airline = this.airlines.byCallsign(pilot.callsign);

      let x = pos[0] + 5;
      let y = pos[1] + 5;

      if (airline) {
        context.fillText(airline.callsign, x, y);
        y += lineHeight;
      }

      context.fillText(pilot.callsign, x, y);
      y += lineHeight;

      const {altitude, altitudeDifference} = pilot.lastTrack;
      let altitudeText = 'A' + (altitude / 100).toFixed().padStart(3, '0');
      if (Math.abs(altitudeDifference) > 100) {
        const symbol = (altitudeDifference < 0) ? '▼' : '▲';
        const deltaNumber = Math.abs(altitudeDifference / 100).toFixed().padStart(3, '0');
        altitudeText += ` ${symbol}N${deltaNumber}`;
      }

      if (groundSpeed) {
        const groundSpeedText = 'M' + groundSpeed.toFixed().padStart(3, '0');
        context.fillText(groundSpeedText, x, y);
        y += lineHeight;
      }

      context.fillText(altitudeText, x, y);
      y += lineHeight;

      const {transponder, transponderMode} = pilot.lastTrack;
      context.fillText(`${transponderMode}${transponder}`, x, y);
      y += lineHeight;
    }
    context.restore();
  }
}
