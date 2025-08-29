"use client";
import React from 'react';
import { Box, Stack } from '@mui/material';
import {
  ChargingStatusCard,
  RealTimePowerCard,
  ErrorMonitorCard,
  CPListCard
} from '@/components/cards';

export default function Dashboard() {
  return (
    <Box sx={{ p: 2, pb: 8 }}> {/* 添加底部邊距為固定定位的 DisclaimerFooter 留出空間 */}
      {/* 充電樁狀態區塊 */}
      <Box sx={{ mb: 2 }}>
        <ChargingStatusCard />
      </Box>
      
      {/* 即時功率監控 + 即時異常監控區塊 */}
      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
          {/* 左側即時功率監控 */}
          <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex' }}>
            <RealTimePowerCard />
          </Box>
          {/* 右側即時異常監控 */}
          <Box sx={{ width: { xs: '100%', md: '50%' }, display: 'flex' }}>
            <ErrorMonitorCard />
          </Box>
        </Stack>
      </Box>
      
      {/* CP列表區塊 */}
      <Box sx={{ mb: 2 }}>
        <CPListCard />
      </Box>
    </Box>
  );
}
