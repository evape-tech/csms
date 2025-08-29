import React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Divider from '@mui/material/Divider';

/**
 * NavigationGroup
 * Props:
 * - groupedMenuItems: Array of menu groups { group, items }
 * - selectedIndex: number
 * - drawerOpen: boolean
 * - handleListItemClick: function(index)
 */
const NavigationGroup = ({ groupedMenuItems, selectedIndex, drawerOpen, handleListItemClick }) => (
  <>
    {groupedMenuItems.map((group, groupIdx) => [
      drawerOpen && <ListSubheader key={group.group}>{group.group}</ListSubheader>,
      ...group.items.map((item, idx) => {
        const flatIndex = 1 + groupedMenuItems.slice(0, groupIdx).reduce((acc, g) => acc + g.items.length, 0) + idx;
        return (
          <ListItem key={item.label} disablePadding>
            <ListItemButton 
              selected={selectedIndex === flatIndex} 
              onClick={() => handleListItemClick(flatIndex)}
              sx={{
                minHeight: 48,
                justifyContent: drawerOpen ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: drawerOpen ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={item.label} />}
            </ListItemButton>
          </ListItem>
        );
      })
    ])}
  </>
);

export default NavigationGroup;
