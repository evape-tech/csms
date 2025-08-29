"use client";
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import EvStationIcon from '@mui/icons-material/EvStation';
import AnimatedNumber from '../common/AnimatedNumber';

// 模擬 CP 列表數據
const cpList = [
  { id: 'CP-01', connector: 'Connector-1', power: 7.2, current: 32 },
  { id: 'CP-01', connector: 'Connector-2', power: 0, current: 0 },
  { id: 'CP-02', connector: 'Connector-1', power: 0, current: 0 },
  { id: 'CP-02', connector: 'Connector-2', power: 3.5, current: 15 },
  { id: 'CP-03', connector: 'Connector-1', power: 0, current: 0 },
  { id: 'CP-03', connector: 'Connector-2', power: 4.8, current: 22 },
  { id: 'CP-04', connector: 'Connector-1', power: 0, current: 0 },
  { id: 'CP-04', connector: 'Connector-2', power: 0, current: 0 },
];

export default function CPListCard() {
  return (
    <Card sx={{ width: '100%', height: '100%' }}>
      <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Box sx={{
            background: (theme) => theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.1)' : 'primary.main',
            borderRadius: '50%',
            p: 1,
            mr: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <EvStationIcon sx={{ color: 'primary.main', fontSize: '1.5rem' }} />
          </Box>
          <Typography variant="h6">充電樁狀態</Typography>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List>
            <ListItem sx={{ py: 2, px: 1 }} key="header" disablePadding>
              <ListItemIcon sx={{ minWidth: 36 }}>
                {/* 佔位，讓內容對齊 */}
                <EvStationIcon sx={{ opacity: 0 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', fontWeight: 'bold', fontSize: '1rem', color: 'text.secondary' }}>
                    <Box sx={{ flex: 1 }}>充電樁</Box>
                    <Box sx={{ flex: 1 }}>接頭</Box>
                    <Box sx={{ flex: 1 }}>功率 (kW)</Box>
                    <Box sx={{ flex: 1 }}>電流 (A)</Box>
                  </Box>
                }
              />
            </ListItem>
            <Divider />
            {cpList.map((cp, index) => (
              <ListItem key={`${cp.id}-${cp.connector}-${index}`} sx={{ py: 2, px: 1 }} divider>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <EvStationIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '1rem' }}>
                      <Box sx={{ flex: 1, fontWeight: 'bold', color: 'text.primary' }}>{cp.id}</Box>
                      <Box sx={{ flex: 1 }}>{cp.connector}</Box>
                      <Box sx={{ flex: 1 }}><AnimatedNumber value={cp.power} /></Box>
                      <Box sx={{ flex: 1 }}><AnimatedNumber value={cp.current} /></Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </CardContent>
    </Card>
  );
}
