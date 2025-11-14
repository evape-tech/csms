"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Paper, CircularProgress, Alert } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import DimensionDatePicker from '../common/DimensionDatePicker';

// 從資料庫獲取充電交易數據
async function fetchChargingTransactions(startDate, endDate, selectedGuns = null) {
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
    let transactions = [];
    if (Array.isArray(result)) transactions = result;
    else if (Array.isArray(result.transactions)) transactions = result.transactions;
    else if (Array.isArray(result?.data)) transactions = result.data;
    else {
      console.warn("⚠️ API 回傳格式非預期：", result);
      return [];
    }

    // 如果指定了 selectedGuns，過濾出對應充電樁的交易
    if (selectedGuns && Array.isArray(selectedGuns) && selectedGuns.length > 0) {
      transactions = transactions.filter(tx => {
        const cpid = tx.cpid || '';
        const cpsn = tx.cpsn || '';
        return selectedGuns.includes(cpid) || selectedGuns.includes(cpsn);
      });
    }

    return transactions;
  } catch (error) {
    console.error("❌ Failed to fetch charging transactions:", error);
    return [];
  }
}

// 計算24小時使用模式
function calculateHourlyUsage(transactions) {
  const hourlyUsage = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    usage: 0
  }));

  transactions.forEach(transaction => {
    const startTime = new Date(transaction.start_time);
    const endTime = new Date(transaction.end_time);
    const energyConsumed = parseFloat(transaction.energy_consumed) || 0;
    
    // 計算充電持續時間（小時）
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);
    
    if (durationHours > 0) {
      // 將用電量按小時分配
      const hourlyRate = energyConsumed / durationHours;
      
      // 計算充電跨越的小時數
      const startHour = startTime.getHours();
      const endHour = endTime.getHours();
      
      if (startHour === endHour) {
        // 在同一小時內完成
        hourlyUsage[startHour].usage += energyConsumed;
      } else {
        // 跨越多個小時
        let currentTime = new Date(startTime);
        let remainingEnergy = energyConsumed;
        
        while (currentTime < endTime && remainingEnergy > 0) {
          const currentHour = currentTime.getHours();
          const nextHour = new Date(currentTime);
          nextHour.setHours(currentHour + 1, 0, 0, 0);
          
          const segmentEnd = nextHour < endTime ? nextHour : endTime;
          const segmentDuration = (segmentEnd - currentTime) / (1000 * 60 * 60);
          const segmentEnergy = Math.min(remainingEnergy, hourlyRate * segmentDuration);
          
          hourlyUsage[currentHour].usage += segmentEnergy;
          remainingEnergy -= segmentEnergy;
          currentTime = nextHour;
        }
      }
    }
  });

  return hourlyUsage;
}

const UsagePatternCard = ({ selectedGuns = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // 獲取數據
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const transactions = await fetchChargingTransactions(startDate, endDate, selectedGuns);
      const hourlyData = calculateHourlyUsage(transactions);
      setChartData(hourlyData);
    } catch (err) {
      setError('獲取使用模式數據失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedGuns]);

  const handleStartDateChange = (date) => {
    setStartDate(date);
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
  };

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          充電 使用習慣分析
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 篩選條件區 */}
          <Box sx={{ mb: 2 }}>
            <DimensionDatePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
              showDimension={false} // 不顯示時間維度
            />
          </Box>

          {/* 24小時用電量平均分布圖表 */}
          <Paper elevation={0} sx={{ height: '400px', p: 1.5 }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
                <CircularProgress size={40} />
              </Box>
            ) : (
              <ReactECharts
                option={{
                  grid: {
                    left: '1%',
                    right: '1%',
                    bottom: '2%',
                    containLabel: true
                  },
                  title: {
                    text: '24小時用電量平均分布',
                  },
                  tooltip: {
                    trigger: 'axis',
                    formatter: (params) => {
                      return params
                        .map(item => `<b>${item.axisValueLabel}</b><br/>平均用電量: <b>${item.data.toFixed(2)} kWh</b>`)
                        .join('<br/><br/>');
                    },
                  },
                  xAxis: {
                    type: 'category',
                    data: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`), // Always show 24 hours
                  },
                  yAxis: {
                    type: 'value',
                    name: '用電量(kWh)',
                    nameLocation: 'middle',
                    nameGap: 30,
                  },
                  series: [
                    {
                      data: chartData.map((item) => item.usage), // Dynamically update Y-axis based on filtered data
                      type: 'bar',
                      color: '#8884d8',
                    },
                  ],
                }}
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </Paper>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UsagePatternCard;
