export function hsv2rgb(h, s, v, a = 1) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      return [v, t, p, a];
    case 1:
      return [q, v, p, a];
    case 2:
      return [p, v, t, a];
    case 3:
      return [p, q, v, a];
    case 4:
      return [t, p, v, a];
    default:
      return [v, p, q, a];
  }
}

export function rgb2hsv(r, g, b, a = 1) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b);

  const d = max - min;
  const v = max;
  const s = max && (d / max);

  let h = 0;
  if (max !== min) {
    switch (max) {
      default:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return [h, s, v, a];
}

export function rgb2str(r, g, b, a = 1) {
  const rs = Math.floor(r * 255).toFixed();
  const gs = Math.floor(g * 255).toFixed();
  const bs = Math.floor(b * 255).toFixed();
  return `rgba(${rs},${gs},${bs},${a})`;
}

function hex2(v) {
  const i = Math.trunc(Math.min(255, Math.max(v)));
  const s = '00' + i.toString(16);
  return s.substr(s.length - 2);
}

export function rgb2hex(r, g, b) {
  return `#${hex2(r * 255)}${hex2(g * 255)}${hex2(b * 255)}`;
}

export function number2rgb(value) {
  const s = '000000' + value.toString(16);
  return `#${s.substring(s.length - 6)}`;
}
