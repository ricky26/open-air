import {useEffect, useRef} from "react";
import {DEG2RAD, useMap} from "../services/map";
import "./Map.css";

export default function Map(props) {
  const {
    zoom = 1,
    x = 0,
    y = 0,
    rotation = 0,
  } = props;
  const transform = useRef({ x, y, zoom, rotation });
  Object.assign(transform.current, { x, y, zoom, rotation });

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
      const { x, y, zoom, rotation } = transform.current;
      const baseScale = (zoom * 0.5) / 90;
      const scaleX = bufferW * baseScale * (screenH / screenW);
      const scaleY = bufferH * baseScale;
      const cosR = Math.cos(rotation * DEG2RAD);
      const sinR = Math.sin(rotation * DEG2RAD);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, bufferW, bufferH);
      ctx.setTransform(scaleX, 0, 0, -scaleY, bufferW * 0.5, bufferH * 0.5);
      ctx.transform(cosR, -sinR, sinR, cosR, -x, -y);

      mapService.draw(ctx, -20, 40, 30, 30, scaleX, scaleY);

      if (running) {
        requestAnimationFrame(draw);
      }
    }

    draw();
    return () => {
      running = false;
    };
  });

  return (
    <canvas className={"Map"} ref={canvas}/>
  );
}
