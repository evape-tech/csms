import React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Link from 'next/link';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EvStationIcon from '@mui/icons-material/EvStation';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import PaymentIcon from '@mui/icons-material/Payment';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PeopleIcon from '@mui/icons-material/People';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import BuildIcon from '@mui/icons-material/Build';
import SecurityIcon from '@mui/icons-material/Security';
import DescriptionIcon from '@mui/icons-material/Description';

// Stable menu definitions placed inside Sidebar module to avoid recreating references in layout
const dashboardItem = { label: '儀錶板', path: '/dashboard', icon: DashboardIcon };

const groupedMenuItems = [
  {
    group: '充電管理',
    items: [
      { label: '充電狀態監控', path: '/charging_status', icon: EvStationIcon },
    ],
  },
  {
    group: '用電與費率',
    items: [
      { label: '電力統計與分析', path: '/power_analysis', icon: QueryStatsIcon },
      { label: '電價管理', path: '/pricing_management', icon: PriceChangeIcon },
    ],
  },
  {
    group: '用戶與權限',
    items: [
      { label: '用戶資料管理', path: '/user_management', icon: PeopleIcon },
      { label: '支付方式管理', path: '/payment_management', icon: PaymentIcon },
    ],
  },
  {
    group: '維運與報表',
    items: [
      { label: '故障回報協調', path: '/fault_report', icon: ReportProblemIcon },
      { label: '硬體維護', path: '/hardware_maintenance', icon: BuildIcon },
      { label: '安全日誌', path: '/security_log', icon: SecurityIcon },
      { label: '報表中心', path: '/reports', icon: DescriptionIcon },
    ],
  },
];

// Stable sx objects to avoid recreation on every render
const listButtonSx = { textDecoration: 'none', color: 'inherit' };
const dashboardButtonSx = { textDecoration: 'none', color: 'inherit' };
const siteButtonSx = { minHeight: 48, px: 2.5 };
const siteButtonOpenSx = { minHeight: 48, justifyContent: 'initial', px: 2.5 };
const siteButtonClosedSx = { minHeight: 48, justifyContent: 'center', px: 2.5 };
const siteIconSx = { minWidth: 0, justifyContent: 'center' };
const siteIconOpenSx = { minWidth: 0, mr: 3, justifyContent: 'center' };
const siteIconClosedSx = { minWidth: 0, mr: 'auto', justifyContent: 'center' };
const primaryTypographySx = { noWrap: true, sx: { fontSize: '1rem' } };
const dividerSx = { my: 1 };
const listGrowSx = { flexGrow: 1 };
const boxMinWidthSx = { minWidth: 120 };

// Optimized NavItem with disableRipple for testing performance
const NavItem = React.memo(function NavItem({ item, drawerOpen }:{ item:any; drawerOpen:boolean }) {
  const Icon = item.icon;
  return (
    <ListItem disablePadding>
      <ListItemButton 
        component={Link} 
        href={item.path} 
        sx={listButtonSx}
        disableRipple
        disableTouchRipple
      >
        <ListItemIcon>
          <Icon />
        </ListItemIcon>
        {drawerOpen && <ListItemText primary={item.label} />}
      </ListItemButton>
    </ListItem>
  );
}, (prev, next) => prev.drawerOpen === next.drawerOpen && prev.item.label === next.item.label && prev.item.path === next.item.path);

// Dashboard item component with memo
const DashboardItem = React.memo(function DashboardItem({ drawerOpen }: { drawerOpen: boolean }) {
  const Icon = dashboardItem.icon;
  return (
    <ListItem disablePadding>
      <ListItemButton 
        component={Link} 
        href={dashboardItem.path} 
        sx={dashboardButtonSx}
        disableRipple
        disableTouchRipple
      >
        <ListItemIcon>
          <Icon />
        </ListItemIcon>
        {drawerOpen && <ListItemText primary={dashboardItem.label} />}
      </ListItemButton>
    </ListItem>
  );
}, (prev, next) => prev.drawerOpen === next.drawerOpen);

// Version selector component with memo
const VersionSelector = React.memo(function VersionSelector() {
  return (
    <List>
      <ListItem>
        <ListItemText primary="授權版本" />
        <Box sx={boxMinWidthSx}>
          <FormControl size="small" fullWidth>
            <InputLabel id="version-label">版本</InputLabel>
            <Select labelId="version-label" label="版本" defaultValue="APP">
              <MenuItem value="APP">APP版</MenuItem>
              <MenuItem value="Abroad">海外版</MenuItem>
              <MenuItem value="Condo">社區版</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </ListItem>
    </List>
  );
});

// Site selector component with memo
const SiteSelector = React.memo(function SiteSelector({ 
  drawerOpen, 
  selectedSite, 
  onOpenSiteDialog 
}: { 
  drawerOpen: boolean; 
  selectedSite: any; 
  onOpenSiteDialog: () => void; 
}) {
  return (
    <List>
      <ListItem disablePadding>
        <ListItemButton 
          onClick={onOpenSiteDialog}
          sx={drawerOpen ? siteButtonOpenSx : siteButtonClosedSx}
          disableRipple
          disableTouchRipple
        >
          <ListItemIcon sx={drawerOpen ? siteIconOpenSx : siteIconClosedSx}>
            <LocationOnIcon />
          </ListItemIcon>
          {drawerOpen && (
            <>
              <ListItemText 
                primary={selectedSite.name} 
                primaryTypographyProps={primaryTypographySx} 
              />
              <KeyboardArrowRightIcon />
            </>
          )}
        </ListItemButton>
      </ListItem>
    </List>
  );
}, (prev, next) => 
  prev.drawerOpen === next.drawerOpen && 
  prev.selectedSite?.id === next.selectedSite?.id &&
  prev.selectedSite?.name === next.selectedSite?.name
);

function Sidebar({ drawerOpen, selectedSite, onOpenSiteDialog } : {drawerOpen:boolean; selectedSite:any; onOpenSiteDialog: ()=>void}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar />
      <Divider />
      <List sx={listGrowSx}>
        <DashboardItem drawerOpen={drawerOpen} />
        <Divider sx={dividerSx} />
        {groupedMenuItems.map((group) => (
          <React.Fragment key={group.group}>
            <ListSubheader>{group.group}</ListSubheader>
            {group.items.map((item:any) => (
              <NavItem key={item.label} item={item} drawerOpen={drawerOpen} />
            ))}
          </React.Fragment>
        ))}
      </List>

      <Divider />

      {/* VersionSelector hidden */}

      <SiteSelector 
        drawerOpen={drawerOpen}
        selectedSite={selectedSite}
        onOpenSiteDialog={onOpenSiteDialog}
      />
    </div>
  );
}

export default React.memo(Sidebar, (prev, next) => prev.drawerOpen === next.drawerOpen && prev.selectedSite?.id === next.selectedSite?.id);
