import {useCallback, useEffect, useRef} from "react";
import {DEG2RAD, useMap} from "../services/map";
import "./Map.css";

function clientToWorldScale(canvas, transform) {
  return Math.min(canvas.clientWidth, canvas.clientHeight) * (2 ** transform.zoom);
}

function clientToWorld(canvas, transform, x, y) {
  const scale = clientToWorldScale(canvas, transform);
  const tx = transform.x + (x - canvas.clientWidth * 0.5) / scale;
  const ty = transform.y + (y - canvas.clientHeight * 0.5) / scale;
  return [tx, ty];
}

export default function Map(props) {
  const {
    zoom = 1,
    x = 0,
    y = 0,
    rotation = 0,
    onTransform = null,
  } = props;
  const transform = useRef({x, y, zoom, rotation});
  Object.assign(transform.current, {x, y, zoom, rotation});

  const canvas = useRef();
  const mapService = useMap();

  useEffect(() => {
    let running = true;

    function draw() {
      canvas.current.width = canvas.current.clientWidth;
      canvas.current.height = canvas.current.clientHeight;

      const ctx = canvas.current.getContext('2d');
      const {
        clientWidth: screenW,
        clientHeight: screenH,
        width: bufferW,
        height: bufferH,
      } = canvas.current;

      const {x, y, zoom, rotation} = transform.current;
      const bufferMin = Math.min(bufferW, bufferH);
      const zoomScale = 2 ** zoom;
      const scale = bufferMin * zoomScale;
      const cosR = Math.cos(rotation * DEG2RAD);
      const sinR = Math.sin(rotation * DEG2RAD);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, bufferW, bufferH);
      ctx.setTransform(scale, 0, 0, scale, screenW / 2, screenH / 2);
      ctx.transform(cosR, -sinR, sinR, cosR, -x, -y);

      const level = Math.max(0, Math.floor(Math.log2(scale * 1.2 / mapService.tileSize)));

      // TODO: this will need to handle all 4 corners come rotation.
      const [minX, minY] = clientToWorld(canvas.current, transform.current, 0, 0);
      const [maxX, maxY] = clientToWorld(canvas.current, transform.current, screenW, screenH);
      const worldW = maxX - minX;
      const worldH = maxY - minY;

      mapService.quota = 1;
      mapService.draw(ctx, minX, minY, worldW, worldH, level, scale);

      if (running) {
        requestAnimationFrame(draw);
      }
    }

    draw();
    return () => {
      running = false;
    };
  });

  // Input handling
  const mouseState = useRef({
    active: false,
  });

  const handleMouseDown = useCallback(event => {
    if (event.button !== 0) {
      // We only use left-click for navigation as it stands.
      return;
    }

    mouseState.current.active = true;
    mouseState.current.startMouseX = event.clientX;
    mouseState.current.startMouseY = event.clientY;
    mouseState.current.startX = transform.current.x;
    mouseState.current.startY = transform.current.y;
  }, [mouseState, transform]);

  const updateMouseDrag = useCallback(event => {
    const scale = Math.min(canvas.current.clientWidth, canvas.current.clientHeight)
      * (2 ** transform.current.zoom);
    const dmx = mouseState.current.startMouseX - event.clientX;
    const dmy = mouseState.current.startMouseY - event.clientY;

    const x = mouseState.current.startX + dmx / scale;
    const y = mouseState.current.startY + dmy / scale;

    if (onTransform) {
      onTransform({...transform.current, x, y});
    }
  }, [onTransform, mouseState, transform]);

  const handleMouseMove = useCallback(event => {
    if (!mouseState.current.active) {
      return;
    }

    updateMouseDrag(event);
  }, [mouseState, updateMouseDrag]);

  const handleMouseUp = useCallback(event => {
    if (event.button !== 0 || !mouseState.current.active) {
      // We only use left-click for navigation as it stands.
      return;
    }

    updateMouseDrag(event);
    mouseState.current.active = false;
  }, [mouseState, updateMouseDrag])

  const handleWheel = useCallback(event => {
    const zoomDelta = event.deltaY * 0.01;

    const newTransform = {
      ...transform.current,
      zoom: Math.max(0, transform.current.zoom - zoomDelta),
    };

    // Reposition so the cursor is over the same position it was before.
    const [x1, y1] = clientToWorld(canvas.current, transform.current, event.clientX, event.clientY);
    const [x2, y2] = clientToWorld(canvas.current, newTransform, event.clientX, event.clientY);
    const dx = x1 - x2;
    const dy = y1 - y2;
    newTransform.x += dx;
    newTransform.y += dy;

    if (onTransform) {
      onTransform(newTransform);
    }
  }, [onTransform, canvas, transform]);

  return (
    <canvas
      className={"Map"}
      ref={canvas}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    />
  );
}
