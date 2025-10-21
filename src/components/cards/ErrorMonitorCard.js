"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress, Alert } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import AnimatedNumber from '../common/AnimatedNumber';

export default function ErrorMonitorCard({ guns = [], faultReports = [] }) {
  const [errorData, setErrorData] = useState({
    faultCount: { label: '異常樁數', value: 0, unit: '台', color: '#ff6b6b' },
    errorCountToday: { label: '已申請維修', value: 0, unit: '台', color: '#feca57' },
    longestDuration: { label: '未連線', value: 0, unit: '台', color: '#48dbfb' },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 計算錯誤統計數據
  useEffect(() => {
    const calculateErrorStats = () => {
      try {
        setLoading(true);
        setError(null);

        // 1. 計算異常樁數 (guns_status 包含 fault, error, fail 等關鍵字)
        const faultedGuns = guns.filter(gun => {
          const status = (gun.guns_status || '').toLowerCase();
          return status.includes('fault') || status.includes('error') || status.includes('fail') || status.includes('offline') || status.includes('unavailable') || status.includes('unavail');
        });

        // 2. 計算已申請維修 (fault_reports 中狀態為 open, pending, in_progress 的)
        const openFaultReports = faultReports.filter(report => {
          const status = (report.status || '').toLowerCase();
          return status === 'open' || status === 'pending' || status === 'in_progress' || status === 'new';
        });

        // 3. 計算未連線樁數 (guns_status 包含 offline, unavailable, unavail 等關鍵字)
        const offlineGuns = guns.filter(gun => {
          const status = (gun.guns_status || '').toLowerCase();
          return status.includes('offline') || status.includes('unavailable') || status.includes('unavail');
        });

        setErrorData({
          faultCount: { 
            label: '異常樁數', 
            value: faultedGuns.length, 
            unit: '台', 
            color: '#ff6b6b' 
          },
          errorCountToday: { 
            label: '已申請維修', 
            value: openFaultReports.length, 
            unit: '台', 
            color: '#feca57' 
          },
          longestDuration: { 
            label: '未連線', 
            value: offlineGuns.length, 
            unit: '台', 
            color: '#48dbfb' 
          },
        });

        console.log('ErrorMonitorCard 統計結果:', {
          總充電樁數: guns.length,
          異常樁數: faultedGuns.length,
          已申請維修: openFaultReports.length,
          未連線: offlineGuns.length,
          異常樁詳情: faultedGuns.map(g => ({ id: g.id, cpid: g.cpid, status: g.guns_status })),
          未連線詳情: offlineGuns.map(g => ({ id: g.id, cpid: g.cpid, status: g.guns_status }))
        });

      } catch (err) {
        console.error('計算錯誤統計時發生錯誤:', err);
        setError('計算錯誤統計失敗: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    calculateErrorStats();
  }, [guns, faultReports]);

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

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={40} />
          </Box>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
