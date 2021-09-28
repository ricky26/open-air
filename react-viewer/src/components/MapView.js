import {useCallback, useMemo, useState} from "react";
import {DialogTitle, Drawer, IconButton, SpeedDial, SpeedDialAction, SpeedDialIcon} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import {GroundRenderer, LabelsRenderer} from "../services/ground";
import {Cache} from "../services/cache";
import {SectionSource} from "../services/sectionData";
import {Whazzup} from "../services/whazzup";
import {PilotRenderer} from "../services/pilots";
import {Airlines} from "../services/airlines";
import {useMapConfig} from "../services/map";
import {useMapStyle} from "../services/style";
import Map from "./Map";
import './App.css';
import MapStyleView from "./MapStyleView";
import {MoreHoriz} from "@mui/icons-material";

function MapContainer(props) {
  const {
    initialTransform,
    storeTransform,
    style,
    children,
  } = props;

  const [transform, setTransform] = useState(initialTransform);
  const onTransform = useCallback(({x, y, rotation, zoom}) => {
    x = Math.min(1, Math.max(0, x));
    y = Math.min(1, Math.max(0, y));
    zoom = Math.min(20, Math.max(0, zoom));
    setTransform({x, y, zoom, rotation});
    storeTransform({x, y, zoom, rotation});
  }, [setTransform, storeTransform]);


  const cache = Cache.default;
  const sections = SectionSource.default;
  const whazzup = Whazzup.default;
  const airlines = Airlines.default;

  const groundTiles = useMemo(() => new GroundRenderer(cache, sections, 1024), [cache, sections]);
  const groundLabels = useMemo(() => new LabelsRenderer(cache, sections, 1024), [cache, sections]);
  const pilots = useMemo(() => new PilotRenderer(whazzup, airlines), [whazzup, airlines]);

  const render = useCallback(renderer => {
    style.showLayer('GROUND') && groundTiles.draw(renderer, style);
    style.showLayer('LABELS') && groundLabels.draw(renderer, style);
    pilots.draw(renderer, style);
  }, [style, groundTiles, groundLabels, pilots]);

  return (
    <Map
      className="App-fill-parent"
      containerClassName="App-viewport-overlay"
      render={render}
      x={transform.x}
      y={transform.y}
      zoom={transform.zoom}
      rotation={transform.rotation}
      onTransform={onTransform}>
      {children}
    </Map>
  );
}

export default function MapView({initialTransform, setTransform}) {

  const [mapConfig, mapConfigDispatcher] = useMapConfig();
  const style = useMapStyle(mapConfig);
  const [showStyleDrawer, setShowStyleDrawer] = useState(false);
  const toggleStyleDrawer = useCallback(
    () => setShowStyleDrawer(!showStyleDrawer),
    [showStyleDrawer, setShowStyleDrawer]);

  return (
    <div className="App-viewport">
      <MapContainer
        initialTransform={initialTransform}
        storeTransform={setTransform}
        style={style}>
        <SpeedDial
          ariaLabel="style settings"
          hidden={showStyleDrawer}
          icon={<SpeedDialIcon icon={<SettingsIcon/>}/>}
          direction="up"
          sx={{position: "absolute", right: 12, bottom: 12}}>
          <SpeedDialAction
            icon={<MoreHoriz/>}
            tooltipTitle="More settings"
            onClick={toggleStyleDrawer}
          />
        </SpeedDial>
        <Drawer
          variant="persistent"
          anchor="bottom"
          open={showStyleDrawer}
          onClose={toggleStyleDrawer}>

          <div style={{
            position: "relative",
            pointerEvents: "auto",
          }}>
            <DialogTitle sx={{m: 0, p: 1}}>
              Map Settings
              <IconButton
                onClick={toggleStyleDrawer}
                sx={{position: "absolute", m: 1, p: 0, right: 0, top: 0}}
              >
                <CloseIcon/>
              </IconButton>
            </DialogTitle>
            <div
              style={{
                height: "40vh",
                overflow: "auto",
              }}>
              <MapStyleView
                mapConfig={mapConfig}
                mapConfigDispatcher={mapConfigDispatcher}
              />
            </div>
          </div>
        </Drawer>
      </MapContainer>
    </div>
  );
}
