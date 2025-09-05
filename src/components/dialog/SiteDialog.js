"use client";
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function SiteDialog({ open, onClose, sites, selectedSite, onSiteSelect }) {
  const handleSiteClick = (site) => {
    onSiteSelect(site);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: 400
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <LocationOnIcon color="primary" />
          <Typography variant="h6" component="span">
            選擇充電場域
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          請選擇要管理的充電場域
        </Typography>
      </DialogTitle>
      
      <Divider />
      
      <DialogContent sx={{ p: 0 }}>
        <List>
          {sites.map((site, index) => (
            <React.Fragment key={site.id}>
              <ListItem disablePadding>
                <ListItemButton 
                  onClick={() => handleSiteClick(site)}
                  selected={selectedSite?.id === site.id}
                  sx={{
                    py: 2,
                    px: 3,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.50',
                      '&:hover': {
                        backgroundColor: 'primary.100',
                      }
                    }
                  }}
                >
                  <ListItemIcon>
                    {selectedSite?.id === site.id ? (
                      <CheckCircleIcon color="primary" />
                    ) : (
                      <LocationOnIcon color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography 
                        variant="subtitle1" 
                        fontWeight={selectedSite?.id === site.id ? 600 : 400}
                        color={selectedSite?.id === site.id ? 'primary.main' : 'text.primary'}
                      >
                        {site.name}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {site.address}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < sites.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>
        
        {sites.length === 0 && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center" 
            py={6}
          >
            <LocationOnIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              沒有可用的充電場域
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              請聯繫系統管理員設定充電場域
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
