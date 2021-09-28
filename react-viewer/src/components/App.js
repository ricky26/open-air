import {Suspense} from "react";
import {createBrowserNavigation, mount, route} from "navi";
import {Router, View} from "react-navi";
import qs from "qs";
import {CssBaseline} from "@mui/material";
import Layout from "./Layout";
import MapView from "./MapView";
import './App.css';

function parseTransform(s) {
  const map = qs.parse(s);
  return {
    x: map.x ? parseFloat(map.x) : 0,
    y: map.y ? parseFloat(map.y) : 0,
    zoom: map.zoom ? parseFloat(map.zoom) : 1,
    rotation: map.rotation ? parseFloat(map.rotation) : 0,
  };
}

function serialiseTransform({ x, y, zoom, rotation }) {
  const map = {
    x: x.toFixed(6),
    y: y.toFixed(6),
    zoom: zoom.toFixed(2),
  };

  if (rotation) {
    map.rotation = rotation.toFixed(1);
  }

  return qs.stringify(map);
}

const hashDebounce = { timer: null };
function setHashDebounced(hash) {
  if (hashDebounce.timer !== null) {
    clearTimeout(hashDebounce.timer);
  }

  hashDebounce.timer = setTimeout(() => {
    navigation.navigate(hash);
    hashDebounce.timer = null;
  }, 500);
}

const routes = mount({
  '/': route({
    title: 'Map',
    getView(request, context, arg) {
      const initialTransform = request.hash
        ? parseTransform(request.hash.substr(1))
        : {
          x: 0.49,
          y: 0.32,
          zoom: 5,
          rotation: 0,
        };
      const setTransform = transform => {
        setHashDebounced('#' + serialiseTransform(transform));
      };

      return (
        <MapView
          initialTransform={initialTransform}
          setTransform={setTransform}
        />
      );
    },
  }),
});
const navigation = createBrowserNavigation({
  routes,
});

function App() {
  return (
    <>
      <CssBaseline/>
      <Router navigation={navigation}>
        <Layout>
          <Suspense fallback={null}>
            <View/>
          </Suspense>
        </Layout>
      </Router>
    </>
  );
}

export default App;
