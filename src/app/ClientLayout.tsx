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
import { SiteDialog } from '../components/dialog';
import Drawer from '@mui/material/Drawer';
import { LoadingSpinner, GlobalNotification } from '../components/ui';
import { useSiteStore, useSite } from '../stores/siteStore';
import type { Site } from '../stores/siteStore';
import { useUIStore } from '../stores/uiStore';
import { useUserStore, useUserDisplayName, useUserEmail } from '../stores/userStore';
import SiteSearchParamsSync from './SiteSearchParamsSync';

const drawerWidth = 240;

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

// Memoized User Info component for AppBar
const AppBarUserInfo = React.memo(function AppBarUserInfo() {
  const userDisplayName = useUserDisplayName();
  const userEmail = useUserEmail();
  
  if (!userEmail) return null;

  return (
    <Box sx={{ minWidth: 0, mr: 2 }}>
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: 500, 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {userDisplayName || userEmail}
      </Typography>
      <Typography 
        variant="caption" 
        sx={{ 
          display: 'block', 
          opacity: 0.8, 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {userEmail}
      </Typography>
    </Box>
  );
});

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
        <Box sx={{ flexGrow: 1 }} />
        <AppBarUserInfo />
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
}); // Removed custom comparator - React will now compare children by reference

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fetchSites = useSiteStore((s) => s.fetchSites);
  const fetchCurrentUser = useUserStore((s) => s.fetchCurrentUser);
  const { sites, selectedSite, selectedSiteName, selectSite, refreshSites } = useSite();

  // Trigger initial site fetch and user fetch on mount
  React.useEffect(() => {
    fetchSites();
    fetchCurrentUser();
  }, [fetchSites, fetchCurrentUser]);

  // UI state from Zustand store (persisted: drawerOpen, darkMode)
  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const darkMode = useUIStore((s) => s.darkMode);
  const siteDialogOpen = useUIStore((s) => s.siteDialogOpen);
  const toggleDrawer = useUIStore((s) => s.toggleDrawer);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
  const openSiteDialog = useUIStore((s) => s.openSiteDialog);
  const closeSiteDialog = useUIStore((s) => s.closeSiteDialog);

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
      toggleDrawer();
    });
  }, [toggleDrawer]);
  
  const handleThemeToggle = React.useCallback(() => {
    toggleDarkMode();
  }, [toggleDarkMode]);
  
  const handleSiteSelect = React.useCallback((site: Site) => {
    selectSite(site);
    closeSiteDialog();
  }, [selectSite, closeSiteDialog]);
  
  const handleOpenSiteDialog = React.useCallback(() => openSiteDialog(), [openSiteDialog]);
  
  const handleLogout = React.useCallback(async () => {
    await logoutAction();
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
      selectedSiteName={selectedSiteName}
      onOpenSiteDialog={handleOpenSiteDialog}
    />
  ), [drawerOpen, selectedSite, selectedSiteName, handleOpenSiteDialog]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={flexBoxSx} suppressHydrationWarning>
        <CssBaseline />
        <SiteSearchParamsSync />
        
        <AppBarComponent
          onDrawerToggle={handleDrawerToggle}
          selectedSiteName={selectedSiteName}
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

        {/* Site Selection Dialog */}
        <SiteDialog
          open={siteDialogOpen}
          onClose={closeSiteDialog}
          sites={sites}
          selectedSite={selectedSite}
          onSiteSelect={handleSiteSelect}
          onSitesChanged={refreshSites}
        />

        {/* Global Notification Snackbar */}
        <GlobalNotification />
      </Box>
    </ThemeProvider>
  );
}
