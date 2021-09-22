export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function boxToAABB(x, y, w, h, sinR, cosR) {
  const x0 = -cosR * w + sinR * h;
  const y0 = -sinR * w - cosR * h;
  const x1 = +cosR * w + sinR * h;
  const y1 = +sinR * w - cosR * h;
  const x2 = -cosR * w - sinR * h;
  const y2 = -sinR * w + cosR * h;
  const x3 = +cosR * w - sinR * h;
  const y3 = +sinR * w + cosR * h;

  const minX = Math.min(x0, x1, x2, x3) * 0.5;
  const minY = Math.min(y0, y1, y2, y3) * 0.5;
  const maxX = Math.max(x0, x1, x2, x3) * 0.5;
  const maxY = Math.max(y0, y1, y2, y3) * 0.5;
  const width = maxX - minX;
  const height = maxY - minY;

  return [width, height, minX, minY, maxX, maxY];
}

export function normaliseAabb(a) {
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
}

export function aabbIntersects(a, b) {
  normaliseAabb(a);
  normaliseAabb(b);

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
