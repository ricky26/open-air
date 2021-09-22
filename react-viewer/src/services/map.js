import {boxToAABB} from "./coords";

export class MapRenderer {
  constructor() {
    this.canvas = null;
    this.context = null;
    this.rotation = 0;
    this.zoom = 0;
    this.scale = 1;
    this.invScale = 1;
    this.baseSize = 10;
    this.aspect = 1;
    this.dpiScale = 1;
    this.palette = {};
    this.cosRotation = 0;
    this.sinRotation = 0;

    this.viewScale = 1;
    this.viewInvScale = 1;
    this.viewWidth = 0;
    this.viewHeight = 0;
    this.viewMinX = 0;
    this.viewMinY = 0;
    this.viewMaxX = 0;
    this.viewMaxY = 0;

    this.worldX = 0;
    this.worldY = 0;
    this.worldWidth = 0;
    this.worldHeight = 0;
    this.worldMinX = 0;
    this.worldMinY = 0;
    this.worldMaxX = 0;
    this.worldMaxY = 0;
  }

  transform() {
    const {worldX, worldY, zoom, rotation} = this;
    return {worldX, worldY, zoom, rotation};
  }

  worldToView(x, y) {
    const {viewScale, cosRotation: cos, sinRotation: sin, worldX, worldY} = this;
    const flatX = (x - worldX) * viewScale;
    const flatY = (y - worldY) * viewScale;

    const viewX = cos * flatX - sin * flatY;
    const viewY = sin * flatX + cos * flatY;

    return [viewX, viewY];
  }

  viewToWorld(x, y) {
    const {viewInvScale, cosRotation: cos, sinRotation: sin, worldX, worldY} = this;
    const flatX = cos * x + sin * y;
    const flatY = cos * y - sin * y;

    const tx = worldX + flatX * viewInvScale;
    const ty = worldY + flatY * viewInvScale;

    return [tx, ty];
  }

  levelForSize(size) {
    return Math.max(0, Math.floor(Math.log2(this.viewScale * 1.2 / size)));
  }

  updateTransform() {
    const {width: bufferW, height: bufferH} = this.canvas;
    this.baseSize = Math.min(bufferW, bufferH);
    const cosR = Math.cos(this.rotation);
    const sinR = Math.sin(this.rotation);

    this.scale = (2 ** this.zoom);
    this.invScale = 1 / this.scale;
    this.cosRotation = cosR;
    this.sinRotation = sinR;

    this.viewScale = this.scale * this.baseSize;
    this.viewInvScale = 1 / (this.scale * this.baseSize);

    [
      this.viewWidth,
      this.viewHeight,
      this.viewMinX,
      this.viewMinY,
      this.viewMaxX,
      this.viewMaxY,
    ] = boxToAABB(0, 0, bufferW, bufferH, sinR, cosR);

    this.viewMinX = Math.floor(this.viewMinX);
    this.viewMinY = Math.floor(this.viewMinY);
    this.viewMaxX = Math.floor(this.viewMaxX);
    this.viewMaxY = Math.floor(this.viewMaxY);

    this.worldWidth = this.viewWidth * this.viewInvScale;
    this.worldHeight = this.viewHeight * this.viewInvScale;
    this.worldMinX = this.worldX + (this.viewMinX * this.viewInvScale);
    this.worldMinY = this.worldY + (this.viewMinY * this.viewInvScale);
    this.worldMaxX = this.worldX + (this.viewMaxX * this.viewInvScale);
    this.worldMaxY = this.worldY + (this.viewMaxY * this.viewInvScale);
  }

  render(canvas, handler) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');

    this.updateTransform();

    const {width: bufferW, height: bufferH} = canvas;
    const {sinRotation: sinR, cosRotation: cosR} = this;

    this.context.save();
    this.context.setTransform(cosR, -sinR, sinR, cosR, bufferW / 2, bufferH / 2);
    this.context.clearRect(-bufferW * 0.5, -bufferH * 0.5, bufferW, bufferH);

    try {
      handler(this);
    } finally {
      this.context.restore();
    }
  }
}
