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
import { LoadingSpinner } from '../components/ui';

const drawerWidth = 240;

// Site interface based on the new stations schema
interface Site {
  id: number;
  station_code: string;
  name: string | null;
  address: string | null;
  floor: string | null;
  operator_id: string | null;
  tariff_id: number | null;
  updated_at: string;
  meters?: any[];
  tariff?: any;
}

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
}); // Removed custom comparator - React will now compare children by reference

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(true);
  const [siteDialogOpen, setSiteDialogOpen] = React.useState(false);
  const [sites, setSites] = React.useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = React.useState<Site | null>(null);
  const [darkMode, setDarkMode] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch sites from API
  React.useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/stations');
        if (!response.ok) {
          throw new Error(`Failed to fetch sites: ${response.status}`);
        }
        
        const data = await response.json();
        setSites(data);
        
        // Set first site as selected if available
        if (data.length > 0) {
          setSelectedSite(data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch sites:', err);
        setError(err instanceof Error ? err.message : 'Failed to load sites');
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, []);
  
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
  
  const handleSiteSelect = React.useCallback((site: Site) => {
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

  // Compute selected site name with proper fallback
  const selectedSiteName = React.useMemo(() => {
    if (!selectedSite) return '載入中...';
    return selectedSite.name || selectedSite.station_code || '未命名站點';
  }, [selectedSite]);

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
          onClose={() => setSiteDialogOpen(false)}
          sites={sites}
          selectedSite={selectedSite}
          onSiteSelect={handleSiteSelect}
        />
      </Box>
    </ThemeProvider>
  );
}
