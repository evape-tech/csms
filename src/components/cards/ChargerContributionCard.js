"use client";
import React, { useState, useEffect } from 'react';
import PowerOverviewIndicatorCard from '../common/PowerOverviewIndicatorCard';
import AnimatedNumber from '../common/AnimatedNumber';
import { Card, CardContent, Typography, Box, Paper, CircularProgress, Alert } from '@mui/material';
import { ChargerBarChartECharts } from '../charts/EChartsChargerTemplates';
import { TrendingUp, LocalFireDepartment, ElectricCar } from '@mui/icons-material';
import DimensionDatePicker from '../common/DimensionDatePicker';

// 從資料庫獲取充電交易數據
async function fetchChargingTransactions(startDate, endDate) {
  try {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,      
      status: 'COMPLETED' // 只獲取已完成的交易
    });
    
    const response = await fetch(`/api/charging-transactions?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    // 安全檢查：確保一定回傳陣列
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.transactions)) return result.transactions;
    if (Array.isArray(result?.data)) return result.data;
    console.warn("⚠️ API 回傳格式非預期：", result);
    return [];
  } catch (error) {
    console.error("❌ Failed to fetch charging transactions:", error);
    return [];
  }
}

// 分組資料
function groupChargerDataByDimension(transactions, dimension) {
  const grouped = {};
  const chargerIds = new Set();
  
  transactions.forEach(transaction => {
    const d = new Date(transaction.start_time);
    const chargerId = transaction.cpid || transaction.cpsn || 'Unknown';
    const energyConsumed = parseFloat(transaction.energy_consumed) || 0;
    
    chargerIds.add(chargerId);
    
    let key = '';
    if (dimension === '日') {
      key = d.toISOString().slice(0, 10);
    } else if (dimension === '週') {
      const year = d.getFullYear();
      const firstDay = new Date(d.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((d - firstDay) / 86400000) + 1;
      const week = Math.ceil(dayOfYear / 7);
      key = `${year}-W${week.toString().padStart(2, '0')}`;
    } else if (dimension === '月') {
      key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    } else if (dimension === '年') {
      key = `${d.getFullYear()}`;
    }
    
    if (!grouped[key]) grouped[key] = {};
    if (!grouped[key][chargerId]) grouped[key][chargerId] = 0;
    grouped[key][chargerId] += energyConsumed;
  });
  
  // 轉換為ECharts 多系列格式
  const periods = Object.keys(grouped).sort();
  const series = Array.from(chargerIds).map(id => ({
    name: id,
    data: periods.map(period => grouped[period][id] || 0)
  }));
  
  return { periods, series };
}


const ChargerContributionCard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [groupedData, setGroupedData] = useState({ periods: [], series: [] });
  
  // 預設維度為日期選擇
  const [dimension, setDimension] = React.useState('週');
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(defaultEnd);

  // 獲取數據
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const transactions = await fetchChargingTransactions(startDate, endDate);
      setRawData(transactions);
      const grouped = groupChargerDataByDimension(transactions, dimension);
      setGroupedData(grouped);
    } catch (err) {
      setError('獲取充電樁貢獻數據失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, dimension]);

  const periods = groupedData?.periods || [];
  const series = groupedData?.series || [];

  // 計算統計數據
  const totalEnergy = rawData.reduce((sum, transaction) => sum + (parseFloat(transaction.energy_consumed) || 0), 0);
  const avgCharge = rawData.length > 0 ? totalEnergy / rawData.length : 0;
  const maxCharge = rawData.length > 0 ? Math.max(...rawData.map(t => parseFloat(t.energy_consumed) || 0)) : 0;
  const totalCount = rawData.length;
  const activeCharger = new Set(rawData.map(t => t.cpid || t.cpsn)).size;

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          充電樁 每日貢獻分析
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 上層統計卡片 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <PowerOverviewIndicatorCard
              icon={<TrendingUp />}
              label="平均每次充電度數"
              value={<AnimatedNumber value={Number(avgCharge.toFixed(2))} />}
              valueUnit="kWh"
              valueColor="primary"
              iconColor="primary"
            />
            <PowerOverviewIndicatorCard
              icon={<LocalFireDepartment />}
              label="最大單次充電度數"
              value={<AnimatedNumber value={Number(maxCharge.toFixed(2))} />}
              valueUnit="kWh"
              valueColor="error"
              iconColor="error"
            />
            <PowerOverviewIndicatorCard
              icon={<ElectricCar />}
              label="總充電次數"
              value={<AnimatedNumber value={totalCount} />}
              valueUnit="次"
              valueColor="success"
              iconColor="success"
            />
            <PowerOverviewIndicatorCard
              icon={<TrendingUp />}
              label="平均活躍充電樁數"
              value={<AnimatedNumber value={activeCharger} />}
              valueUnit="台"
              valueColor="info"
              iconColor="info"
            />
          </Box>

          {/* 維度及日期選擇器 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <DimensionDatePicker
              startDate={startDate}
              endDate={endDate}
              dimension={dimension}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onDimensionChange={setDimension}
            />
          </Box>

          {/* 中層圖表區 */}
          <Box sx={{ width: '100%' }}>
            <Paper elevation={0} sx={{ width: '100%', height: '400px', p: 1.5 }}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
                  <CircularProgress size={40} />
                </Box>
              ) : (
                <ChargerBarChartECharts periods={periods} series={series} />
              )}
            </Paper>
          </Box>

        </Box>
      </CardContent>
    </Card>
  );
};

export default ChargerContributionCard;
