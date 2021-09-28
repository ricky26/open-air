import {useCallback, useEffect, useRef} from "react";
import Hammer from "hammerjs";
import {Renderer, Transform} from "../services/rendering";
import {DEG2RAD} from "../services/coords";
import "./Map.css";

function calculateTransform(transform, canvas) {
  const {width, height} = canvas.current;
  const {x, y, zoom, rotation} = transform.current;
  const baseSize = Math.min(width, height);
  const scale = (2 ** zoom) * baseSize;
  return Transform.from({
    x, y, scale, rotation: rotation * DEG2RAD,
  });
}

function translateEventXY(event, x, y) {
  const {left, top} = event.target.getBoundingClientRect();
  return [x - left, y - top];
}

function getMouseXY(event) {
  return translateEventXY(event, event.clientX, event.clientY);
}

export default function Map(props) {
  const {
    zoom = 1,
    x = 0,
    y = 0,
    rotation = 0,
    onTransform = null,
    className = '',
    containerClassName = '',
    render,
    children,
  } = props;
  const canvas = useRef();
  const transform = useRef();
  transform.current = {x, y, rotation, zoom};

  useEffect(() => {
    let running = true;

    const renderer = new Renderer(canvas.current);

    function draw() {
      if (canvas.current) {
        const dpiScale = window.devicePixelRatio || 1;
        const width = canvas.current.clientWidth * dpiScale;
        const height = canvas.current.clientHeight * dpiScale;
        canvas.current.width = width;
        canvas.current.height = height;

        renderer.viewTransform.viewRect = [-width / 2, -height / 2, width / 2, height / 2];
        renderer.viewTransform.transform = calculateTransform(transform, canvas);
        renderer.render(() => {
          renderer.context.clearRect(...renderer.viewTransform.viewBounds);
          render && render(renderer);
        });
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
  const dragState = useRef({
    active: false,
  });

  const startDrag = useCallback((clientX, clientY, rotation = 0, zoom = 0) => {
    dragState.current.active = true;
    dragState.current.startMouseX = clientX;
    dragState.current.startMouseY = clientY;
    dragState.current.startMouseRotation = rotation;
    dragState.current.startMouseZoom = zoom;
    dragState.current.startX = transform.current.x;
    dragState.current.startY = transform.current.y;
    dragState.current.startRotation = transform.current.rotation;
    dragState.current.startZoom = transform.current.zoom;
  }, [dragState, transform]);

  const updateDrag = useCallback((clientX, clientY, rotation = 0, zoom = 0) => {
    if (!dragState.current.active) {
      return;
    }

    const t = calculateTransform(transform, canvas);
    const {scale, sin, cos} = t;
    const dmx = (dragState.current.startMouseX - clientX) * devicePixelRatio;
    const dmy = (dragState.current.startMouseY - clientY) * devicePixelRatio;

    const dmmx = cos * dmx + sin * dmy;
    const dmmy = - sin * dmx + cos * dmy;

    const x = dragState.current.startX + dmmx / scale;
    const y = dragState.current.startY + dmmy / scale;
    rotation = rotation - dragState.current.startMouseRotation + dragState.current.startRotation;
    zoom = zoom - dragState.current.startMouseZoom + dragState.current.startZoom;

    if (onTransform) {
      onTransform({x, y, rotation, zoom});
    }
  }, [canvas, dragState, transform, onTransform]);

  const endDrag = useCallback((clientX, clientY, rotation, zoom) => {
    updateDrag(clientX, clientY, rotation, zoom);
    dragState.current.active = false;
  }, [dragState, updateDrag])

  const handleMouseDown = useCallback(event => {
    if (event.button !== 0) {
      // We only use left-click for navigation as it stands.
      return;
    }

    startDrag(event.clientX, event.clientY);
  }, [startDrag]);

  const handleMouseMove = useCallback(event => {
    updateDrag(event.clientX, event.clientY);
  }, [updateDrag]);

  const handleMouseUp = useCallback(event => {
    if (event.button !== 0 || !dragState.current.active) {
      // We only use left-click for navigation as it stands.
      return;
    }

    endDrag(event.clientX, event.clientY);
  }, [endDrag])

  const handleWheel = useCallback(event => {
    const zoomDelta = event.deltaY * 0.01;
    const zoom = Math.max(0, transform.current.zoom - zoomDelta);
    const [mouseX, mouseY] = getMouseXY(event);

    const newTransformValue = {
      ...transform.current,
      zoom,
    };

    const oldTransform = calculateTransform(transform, canvas);
    const newTransform = calculateTransform({current: newTransformValue}, canvas);

    // Reposition so the cursor is over the same position it was before.
    const dpiScale = window.devicePixelRatio || 1;
    const viewX = (mouseX - canvas.current.clientWidth * 0.5) * dpiScale;
    const viewY = (mouseY - canvas.current.clientHeight * 0.5) * dpiScale;

    const [x1, y1] = oldTransform.unprojectVector(viewX, viewY);
    const [x2, y2] = newTransform.unprojectVector(viewX, viewY);
    const dx = x1 - x2;
    const dy = y1 - y2;
    newTransformValue.x += dx;
    newTransformValue.y += dy;

    if (onTransform) {
      onTransform(newTransformValue);
    }
  }, [onTransform, transform, canvas]);

  useEffect(() => {
    const mc = new Hammer(canvas.current);
    mc.get("pinch").set({enable: true});
    mc.get("rotate").set({enable: true});

    mc.on("panstart pinchstart rotatestart", event => {
      startDrag(event.center.x, event.center.y, event.rotation, Math.log2(event.scale));
    });

    mc.on("panmove pinchmove rotatemove", event => {
      updateDrag(event.center.x, event.center.y, event.rotation, Math.log2(event.scale));
    });

    mc.on("panend pinchend rotateend", event => {
      endDrag(event.center.x, event.center.y, event.rotation, Math.log2(event.scale));
    });

    return () => mc.destroy();
  }, [canvas, startDrag, updateDrag, endDrag]);

  return (
    <div className={`Map ${className}`}>
      <canvas
        ref={canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
      <div className={containerClassName}>
        {children}
      </div>
    </div>
  );
}
