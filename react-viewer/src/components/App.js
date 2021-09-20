import {Suspense, useCallback, useState} from "react";
import {mount, route} from "navi";
import {Router, View} from "react-navi";
import {CssBaseline} from "@mui/material";
import Layout from "./Layout";
import Map from "./Map";
import './App.css';

const routes = mount({
  '/': route({
    title: 'Map',
    view: <StatefulMap/>,
  }),
})

function StatefulMap() {
  const [transform, setTransform] = useState({
    x: 0.49,
    y: 0.32,
    zoom: 5,
    rotation: 0,
  });

  const onTransform = useCallback(({ x, y, rotation, zoom }) => {
    x = Math.min(1, Math.max(0, x));
    y = Math.min(1, Math.max(0, y));
    zoom = Math.min(20, Math.max(0, zoom));
    setTransform({x, y, zoom, rotation});
  }, [setTransform]);

  return (
    <Map
      x={transform.x}
      y={transform.y}
      zoom={transform.zoom}
      rotation={transform.rotation}
      onTransform={onTransform}
    />
  )
}

function App() {
  return (
    <div className="App">
      <CssBaseline/>
      <Router routes={routes}>
        <Layout>
          <Suspense fallback={null}>
            <View/>
          </Suspense>
        </Layout>
      </Router>
    </div>
  );
}

export default App;
