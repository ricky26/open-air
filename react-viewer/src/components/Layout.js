import {AppBar, Box, createTheme, IconButton, ThemeProvider, Toolbar, Typography} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import {Lightbulb, LightbulbOutlined} from "@mui/icons-material";
import {useReducer} from "react";

const THEME_KEY = 'net.teamfrag.open-air.light-theme';

const primary = {main: '#673ab7'};
const secondary = {main: '#536dfe'};
const lightTheme = createTheme({
  palette: {
    primary,
    secondary,
  },
});
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary,
    secondary,
  },
  components: {
    MuiAppBar: {
      defaultProps: {
        enableColorOnDark: true,
      },
    },
  },
});

function loadIsLightMode() {
  return !!window.localStorage.getItem(THEME_KEY)
}

function toggleIsLightMode(oldState) {
  if (oldState) {
    window.localStorage.removeItem(THEME_KEY)
  } else {
    window.localStorage.setItem(THEME_KEY, 'on');
  }

  return !oldState;
}

export default function Layout({children}) {
  const [isLightMode, toggleLightMode] = useReducer(toggleIsLightMode, null, loadIsLightMode);
  const theme = isLightMode ? lightTheme : darkTheme;
  const ThemeIcon = isLightMode ? Lightbulb : LightbulbOutlined;

  return (
    <div className="App">
      <ThemeProvider theme={theme}>
        <AppBar position="fixed" elevation={10}>
          <Toolbar variant="dense">
            <IconButton edge="start" color="inherit" aria-label="menu" sx={{mr: 2}}>
              <MenuIcon/>
            </IconButton>
            <Typography variant="h6" color="inherit" component="div">
              Open Air
            </Typography>
            <Box sx={{flexGrow: 1}}/>
            <IconButton onClick={toggleLightMode}>
              <ThemeIcon sx={{color: 'white'}}/>
            </IconButton>
            <IconButton href="https://github.com/ricky26/open-air">
              <img src={"/images/github-light-64px.png"} width="24px" height="24px" alt="View source on GitHub"/>
            </IconButton>
          </Toolbar>
        </AppBar>
        <main>{children}</main>
      </ThemeProvider>
    </div>
  );
}
