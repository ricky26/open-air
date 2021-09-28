import {Suspense} from "react";
import {mount, route} from "navi";
import {Router, View} from "react-navi";
import {CssBaseline} from "@mui/material";
import Layout from "./Layout";
import MapView from "./MapView";
import './App.css';

const routes = mount({
  '/': route({
    title: 'Map',
    view: <MapView/>,
  }),
})

function App() {
  return (
    <>
      <CssBaseline/>
      <Router routes={routes}>
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
