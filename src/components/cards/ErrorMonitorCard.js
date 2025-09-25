"use client";
import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import AnimatedNumber from '../common/AnimatedNumber';

export default function ErrorMonitorCard() {
  const errorData = {
    faultCount: { label: '異常樁數', value: 3, unit: '台', color: '#ff6b6b' },
    errorCountToday: { label: '異常次數', value: 7, unit: '次', color: '#feca57' },
    longestDuration: { label: '最長故障', value: 42, unit: '分鐘', color: '#48dbfb' },
    avgResolutionTime: { label: '平均修復', value: 15, unit: '分鐘', color: '#4ecdc4' },
  };

  return (
    <Card sx={{ width: '100%', height: 'auto', minHeight: '180px' }}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Box
            sx={{
              background: (theme) => theme.palette.mode === 'light' ? 'rgba(211, 47, 47, 0.1)' : 'error.main',
              borderRadius: '50%',
              p: 1,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ErrorIcon sx={{ color: 'error.main', fontSize: '1.5rem' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            故障異常監控
          </Typography>
        </Box>
        <Box display="flex" flexDirection="row" gap={2} justifyContent="space-between">
          {Object.entries(errorData).map(([key, item]) => (
            <Box
              key={key}
              display="flex"
              flexDirection="column"
              alignItems="center"
              textAlign="center"
              sx={{ flex: 1 }}
            >
              <Typography
                variant="body2"
                sx={{ mb: 1, fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' }}
              >
                {item.label}
              </Typography>
              <Box display="flex" alignItems="baseline" justifyContent="center">
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.2, color: item.color }}
                >
                  <AnimatedNumber value={item.value} />
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ ml: 0.5, fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' }}
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
