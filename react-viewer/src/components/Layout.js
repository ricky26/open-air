import {AppBar, Box, Icon, IconButton, Toolbar, Typography} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export default function Layout({children}) {
  return (
    <div className="App">
      <AppBar position="fixed" elevation={10}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" aria-label="menu" sx={{mr: 2}}>
            <MenuIcon/>
          </IconButton>
          <Typography variant="h6" color="inherit" component="div">
            Open Air
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton href="https://github.com/ricky26/open-air">
            <img src="/images/github-light-64px.png" width="24px" height="24px"/>
          </IconButton>
        </Toolbar>
      </AppBar>
      <main>{children}</main>
    </div>
  );
}
