import {Suspense} from "react";
import {mount, route} from "navi";
import {Router, View} from "react-navi";
import {CssBaseline} from "@mui/material";
import Layout from "./Layout";
import Map from "./Map";
import './App.css';

const routes = mount({
  '/': route({
    title: 'Map',
    view: <Map x={-1.3207825} y={51.8001957} zoom={10} />,
  }),
})

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
