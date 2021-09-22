import {Suspense, useCallback, useMemo, useState} from "react";
import {mount, route} from "navi";
import {Router, View} from "react-navi";
import {CssBaseline} from "@mui/material";
import Layout from "./Layout";
import Map from "./Map";
import './App.css';
import {GroundRenderer} from "../services/ground";
import {Cache} from "../services/cache";
import {SectionSource} from "../services/sectionData";

const routes = mount({
  '/': route({
    title: 'Map',
    view: <MainMapView/>,
  }),
})

function MainMapView() {
  const [transform, setTransform] = useState({
    worldX: 0.49,
    worldY: 0.32,
    zoom: 5,
    rotation: 0,
  });

  const onTransform = useCallback(({ worldX, worldY, rotation, zoom }) => {
    worldX = Math.min(1, Math.max(0, worldX));
    worldY = Math.min(1, Math.max(0, worldY));
    zoom = Math.min(20, Math.max(0, zoom));
    setTransform({worldX, worldY, zoom, rotation});
  }, [setTransform]);

  const groundTiles = useMemo(() => new GroundRenderer(Cache.default, SectionSource.default, 1024), []);
  const render = useCallback(renderer => {
    groundTiles.draw(renderer);
  }, [groundTiles]);

  return (
    <Map
      render={render}
      worldX={transform.worldX}
      worldY={transform.worldY}
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
