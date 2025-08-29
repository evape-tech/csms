"use client";
import React, { useState } from 'react';
import { Box } from '@mui/material';
import { RateTableManager } from '@/components/common';
import { ElectricityRateTableCard } from '@/components/cards';

export default function PricingManagement() {
    const [selectedRateTable, setSelectedRateTable] = useState(0);

    const handleRateTableSelect = (index: number) => {
        setSelectedRateTable(index);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* 主要內容區域 */}
            <Box sx={{ display: 'flex', flex: 1, mb: 8 }}> {/* 添加底部邊距為固定定位的 DisclaimerFooter 留出空間 */}
                {/* 左側費率表管理組件 */}
                <RateTableManager 
                    selectedRateTable={selectedRateTable}
                    onRateTableSelect={handleRateTableSelect}
                />

                {/* 右側內容區域 */}
                <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
                    <ElectricityRateTableCard />
                </Box>
            </Box>

            {/* DisclaimerFooter 現在是固定定位，會自動顯示在底部 */}
        </Box>
    );
}