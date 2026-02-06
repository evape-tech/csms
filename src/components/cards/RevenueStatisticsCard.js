"use client";
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { 
  AttachMoney, 
  TrendingUp, 
  AccountBalance, 
  MonetizationOn,
} from '@mui/icons-material';
import DimensionDatePicker from '../common/DimensionDatePicker';
import PowerOverviewIndicatorCard from '../common/PowerOverviewIndicatorCard';



// 從資料庫獲取帳單記錄數據
async function fetchBillingRecords(startDate, endDate, selectedGuns = null) {
  try {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      status: 'CALCULATED' // 只獲取已計算的交易
    });
    
    const response = await fetch(`/api/billing/user-records?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    // 安全檢查：確保一定回傳陣列
    let records = [];
    if (Array.isArray(result)) records = result;
    else if (Array.isArray(result.transactions)) records = result.transactions;
    else if (Array.isArray(result?.data)) records = result.data;
    else {
      console.warn("⚠️ API 回傳格式非預期：", result);
      return [];
    }

    // 如果指定了 selectedGuns，過濾出對應充電樁的記錄
    if (selectedGuns && Array.isArray(selectedGuns) && selectedGuns.length > 0) {
      records = records.filter(record => {
        const cpid = record.cpid || '';
        const cpsn = record.cpsn || '';
        return selectedGuns.includes(cpid) || selectedGuns.includes(cpsn);
      });
    }

    return records;
  } catch (error) {
    console.error("❌ Failed to fetch billing records:", error);
    return [];
  }
}

// 分組營收數據
function groupRevenueByDimension(billingRecords, dimension) {
  const grouped = {};
  
  billingRecords.forEach(record => {
    const d = new Date(record.start_time);
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
    
    if (!grouped[key]) grouped[key] = 0;
    grouped[key] += parseFloat(record.total_amount) || 0;
  });
  
  return Object.entries(grouped)
    .map(([period, revenue]) => ({ period, revenue }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

const RevenueStatisticsCard = ({ selectedGuns = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [chartData, setChartData] = useState([]);
  
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(defaultEnd);
  const [dimension, setDimension] = React.useState('日');

  // 獲取數據
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const billingRecords = await fetchBillingRecords(startDate, endDate, selectedGuns);
      setRawData(billingRecords);
      const grouped = groupRevenueByDimension(billingRecords, dimension);
      setChartData(grouped);
    } catch (err) {
      setError('獲取營收數據失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, dimension, selectedGuns]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 200);
    return () => clearTimeout(timer);
  }, [chartData]);

  const handleStartDateChange = (date) => {
    setStartDate(date);
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
  };

  const handleDimensionChange = (newDimension) => {
    setDimension(newDimension);
  };

  // 計算統計數據
  const totalRevenue = rawData.reduce((sum, record) => sum + (parseFloat(record.total_amount) || 0), 0);
  const avgRevenue = chartData.length > 0 ? totalRevenue / chartData.length : 0;
  const avgDailyRevenue = totalRevenue / Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
  const avgPricePerKwh = rawData.length > 0 ? totalRevenue / Math.max(1, rawData.reduce((sum, record) => sum + (parseFloat(record.energy_consumed) || 0), 0)) : 0;

  const xAxisData = chartData.map(item => item.period);

  // ECharts options for monthly revenue trend
 const revenueOption = {
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params) => {
      if (!params?.length) return '';
      const { name, value } = params[0];
      return `${name}<br/>營收：$${value.toLocaleString()}`;
    },
  },
  grid: { left: '2%', right: '3%', top: '40', bottom: '40', containLabel: true },
  xAxis: {
    type: 'category',
    data: chartData.map((item) => item.period),
    name:
      dimension === '日'
        ? '日期'
        : dimension === '週'
        ? '週次'
        : dimension === '月'
        ? '月份'
        : '年份',
  },
  yAxis: {
    type: 'value',
    name: '營收',
    axisLabel: { formatter: (value) => `$${value}` },
  },
  series: [
    {
      name: '營收',
      type: 'bar',
      data: chartData.map((d) => d.revenue),
      itemStyle: { color: '#8884d8' },
      barWidth: 24,
    },
  ],
};
  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          營收統計
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
              icon={<AttachMoney />}
              label={`${dimension}平均營收`}
              value={`$${avgRevenue.toFixed(0)}`}
              valueColor="success"
              iconColor="success"
            />
            <PowerOverviewIndicatorCard
              icon={<TrendingUp />}
              label="平均每日營收"
              value={`$${avgDailyRevenue.toFixed(0)}`}
              valueColor="primary"
              iconColor="primary"
            />
            <PowerOverviewIndicatorCard
              icon={<AccountBalance />}
              label="累計總營收"
              value={`$${totalRevenue.toFixed(0)}`}
              valueColor="info"
              iconColor="info"
            />
            <PowerOverviewIndicatorCard
              icon={<MonetizationOn />}
              label="平均每度價格"
              value={`$${avgPricePerKwh.toFixed(2)}`}
              valueColor="warning"
              iconColor="warning"
            />
          </Box>

          {/* 篩選條件區 */}
          <Box sx={{ mb: 2 }}>
            <DimensionDatePicker
              startDate={startDate}
              endDate={endDate}
              dimension={dimension}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
              onDimensionChange={handleDimensionChange}
              showDimension={true} // Show time dimension
            />
          </Box>

          {/* 中層圖表區 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Paper elevation={0} sx={{ width: '100%', height: '400px', p: 1.5, overflow: 'hidden' }}>
              <Typography variant="h6" gutterBottom>
                營收趨勢
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '340px' }}>
                  <CircularProgress size={40} />
                </Box>
              ) : (
                <ReactECharts
                  option={revenueOption}
                  style={{ width: '100%', height: '340px' }}
                  notMerge={true}
                  lazyUpdate={true}
                  opts={{ renderer: 'canvas' }}
                />
              )}
            </Paper>
          </Box>

        </Box>
      </CardContent>
    </Card>
  );
};

export default RevenueStatisticsCard;
