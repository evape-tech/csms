"use client";
import React, { useState, useTransition } from 'react';
import { Button, TextField, Stack, DialogActions, CircularProgress, Alert } from '@mui/material';
import { createStationAction } from '../../actions/stationActions';
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

export default function SiteDialog({ open, onClose, sites, selectedSite, onSiteSelect, onSitesChanged }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [stationCode, setStationCode] = useState('');
  const [stationName, setStationName] = useState('');
  const [stationAddress, setStationAddress] = useState('');
  const [stationFloor, setStationFloor] = useState('');
  const [stationOperator, setStationOperator] = useState('');
  const [createError, setCreateError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const handleSiteClick = (site) => {
    onSiteSelect(site);
  };

  const handleCreateStation = async () => {
    setCreateError(null);
    if (!stationCode || stationCode.trim() === '') {
      setCreateError('場域代碼為必填項');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('station_code', stationCode.trim());
        if (stationName) formData.append('name', stationName.trim());
        if (stationAddress) formData.append('address', stationAddress.trim());
        if (stationFloor) formData.append('floor', stationFloor.trim());
        if (stationOperator) formData.append('operator_id', stationOperator.trim());

        const result = await createStationAction(formData);
        if (result && result.success) {
          // Refresh sites list in context
          if (onSitesChanged) await onSitesChanged();
          // Notify parent about new station
          if (onSiteSelect) onSiteSelect(result.data);
          // Reset and close
          setCreateOpen(false);
          setStationCode(''); setStationName(''); setStationAddress(''); setStationFloor(''); setStationOperator('');
          setCreateError(null);
        } else {
          setCreateError(result?.error || '新增場域失敗');
        }
      } catch (err) {
        console.error('handleCreateStation error', err);
        setCreateError(err?.message || '新增場域發生錯誤');
      }
    });
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
          <Box sx={{ marginLeft: 'auto' }}>
            <Button size="small" variant="contained" onClick={() => setCreateOpen(true)}>
              新增場域
            </Button>
          </Box>
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
      {/* 新增場域對話框 */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setCreateError(null); }}>
        <DialogTitle>新增場域</DialogTitle>
        <Box sx={{ p: 2, minWidth: 420 }}>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Stack spacing={2}>
            <TextField label="場域代碼 (station_code) *" value={stationCode} onChange={(e) => setStationCode(e.target.value)} fullWidth />
            <TextField label="名稱 (name)" value={stationName} onChange={(e) => setStationName(e.target.value)} fullWidth />
            <TextField label="地址 (address)" value={stationAddress} onChange={(e) => setStationAddress(e.target.value)} fullWidth />
            <TextField label="樓層 (floor)" value={stationFloor} onChange={(e) => setStationFloor(e.target.value)} fullWidth />
            <TextField label="負責人/單位 (operator_id)" value={stationOperator} onChange={(e) => setStationOperator(e.target.value)} fullWidth />
          </Stack>
        </Box>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setCreateError(null); }} variant="outlined">取消</Button>
          <Button onClick={handleCreateStation} variant="contained" disabled={isPending}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : '確定新增'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
