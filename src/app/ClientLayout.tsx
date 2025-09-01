"use client";
import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LogoutIcon from '@mui/icons-material/Logout';
import { logoutAction } from '../actions/authActions';
import MenuIcon from '@mui/icons-material/Menu';
import { Sidebar } from '../components/layout';
import Drawer from '@mui/material/Drawer';
import { LoadingSpinner } from '../components/ui';

const drawerWidth = 240;
const sites = [
  { id: 1, name: '台北市信義區充電站', address: '台北市信義區信義路五段7號' },
  { id: 2, name: '新北市板橋區充電站', address: '新北市板橋區文化路一段100號' },
  { id: 3, name: '桃園市中壢區充電站', address: '桃園市中壢區中正路二段50號' },
  { id: 4, name: '台中市西屯區充電站', address: '台中市西屯區台灣大道三段99號' },
  { id: 5, name: '高雄市前金區充電站', address: '高雄市前金區中正路四段200號' },
];

// Stable sx objects to avoid recreating on every render
const flexBoxSx = { display: 'flex' };
const appBarSx = { zIndex: (theme: { zIndex: { drawer: number } }) => theme.zIndex.drawer + 1 };
const menuIconButtonSx = { mr: 2, display: 'flex' };
const titleSx = { flexGrow: 1 };
const siteNameSx = { mr: 2, display: { xs: 'none', sm: 'block' } };
const themeIconButtonSx = { ml: 1 };
const logoutButtonSx = { ml: 1 };
const drawerSx = {
  display: { xs: 'none', sm: 'block' },
  '& .MuiDrawer-paper': {
    boxSizing: 'border-box',
    overflowX: 'hidden',
    transition: 'width 200ms',
  },
};

// Memoized AppBar component
const AppBarComponent = React.memo(function AppBarComponent({
  onDrawerToggle,
  selectedSiteName,
  darkMode,
  onThemeToggle,
  onLogout,
}: {
  onDrawerToggle: () => void;
  selectedSiteName: string;
  darkMode: boolean;
  onThemeToggle: () => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <AppBar position="fixed" sx={appBarSx}>
      <Toolbar>
        <IconButton 
          color="inherit" 
          aria-label="open drawer" 
          edge="start" 
          onClick={onDrawerToggle} 
          sx={menuIconButtonSx}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={titleSx}>
          EMS 能源管理系統
        </Typography>
        <Typography variant="body2" sx={siteNameSx}>
          {selectedSiteName}
        </Typography>
        <IconButton sx={themeIconButtonSx} color="inherit" onClick={onThemeToggle}>
          {darkMode ? '🌞' : '🌙'}
        </IconButton>
        <Button 
          color="inherit" 
          startIcon={<LogoutIcon />} 
          sx={logoutButtonSx} 
          onClick={onLogout} 
          title="登出"
        >
          登出
        </Button>
      </Toolbar>
    </AppBar>
  );
}, (prev, next) => 
  prev.selectedSiteName === next.selectedSiteName &&
  prev.darkMode === next.darkMode
);

// Memoized Drawer component
const DrawerComponent = React.memo(function DrawerComponent({
  drawerOpen,
  drawerWidth,
  children,
}: {
  drawerOpen: boolean;
  drawerWidth: number;
  children: React.ReactNode;
}) {
  const dynamicDrawerSx = React.useMemo(() => ({
    ...drawerSx,
    '& .MuiDrawer-paper': {
      ...drawerSx['& .MuiDrawer-paper'],
      width: drawerOpen ? drawerWidth : 60,
    },
  }), [drawerOpen, drawerWidth]);

  return (
    <Drawer variant="permanent" open sx={dynamicDrawerSx}>
      {children}
    </Drawer>
  );
}, (prev, next) => prev.drawerOpen === next.drawerOpen);

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(true);
  const [siteDialogOpen, setSiteDialogOpen] = React.useState(false);
  const [selectedSite, setSelectedSite] = React.useState(sites[0]);
  const [darkMode, setDarkMode] = React.useState(false);
  
  const theme = React.useMemo(() => createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#b5cc39',
      },
    },
  }), [darkMode]);

  // Memoized handlers to prevent unnecessary re-renders
  const handleDrawerToggle = React.useCallback(() => {
    React.startTransition(() => {
      setDrawerOpen((prev) => !prev);
    });
  }, []);
  
  const handleThemeToggle = React.useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);
  
  const handleSiteSelect = React.useCallback((site: typeof sites[0]) => {
    setSelectedSite(site);
    setSiteDialogOpen(false);
  }, []);
  
  const handleOpenSiteDialog = React.useCallback(() => setSiteDialogOpen(true), []);
  
  const handleLogout = React.useCallback(async () => {
    try {
      // 使用 server action 進行登出
      await logoutAction();
    } catch (e) {
      console.error('Logout failed', e);
      // 如果 server action 失敗，直接導航到登入頁面
      window.location.href = '/login';
    }
  }, []);

  // Memoized main content sx to avoid recreation
  const mainSx = React.useMemo(() => ({
    flexGrow: 1,
    p: 3,
    ml: { xs: 0, sm: drawerOpen ? `${drawerWidth}px` : '60px' },
    width: { xs: '100%', sm: `calc(100% - ${drawerOpen ? drawerWidth : 60}px)` },
    mb: 6,
  }), [drawerOpen]);

  // Sidebar now imports menu definitions itself, only pass runtime props
  const drawer = React.useMemo(() => (
    <Sidebar
      drawerOpen={drawerOpen}
      selectedSite={selectedSite}
      onOpenSiteDialog={handleOpenSiteDialog}
    />
  ), [drawerOpen, selectedSite, handleOpenSiteDialog]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={flexBoxSx} suppressHydrationWarning>
        <CssBaseline />
        
        <AppBarComponent
          onDrawerToggle={handleDrawerToggle}
          selectedSiteName={selectedSite.name}
          darkMode={darkMode}
          onThemeToggle={handleThemeToggle}
          onLogout={handleLogout}
        />

        <DrawerComponent
          drawerOpen={drawerOpen}
          drawerWidth={drawerWidth}
        >
          {drawer}
        </DrawerComponent>

        <Box component="main" sx={mainSx}>
          <Toolbar />
          <React.Suspense fallback={<LoadingSpinner message="載入頁面內容..." showImmediately={true} />}>
            {children}
          </React.Suspense>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
