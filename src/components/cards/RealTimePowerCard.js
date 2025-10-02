"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AnimatedNumber from '../common/AnimatedNumber';
import { getRealTimeMonitoringData } from '../../actions/dashboardActions';

export default function RealTimePowerCard() {
  const [data, setData] = useState({
    activeChargingCount: {
      label: '正在充電數',
      value: 0,
      unit: 'count'
    },
    todayConsumption: {
      label: '今日用電量',
      value: 0,
      unit: 'kWh'
    },
    todayRevenue: {
      label: '今日營收',
      value: 0,
      unit: '元'
    },
    peakPower: {
      label: '峰值功率',
      value: 0,
      unit: 'kW'
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 獲取即時監控數據
  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await getRealTimeMonitoringData();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        console.error('獲取即時監控數據失敗:', result.error);
        setError(result.error);
        // 使用默認數據作為 fallback
        setData(result.data);
      }
    } catch (err) {
      console.error('獲取即時監控數據異常:', err);
      setError(err.message || '未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  // 初始化時獲取數據
  useEffect(() => {
    fetchData();
    
    // 設定定時刷新（每30秒）
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

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
                {loading ? (
                  <Skeleton variant="text" width={60} height={40} />
                ) : (
                  <>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 700,
                        fontSize: '1.75rem',
                        lineHeight: 1.2,
                        color: error ? 'text.secondary' : 'text.primary'
                      }}
                    >
                      <AnimatedNumber value={item.value} />
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        ml: 0.5, 
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: error ? 'text.secondary' : 'text.primary'
                      }}
                    >
                      {item.unit}
                    </Typography>
                  </>
                )}
              </Box>
              {error && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'error.main',
                    fontSize: '0.6rem',
                    mt: 0.5
                  }}
                >
                  無資料
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
