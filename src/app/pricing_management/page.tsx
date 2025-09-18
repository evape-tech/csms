"use client";
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { RateTableManager } from '@/components/common';
import { TariffDetailCard } from '@/components/cards';
import { getTariffs } from '@/actions/tariffActions';

export default function PricingManagement() {
    const [selectedRateTable, setSelectedRateTable] = useState(0);
    const [tariffs, setTariffs] = useState([]);
    const [loading, setLoading] = useState(true);

    // 載入費率資料
    useEffect(() => {
        const loadTariffs = async () => {
            try {
                setLoading(true);
                const result = await getTariffs();
                if (result.success) {
                    setTariffs(result.data);
                }
            } catch (err) {
                console.error('Error loading tariffs:', err);
            } finally {
                setLoading(false);
            }
        };

        loadTariffs();
    }, []);

    const handleRateTableSelect = (index: number) => {
        setSelectedRateTable(index);
    };

    // 當 tariffs 更新時，選擇第一個作為預設
    useEffect(() => {
        if (tariffs.length > 0 && selectedRateTable >= tariffs.length) {
            setSelectedRateTable(0);
        }
    }, [tariffs, selectedRateTable]);

    const selectedTariff = tariffs[selectedRateTable] || null;

    return (
        <Box sx={{ 
            display: 'flex', 
            height: '100vh', // 使用固定視窗高度
            overflow: 'hidden' // 防止整個頁面滾動
        }}>
            {/* 左側費率表管理組件 */}
            <RateTableManager 
                selectedRateTable={selectedRateTable}
                onRateTableSelect={handleRateTableSelect}
            />

            {/* 右側內容區域 */}
            <Box sx={{ 
                flex: 1, 
                height: '100vh', // 固定高度
                overflow: 'hidden', // 防止這層滾動
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Box sx={{ 
                    flex: 1, 
                    p: 3, 
                    overflow: 'auto', // 只有內容區域可以滾動
                    height: 0 // 強制 flex 子元素計算高度
                }}>
                    <TariffDetailCard 
                        tariff={selectedTariff}
                        loading={loading}
                    />
                </Box>
            </Box>
        </Box>
    );
}