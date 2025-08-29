"use client";
import dynamic from 'next/dynamic';
import { Skeleton } from '@mui/material';

// 動態載入的充電樁狀態卡片
const DynamicChargingStatusCard = dynamic(() => import('@/components/cards/ChargingStatusCard'), {
  loading: () => (
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={200} 
      animation="wave"
      sx={{ borderRadius: 1 }}
    />
  ),
  ssr: false
});

// 動態載入的即時功率監控卡片
const DynamicRealTimePowerCard = dynamic(() => import('@/components/cards/RealTimePowerCard'), {
  loading: () => (
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={300} 
      animation="wave"
      sx={{ borderRadius: 1 }}
    />
  ),
  ssr: false
});

// 動態載入的錯誤監控卡片
const DynamicErrorMonitorCard = dynamic(() => import('@/components/cards/ErrorMonitorCard'), {
  loading: () => (
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={300} 
      animation="wave"
      sx={{ borderRadius: 1 }}
    />
  ),
  ssr: false
});

// 動態載入的 CP 列表卡片
const DynamicCPListCard = dynamic(() => import('@/components/cards/CPListCard'), {
  loading: () => (
    <Skeleton 
      variant="rectangular" 
      width="100%" 
      height={400} 
      animation="wave"
      sx={{ borderRadius: 1 }}
    />
  ),
  ssr: false
});

export {
  DynamicChargingStatusCard,
  DynamicRealTimePowerCard,
  DynamicErrorMonitorCard,
  DynamicCPListCard
};
