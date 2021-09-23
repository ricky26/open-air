export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function boxToAABB([vx0, vy0, vx1, vy1], sin, cos) {
  const x0 = cos * vx0 - sin * vy0;
  const y0 = sin * vx0 + cos * vy0;
  const x1 = cos * vx1 - sin * vy0;
  const y1 = sin * vx1 + cos * vy0;
  const x2 = cos * vx0 - sin * vy1;
  const y2 = sin * vx0 + cos * vy1;
  const x3 = cos * vx1 - sin * vy1;
  const y3 = sin * vx1 + cos * vy1;

  const minX = Math.min(x0, x1, x2, x3);
  const minY = Math.min(y0, y1, y2, y3);
  const maxX = Math.max(x0, x1, x2, x3);
  const maxY = Math.max(y0, y1, y2, y3);
  const width = maxX - minX;
  const height = maxY - minY;

  return [width, height, minX, minY, maxX, maxY];
}

export function normaliseRect(a) {
  if (a[2] < a[0]) {
    const q = a[0];
    a[0] = a[2];
    a[2] = q;
  }

  if (a[3] < a[1]) {
    const q = a[1];
    a[1] = a[3];
    a[3] = q;
  }
  return a;
}

export function rectIntersects(a, b) {
  normaliseRect(a);
  normaliseRect(b);

  const aw = a[2] - a[0];
  const ah = a[3] - a[1];
  const acx = (a[0] + a[2]) * 0.5;
  const acy = (a[1] + a[3]) * 0.5;

  const bw = b[2] - b[0];
  const bh = b[3] - b[1];
  const bcx = (b[0] + b[2]) * 0.5;
  const bcy = (b[1] + b[3]) * 0.5;

  const distX = Math.abs(acx - bcx);
  const distY = Math.abs(acy - bcy);
  const width = 0.5 * (aw + bw);
  const height = 0.5 * (ah + bh);

  return (distX < width) && (distY < height);
}

export function rectContains([x0, y0, x1, y1], [x, y]) {
  return (x0 <= x) && (x <= x1) && (y0 <= y) && (y <= y1);
}

export function geo2map(latitude, longitude) {
  const {PI} = Math;
  const x = (longitude + 180) / 360;
  const y = (PI - Math.log(Math.tan((PI / 4) + (latitude * DEG2RAD / 2))))
    / (2 * PI);
  return [x, y];
}

