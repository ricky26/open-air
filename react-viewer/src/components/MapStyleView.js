import {Container, IconButton, List, ListItem, ListItemIcon, ListItemText, Paper, Typography} from "@mui/material";
import {Visibility, VisibilityOff} from "@mui/icons-material";
import {DEFAULT_LAYERS, DEFAULT_PALETTE} from "../services/style";
import {useCallback} from "react";
import "./MapStyleView.css";

function hasProp(v, k) {
  return Object.prototype.hasOwnProperty.call(v, k);
}

function propOr(v, k, d) {
  return hasProp(v, k) ? v[k] : d;
}

function Section({name, children}) {
  return (
    <>
      <Typography
        className="MapStyleView-section-header"
        variant="h8">
        {name}
      </Typography>
      <List className="MapStyleView-section">{children}</List>
    </>
  );
}

function Swatch({name, value, visible, setVisible}) {
  return (
    <ListItem className="MapStyleView-swatch">
      <ListItemIcon sx={{minWidth: 48}}>
        <Paper style={{backgroundColor: value, width: 24, height: 24}}/>
      </ListItemIcon>
      <ListItemText primary={name}/>
      <IconButton
        onClick={() => setVisible(!visible)}>
        {visible ? <Visibility/> : <VisibilityOff/>}
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

  return (
    <Swatch
      name={name}
      value={colour}
      visible={isVisible}
      setVisible={setVisible}
    />
  );
}

export default function MapStyleView(props) {
  const {
    className,
    style,
    mapConfig,
    mapConfigDispatcher,
  } = props;
  const swatchKeys = {mapConfig, mapConfigDispatcher};

  return (
    <Container maxWidth="lg" className={className} style={style}>
      <Section name="Ground">
        <ConfigSwatch name="Coast" configKey="COAST" {...swatchKeys} />
        <ConfigSwatch name="Apron" configKey="APRON" {...swatchKeys} />
        <ConfigSwatch name="Taxiway" configKey="TAXIWAY" {...swatchKeys} />
        <ConfigSwatch name="Taxiway Center" configKey="TAXI_CENTER" {...swatchKeys} />
        <ConfigSwatch name="Runway" configKey="RUNWAY" {...swatchKeys} />
        <ConfigSwatch name="Runway Center" configKey="RUNWAYCENTER" {...swatchKeys} />
        <ConfigSwatch name="Buildings" configKey="BUILDING" {...swatchKeys} />
        <ConfigSwatch name="Stop bar" configKey="STOPBAR" {...swatchKeys} />

        <ConfigSwatch name="Danger Area" configKey="DANGER" {...swatchKeys} />
        <ConfigSwatch name="Prohibited Area" configKey="PROHIBIT" {...swatchKeys} />
        <ConfigSwatch name="Restricted Area" configKey="RESTRICT" {...swatchKeys} />
      </Section>
    </Container>
  );
}
