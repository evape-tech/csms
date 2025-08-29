"use client";
import React from 'react';
import { Box, Skeleton } from '@mui/material';

// Facebook 風格的閃光動畫
const shimmerAnimation = `
  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: calc(200px + 100%) 0;
    }
  }
`;

// 注入 CSS 動畫
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = shimmerAnimation;
  document.head.appendChild(style);
}

export function ShimmerSkeleton({ 
  width = "100%", 
  height = 200, 
  borderRadius = 8 
}) {
  return (
    <Box
      sx={{
        width,
        height,
        borderRadius: `${borderRadius}px`,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200px 100%',
        animation: 'shimmer 1.5s infinite',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
}

// 預設尺寸的骨架組件
export function ChargingShimmer() {
  return <ShimmerSkeleton height={200} />;
}

export function PowerShimmer() {
  return <ShimmerSkeleton height={300} />;
}

export function ErrorShimmer() {
  return <ShimmerSkeleton height={300} />;
}

export function CPListShimmer() {
  return <ShimmerSkeleton height={400} />;
}

// 組合的閃光骨架（如果需要更精細的控制）
export function CardShimmer({ 
  showHeader = false, 
  showContent = true, 
  height = 200 
}) {
  return (
    <Box
      sx={{
        width: "100%",
        height,
        borderRadius: 2,
        border: '1px solid #e0e0e0',
        overflow: 'hidden',
        background: '#fff',
        position: 'relative',
      }}
    >
      {/* 主要閃光效果 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.8) 50%, transparent 75%)',
          backgroundSize: '200px 100%',
          animation: 'shimmer 1.5s infinite',
          zIndex: 1,
        }}
      />
      
      {/* 底層基礎骨架 */}
      <Box sx={{ p: 2, position: 'relative', zIndex: 0 }}>
        {showHeader && (
          <Skeleton 
            variant="rectangular" 
            width="60%" 
            height={24} 
            sx={{ mb: 2, bgcolor: '#f5f5f5' }} 
          />
        )}
        {showContent && (
          <>
            <Skeleton 
              variant="rectangular" 
              width="100%" 
              height={16} 
              sx={{ mb: 1, bgcolor: '#f5f5f5' }} 
            />
            <Skeleton 
              variant="rectangular" 
              width="80%" 
              height={16} 
              sx={{ mb: 1, bgcolor: '#f5f5f5' }} 
            />
            <Skeleton 
              variant="rectangular" 
              width="65%" 
              height={16} 
              sx={{ bgcolor: '#f5f5f5' }} 
            />
          </>
        )}
      </Box>
    </Box>
  );
}

export default ShimmerSkeleton;
