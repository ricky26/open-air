import {hsv2rgb, rgb2hex, rgb2hsv, rgb2str} from "../services/colour";
import {ListItem, ListItemIcon, ListItemText, Paper, TextField} from "@mui/material";
import "./ColourPicker.css";
import {useCallback, useState} from "react";

const HUE_BOX_SIZE = 250;

function getEventXY(event) {
  const {left, top} = event.target.getBoundingClientRect();

  if (event.touches) {
    let x = 0;
    let y = 0;

    for (let i = 0; i < event.touches.length; ++i) {
      const t = event.touches[i];
      x += t.clientX;
      y += t.clientY;
    }

    x /= event.touches.length;
    y /= event.touches.length;
    return [x - left, y - top, true];
  }

  return [event.clientX - left, event.clientY - top, event.buttons !== 0];
}

function parseColour(v) {
  if (!v.startsWith('#')) {
    throw new Error('not valid colour ' + v);
  }

  const r = Math.min(1, Math.max(0, parseInt(v.substr(1, 2), 16) / 255));
  const g = Math.min(1, Math.max(0, parseInt(v.substr(3, 2), 16) / 255));
  const b = Math.min(1, Math.max(0, parseInt(v.substr(5, 2), 16) / 255));
  return [r, g, b];
}

function checkHex(v) {
  return !isNaN(parseInt(v, 16));
}

function validateColour(v) {
  if (v.length !== 7 || !v.startsWith('#')) {
    return false;
  }

  return v.length === 7
    && v.startsWith('#')
    && checkHex(v.substr(1, 2))
    && checkHex(v.substr(3, 2))
    && checkHex(v.substr(5, 2));
}

export default function ColourPicker({value, setValue}) {
  const [editingValue, setEditingValue] = useState(null);
  const validValue = (editingValue && validateColour(editingValue))
    ? editingValue : value;
  const [r, g, b] = parseColour(validValue);
  const [h, s, v] = rgb2hsv(r, g, b);
  const hueColour = rgb2str(...hsv2rgb(h, 1, 1));

  const handleEditing = useCallback(event => {
    setEditingValue(event.target.value);
  }, [setEditingValue]);

  const finishEditing = useCallback(event => {
    if (validateColour(event.target.value)) {
      setValue(event.target.value);
    }
    setEditingValue(null);
  }, [setValue, setEditingValue]);

  const handleSVChange = useCallback(event => {
    const [x, y, down] = getEventXY(event);
    if (!down) {
      return;
    }

    const s = Math.max(0, Math.min(1, x / HUE_BOX_SIZE));
    const v = Math.max(0, Math.min(1, 1 - (y / HUE_BOX_SIZE)));
    setValue(rgb2hex(...hsv2rgb(h, s, v)));
  }, [h, setValue]);

  const handleHueChange = useCallback(event => {
    const [x, , down] = getEventXY(event);
    if (!down) {
      return;
    }

    const h = x / HUE_BOX_SIZE;
    setValue(rgb2hex(...hsv2rgb(h, s, v)));
  }, [s, v, setValue]);

  return (
    <div>
      <ListItem className="ColourPicker-swatch">
        <ListItemIcon sx={{minWidth: 48}}>
          <Paper style={{backgroundColor: validValue, width: 24, height: 24}}/>
        </ListItemIcon>
        <ListItemText>
          <TextField
            style={{width: 150}}
            size="small"
            variant="standard"
            value={editingValue || value}
            onChange={handleEditing}
            onBlur={finishEditing}
          />
        </ListItemText>
      </ListItem>

      <Paper elevation={2} className="ColourPicker-hue-base" style={{backgroundColor: hueColour}}>
        <Paper elevation={0} className="ColourPicker-hue-overlay ColourPicker-hue-overlay-white">
          <Paper
            elevation={0}
            className="ColourPicker-hue-overlay ColourPicker-hue-overlay-black"
            onMouseDown={handleSVChange}
            onMouseMove={handleSVChange}
            onTouchStart={handleSVChange}
            onTouchMove={handleSVChange}
          >
            <Paper
              elevation={3}
              className="ColourPicker-thumb"
              style={{
                left: HUE_BOX_SIZE * s,
                top: HUE_BOX_SIZE * (1 - v),
                backgroundColor: validValue,
              }}
            />
          </Paper>
        </Paper>
      </Paper>

      <Paper
        elevation={2}
        className="ColourPicker-hue-slider"
        onMouseDown={handleHueChange}
        onMouseMove={handleHueChange}
        onTouchStart={handleHueChange}
        onTouchMove={handleHueChange}
      >
        <Paper elevation={3}
               style={{backgroundColor: hueColour, left: h * HUE_BOX_SIZE}}
               className="ColourPicker-thumb ColourPicker-thumb-hue"
        />
      </Paper>
    </div>
  );
}
