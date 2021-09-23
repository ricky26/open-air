import {boxToAABB} from "./coords";

export function createCanvas() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext("2d");
  return {canvas, context};
}

export function freeCanvas({canvas}) {
  canvas.width = 0;
  canvas.height = 0;
}

export class Transform {
  constructor({x = 0, y = 0, scale = 1, rotation = 0} = {}) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.invScale = 1 / scale;
    this.rotation = rotation;
    this.sin = Math.sin(rotation);
    this.cos = Math.cos(rotation);
  }

  clone() {
    const {x, y, scale, rotation} = this;
    return new Transform({x, y, scale, rotation});
  }

  static from(value) {
    if (value instanceof Transform) {
      return value;
    }

    return new Transform(value);
  }

  json() {
    const {x, y, scale, rotation} = this;
    return {x, y, scale, rotation};
  }

  project(x, y) {
    const {scale, cos, sin, x: x0, y: y0} = this;
    const flatX = (x - x0) * scale;
    const flatY = (y - y0) * scale;

    const viewX = cos * flatX - sin * flatY;
    const viewY = sin * flatX + cos * flatY;

    return [viewX, viewY];
  }

  unproject(x, y) {
    const {invScale, cos, sin, x: x0, y: y0} = this;
    const flatX = cos * x + sin * y;
    const flatY = cos * y - sin * y;

    const tx = x0 + flatX * invScale;
    const ty = y0 + flatY * invScale;

    return [tx, ty];
  }
}

export class ViewTransform {
  constructor() {
    this._transform = new Transform();
    this._viewBounds = Object.freeze([0, 0, 0, 0]);
    this._worldBounds = Object.freeze([0, 0, 0, 0]);
    this._viewRect = Object.freeze([0, 0, 0, 0]);
    this.viewMinor = 0;
    this.viewWidth = 0;
    this.viewHeight = 0;
    this.worldWidth = 0;
    this.worldHeight = 0;
  }

  get transform() {
    return this._transform;
  }

  set transform(value) {
    this._transform = value;
    this.updateBounds();
  }

  get viewBounds() {
    return this._viewBounds;
  }

  get worldBounds() {
    return this._worldBounds;
  }

  get viewRect() {
    return this._viewRect;
  }

  set viewRect(viewRect) {
    this._viewRect = Object.freeze(viewRect);
    this.updateBounds();
  }

  updateBounds() {
    const [viewX0, viewY0, viewX1, viewY1] = this.viewRect;
    this.viewMinor = Math.min(Math.abs(viewX0 - viewX1), Math.abs(viewY0 - viewY1));

    const {x, y, invScale, sin, cos} = this.transform;
    const [ viewWidth, viewHeight, ...bounds ] = boxToAABB(this.viewRect, sin, cos);
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    const viewMinX = Math.floor(bounds[0]);
    const viewMinY = Math.floor(bounds[1]);
    const viewMaxX = Math.floor(bounds[2]);
    const viewMaxY = Math.floor(bounds[3]);
    this._viewBounds = Object.freeze([viewMinX, viewMinY, viewMaxX, viewMaxY]);

    this.worldWidth = viewWidth * invScale;
    this.worldHeight = viewHeight * invScale;
    this._worldBounds = Object.freeze([
      x + (viewMinX * invScale),
      y + (viewMinY * invScale),
      x + (viewMaxX * invScale),
      y + (viewMaxY * invScale),
    ]);
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.viewTransform = new ViewTransform();
  }

  get transform() {
    return this.viewTransform.transform;
  }

  levelForSize(size) {
    const {scale} = this.viewTransform.transform;
    return Math.max(0, Math.floor(Math.log2(scale * 1.2 / size)));
  }

  render(handler) {
    const {context} = this;
    const [x0, y0] = this.viewTransform.viewRect;
    const {sin, cos} = this.transform;

    this.context.save();
    context.setTransform(cos, -sin, sin, cos, -x0, -y0);

    try {
      handler(this);
    } finally {
      this.context.restore();
    }
  }
}
