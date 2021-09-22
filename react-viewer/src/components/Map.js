import {useCallback, useEffect, useMemo, useRef} from "react";
import {MapRenderer} from "../services/map";
import "./Map.css";

const noop = () => {
};

export default function Map(props) {
  const {
    zoom = 1,
    worldX = 0,
    worldY = 0,
    rotation = 0,
    onTransform = null,
    render,
  } = props;
  const canvas = useRef();
  const renderer = useMemo(() => new MapRenderer(), []);
  const dpiScale = window.devicePixelRatio || 1;

  renderer.worldX = worldX;
  renderer.worldY = worldY;
  renderer.rotation = rotation;
  renderer.zoom = zoom;
  renderer.dpiScale = dpiScale;

  useEffect(() => {
    let running = true;

    function draw() {
      if (canvas.current) {
        canvas.current.width = canvas.current.clientWidth * dpiScale;
        canvas.current.height = canvas.current.clientHeight * dpiScale;

        renderer.render(canvas.current, render || noop);
      }

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
    mouseState.current.startX = renderer.worldX;
    mouseState.current.startY = renderer.worldY;
  }, [mouseState, renderer]);

  const updateMouseDrag = useCallback(event => {
    const scale = Math.min(canvas.current.clientWidth, canvas.current.clientHeight)
      * (2 ** renderer.zoom);
    const dmx = mouseState.current.startMouseX - event.clientX;
    const dmy = mouseState.current.startMouseY - event.clientY;

    const worldX = mouseState.current.startX + dmx / scale;
    const worldY = mouseState.current.startY + dmy / scale;

    if (onTransform) {
      onTransform({...renderer.transform(), worldX, worldY});
    }
  }, [onTransform, mouseState, renderer]);

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
      ...renderer.transform(),
      zoom: Math.max(0, renderer.zoom - zoomDelta),
    };

    const newRenderer = Object.assign(new MapRenderer(), renderer, newTransform);
    newRenderer.updateTransform();

    // Reposition so the cursor is over the same position it was before.
    const viewX = event.clientX - renderer.canvas.clientWidth * 0.5;
    const viewY = event.clientY - renderer.canvas.clientHeight * 0.5;
    const [x1, y1] = renderer.viewToWorld(viewX, viewY);
    const [x2, y2] = newRenderer.viewToWorld(viewX, viewY);
    const dx = x1 - x2;
    const dy = y1 - y2;
    newTransform.worldX += dx;
    newTransform.worldY += dy;

    if (onTransform) {
      onTransform(newTransform);
    }
  }, [onTransform, renderer]);

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
