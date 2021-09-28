import {useMemo, useReducer} from "react";
import hash from "object-hash";

const DEBOUNCE_MS = 1000;
const STORAGE_KEY = 'net.teamfrag.open-air.map.config';

function hashConfig(config) {
  return hash(config).substr(0, 7);
}

function loadLocalStorageJSON(key) {
  const contents = window.localStorage.getItem(key);
  if (!contents) {
    return null;
  }

  try {
    return JSON.parse(contents);
  } catch(err) {
    console.error('failed to parse existing config', err);
    return null;
  }
}

function saveLocalStorageJSON(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadMapConfig() {
  const existing = loadLocalStorageJSON(STORAGE_KEY) || {};
  const config = {
    layersVisible: existing.layersVisible || {},
    palette: existing.palette || {},
  };

  return {
    saving: {timeout: null},
    keys: [hashConfig(config)],
    config,
  };
}

function saveMapConfig(state) {
  saveLocalStorageJSON(STORAGE_KEY, state.config);
}

function makeTimerCell(f) {
  const cell = {};

  cell.timeout = setTimeout(() => {
    f && f();
    cell.timeout = null;
  }, DEBOUNCE_MS);

  return cell;
}

function reduceMapConfig(prevState, action) {
  let newState = prevState;

  switch (action.type) {
    case 'layer-visibility':
      newState = {
        ...newState,
        config: {
          ...newState.config,
          layersVisible: {
            ...newState.config.layersVisible,
            [action.layer]: action.visible,
          },
        },
      };
      break;

    default:
      throw new Error('unexpected action ' + action.type);
  }

  if (newState.config !== prevState.config) {
    newState.keys.unshift(hashConfig(newState.config));
    if (newState.keys.length > 5) {
      newState.keys.pop();
    }
  }

  // Persist new state.
  if (newState !== prevState) {
    if (newState.saving.timeout === null) {
      newState.saving = makeTimerCell(null);
      saveMapConfig(newState);
    } else {
      clearTimeout(newState.saving.timeout);
      newState.saving = makeTimerCell(() => {
        saveMapConfig(newState);
      });
    }
  }

  return newState;
}

export function useMapConfig() {
  const [state, dispatch] = useReducer(reduceMapConfig, null, loadMapConfig);
  const dispatcher = useMemo(() => ({
    setLayerVisible: (layer, visible) => dispatch({type: 'layer-visibility', layer, visible}),
  }), [dispatch]);
  return [state, dispatcher];
}
