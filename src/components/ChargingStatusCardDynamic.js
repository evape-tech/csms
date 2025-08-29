"use client";
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@mui/material';

// 動態載入實際的組件
const ChargingStatusCardImpl = dynamic(() => import('./ChargingStatusCardImpl'), {
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

// 這是對外暴露的組件，內部使用動態載入
export default function ChargingStatusCard(props) {
  return (
    <Suspense fallback={
      <Skeleton 
        variant="rectangular" 
        width="100%" 
        height={200} 
        animation="wave"
        sx={{ borderRadius: 1 }}
      />
    }>
      <ChargingStatusCardImpl {...props} />
    </Suspense>
  );
}
