'use client';
import React from 'react';
import Box from '@mui/material/Box';
import {
  PowerOverviewCard,
  ChargerContributionCard,
  UsagePatternCard,
  RevenueStatisticsCard
} from '@/components/cards';

export default function PowerQuery() {
  return (
    <Box sx={{ p: 2, pb: 8 }}> {/* 添加底部邊距為固定定位的 DisclaimerFooter 留出空間 */}
      {/* 用電概況卡片 */}
      <Box sx={{ mb: 2 }}>
        <PowerOverviewCard />
      </Box>

      {/* 每樁貢獻分析卡片 */}
      <Box sx={{ mb: 2 }}>
        <ChargerContributionCard />
      </Box>

      {/* 使用習慣分析卡片 */}
      <Box sx={{ mb: 2 }}>
        <UsagePatternCard />
      </Box>

      {/* 營收統計卡片 */}
      <Box sx={{ mb: 2 }}>
        <RevenueStatisticsCard />
      </Box>  
    </Box>
  );
} 