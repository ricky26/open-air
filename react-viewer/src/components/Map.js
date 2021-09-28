import {useCallback, useEffect, useRef} from "react";
import {Renderer, Transform} from "../services/rendering";
import "./Map.css";

function calculateTransform(transform, canvas) {
  const {width, height} = canvas.current;
  const {x, y, zoom, rotation} = transform.current;
  const baseSize = Math.min(width, height);
  const scale = (2 ** zoom) * baseSize;
  return Transform.from({
    x, y, scale, rotation,
  });
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
    const t = calculateTransform(transform, canvas);
    const {scale} = t;
    const dmx = mouseState.current.startMouseX - event.clientX;
    const dmy = mouseState.current.startMouseY - event.clientY;

    const x = mouseState.current.startX + dmx / scale;
    const y = mouseState.current.startY + dmy / scale;

    if (onTransform) {
      onTransform({...transform.current, x, y});
    }
  }, [onTransform, mouseState, transform, canvas]);

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
    const zoom = Math.max(0, transform.current.zoom - zoomDelta);

    const newTransformValue = {
      ...transform.current,
      zoom,
    };

    const oldTransform = calculateTransform(transform, canvas);
    const newTransform = calculateTransform({current: newTransformValue}, canvas);

    // Reposition so the cursor is over the same position it was before.
    const dpiScale = window.devicePixelRatio || 1;
    const viewX = (event.clientX - canvas.current.clientWidth * 0.5) * dpiScale;
    const viewY = (event.clientY - canvas.current.clientHeight * 0.5) * dpiScale;
    const [x1, y1] = oldTransform.unproject(viewX, viewY);
    const [x2, y2] = newTransform.unproject(viewX, viewY);
    const dx = x1 - x2;
    const dy = y1 - y2;

    newTransformValue.x += dx;
    newTransformValue.y += dy;

    if (onTransform) {
      onTransform(newTransformValue);
    }
  }, [onTransform, transform, canvas]);

  return (
    <div className={`Map ${className}`}>
      <canvas
        className={`Map ${className}`}
        ref={canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}/>
      <div className={containerClassName}>
        {children}
      </div>
    </div>
  );
}
