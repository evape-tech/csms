"use client";
import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AnimatedNumber from '../common/AnimatedNumber';

export default function RealTimePowerCard() {
  // 組件內部建立假資料
  const data = {
    currentPower: {
      label: '今日即時功率',
      value: 24.5,
      unit: 'kW'
    },
    todayConsumption: {
      label: '今日用電量',
      value: 156.8,
      unit: 'kWh'
    },
    todayRevenue: {
      label: '今日營收',
      value: 892,
      unit: '元'
    },
    peakPower: {
      label: '今日峰值功率',
      value: 32.1,
      unit: 'kW'
    }
  };

  return (
    <Card sx={{ 
      width: '100%', 
      height: 'auto'
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Box sx={{ 
            background: (theme) => theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.1)' : 'primary.main', 
            borderRadius: '50%', 
            p: 1, 
            mr: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FlashOnIcon sx={{ color: 'primary.main', fontSize: '1.5rem' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            即時用電監控
          </Typography>
        </Box>
        <Box display="flex" flexDirection="row" gap={3} justifyContent="space-between">
          {Object.entries(data).map(([key, item]) => (
            <Box key={key} display="flex" flexDirection="column" alignItems="center" textAlign="center" sx={{ flex: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 1, 
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                {item.label}
              </Typography>
              <Box display="flex" alignItems="baseline" justifyContent="center">
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    fontSize: '1.75rem',
                    lineHeight: 1.2
                  }}
                >
                <AnimatedNumber value={item.value} />
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    ml: 0.5, 
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  {item.unit}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
