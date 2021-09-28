import {useCallback, useState} from "react";
import {Container, Dialog, Divider, IconButton, List, ListItem, ListItemIcon, ListItemText, Paper} from "@mui/material";
import {Visibility, VisibilityOff} from "@mui/icons-material";
import {DEFAULT_LAYERS, DEFAULT_PALETTE} from "../services/style";
import ColourPicker from "./ColourPicker";
import "./MapStyleView.css";

function hasProp(v, k) {
  return Object.prototype.hasOwnProperty.call(v, k);
}

function propOr(v, k, d) {
  return hasProp(v, k) ? v[k] : d;
}

function Section({name, isVisible = null, setVisible, children}) {
  const icon = (isVisible !== null) ? (
    isVisible ? <Visibility/> : <VisibilityOff/>
  ) : null;

  return (
    <>
      <ListItem sx={{maxWidth: 300}}>
        <ListItemIcon sx={{minWidth: 40}}/>
        <ListItemText primary={name} sx={{textAlign: "center"}}/>
        <IconButton
          onClick={() => setVisible(!isVisible)}>
          {icon}
        </IconButton>
      </ListItem>
      <List className="MapStyleView-section">{children}</List>
    </>
  );
}

function ConfigSection({name, layer, children, mapConfig, mapConfigDispatcher}) {
  const {config} = mapConfig;
  const isVisible = propOr(config.layersVisible, layer, DEFAULT_LAYERS[layer]);
  const setVisible = useCallback(v => {
    mapConfigDispatcher.setLayerVisible(layer, v);
  }, [layer, mapConfigDispatcher]);

  return (
    <Section
      name={name}
      children={children}
      isVisible={isVisible}
      setVisible={setVisible}
    />
  );
}

function Swatch({name, value, visible, setVisible, onClick}) {
  const visibilityIcon = (visible !== null) ? (
    visible ? <Visibility/> : <VisibilityOff/>
  ) : null;

  return (
    <ListItem className="MapStyleView-swatch">
      <ListItemIcon sx={{minWidth: 48}}>
        <Paper onClick={onClick} style={{backgroundColor: value, width: 24, height: 24}}/>
      </ListItemIcon>
      <ListItemText primary={name}/>
      <IconButton
        onClick={() => setVisible(!visible)}>
        {visibilityIcon}
      </IconButton>
    </ListItem>
  );
}

function ConfigSwatch({mapConfig, mapConfigDispatcher, name, configKey}) {
  const {config} = mapConfig;
  const colour = propOr(config.palette, configKey, DEFAULT_PALETTE[configKey]);
  const isVisible = propOr(config.layersVisible, configKey, DEFAULT_LAYERS[configKey]);
  const setVisible = useCallback(v => {
    mapConfigDispatcher.setLayerVisible(configKey, v);
  }, [configKey, mapConfigDispatcher]);
  const [editingValue, setEditingValue] = useState(false);

  const applyColour = () => {
    mapConfigDispatcher.setColour(configKey, editingValue);
    setEditingValue(null);
  };

  return (
    <>
      <Swatch
        name={name}
        value={colour}
        visible={isVisible}
        setVisible={setVisible}
        onClick={() => setEditingValue(colour)}
      />
      <Dialog open={!!editingValue} onClose={applyColour}>
        <ColourPicker value={editingValue || '#ffffff'} setValue={setEditingValue}/>
      </Dialog>
    </>
  );
}

export default function MapStyleView(props) {
  const {
    className,
    style,
    mapConfig,
    mapConfigDispatcher,
  } = props;
  const configKeys = {mapConfig, mapConfigDispatcher};

  return (
    <Container maxWidth="lg" className={`MapStyleView-container ${className}`} style={style}>
      <ConfigSection name="Ground" layer="GROUND" {...configKeys}>
        <ConfigSwatch name="Coast" configKey="COAST" {...configKeys} />
        <ConfigSwatch name="Apron" configKey="APRON" {...configKeys} />
        <ConfigSwatch name="Taxiway" configKey="TAXIWAY" {...configKeys} />
        <ConfigSwatch name="Taxiway Center" configKey="TAXI_CENTER" {...configKeys} />
        <ConfigSwatch name="Runway" configKey="RUNWAY" {...configKeys} />
        <ConfigSwatch name="Runway Center" configKey="RUNWAYCENTER" {...configKeys} />
        <ConfigSwatch name="Buildings" configKey="BUILDING" {...configKeys} />
        <ConfigSwatch name="Stop bar" configKey="STOPBAR" {...configKeys} />

        <ConfigSwatch name="Danger Area" configKey="DANGER" {...configKeys} />
        <ConfigSwatch name="Prohibited Area" configKey="PROHIBIT" {...configKeys} />
        <ConfigSwatch name="Restricted Area" configKey="RESTRICT" {...configKeys} />
      </ConfigSection>
      <Divider style={{ width: '100%' }}/>
      <ConfigSection name="Labels" layer="LABELS" {...configKeys}/>
      <Divider style={{ width: '100%' }}/>
      <ConfigSection name="Pilots" layer="PILOTS" {...configKeys}/>
    </Container>
  );
}
