"use client";
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
} from '@mui/material';
import {
} from 'recharts';
import ReactECharts from 'echarts-for-react';
import { 
  AttachMoney, 
  TrendingUp, 
  AccountBalance, 
  MonetizationOn,
} from '@mui/icons-material';
import DimensionDatePicker from '../common/DimensionDatePicker';
import PowerOverviewIndicatorCard from '../common/PowerOverviewIndicatorCard';



const RevenueStatisticsCard = () => {
  const [startDate, setStartDate] = React.useState('2025-08-01'); // Default start date
  const [endDate, setEndDate] = React.useState('2025-08-11'); // Default end date
  const [dimension, setDimension] = React.useState('日'); // Default dimension

  const handleStartDateChange = (date) => {
    setStartDate(date);
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
  };

  const handleDimensionChange = (newDimension) => {
    setDimension(newDimension);
  };

  const calculateAverageRevenue = () => {
    // Mock calculation logic based on dimension
    switch (dimension) {
      case '日':
        return '$22,000'; // Daily average
      case '週':
        return '$154,000'; // Weekly average
      case '月':
        return '$660,000'; // Monthly average
      case '年':
        return '$7,920,000'; // Yearly average
      default:
        return '$0';
    }
  };

  const getUpdatedChartData = () => {
    const xAxis = getXAxisData();

    // Generate fallback data dynamically
    const generateData = (label) => {
      return { label, revenue: Math.floor(Math.random() * 10000) };
    };

    let rawData;
    if (dimension === '日') {
      rawData = xAxis.map((date) => generateData(date));
    } else if (dimension === '週') {
      rawData = xAxis.map((week) => generateData(week));
    } else if (dimension === '月') {
      rawData = xAxis.map((month) => generateData(month));
    } else if (dimension === '年') {
      rawData = xAxis.map((year) => generateData(year));
    }

    return rawData.map((item) => ({
      label: item.label,
      revenue: item.revenue
    }));
  };

  const getXAxisData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const xAxis = [];

    if (dimension === '日') {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        xAxis.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
      }
    } else if (dimension === '週') {
      let weekIndex = 1;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        xAxis.push(`第${weekIndex++}週`);
      }
    } else if (dimension === '月') {
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        xAxis.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
      }
    } else if (dimension === '年') {
      for (let d = new Date(start); d <= end; d.setFullYear(d.getFullYear() + 1)) {
        xAxis.push(`${d.getFullYear()}年`);
      }
    }

    return xAxis;
  };

  const updatedRevenue = calculateAverageRevenue();
  const updatedChartData = getUpdatedChartData();
  const xAxisData = getXAxisData();

  // ECharts options for monthly revenue trend
  const revenueOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const data = params && params[0] && params[0].data ? params[0].data : {};
        const label = params && params[0] && params[0].name ? params[0].name : '未知';
        const revenue = typeof data.value === 'number' ? `$${data.value.toLocaleString()}` : '未知';
        return `${label}<br/>營收: ${revenue}`;
      }
    },
    grid: { left: '2%', right: '20', top: '40', bottom: '40', containLabel: true },
    xAxis: {
      type: 'category',
      data: xAxisData, // Dynamically generated X-axis data
      name: dimension === '日' ? '日期' : dimension === '週' ? '週次' : dimension === '月' ? '月份' : '年份'
    },
    yAxis: {
      type: 'value',
      name: '營收',
      axisLabel: { formatter: value => `$${value}` }
    },
    series: [
      {
        type: 'bar',
        data: updatedChartData.map(d => ({
          value: d.revenue,
          label: d.label
        })),
        itemStyle: { color: '#8884d8' },
        barWidth: 24
      }
    ]
  };
  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          充電樁 營收統計
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 上層統計卡片 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <PowerOverviewIndicatorCard
              icon={<AttachMoney />}
              label={`${dimension}平均營收`}
              value={updatedRevenue}
              valueColor="success"
              iconColor="success"
            />
            <PowerOverviewIndicatorCard
              icon={<TrendingUp />}
              label="平均每日營收"
              value="$108.5"
              valueColor="primary"
              iconColor="primary"
            />
            <PowerOverviewIndicatorCard
              icon={<AccountBalance />}
              label="累計總營收"
              value="$108,000"
              valueColor="info"
              iconColor="info"
            />
            <PowerOverviewIndicatorCard
              icon={<MonetizationOn />}
              label="平均每度價格"
              value="$2.75"
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
            <Paper elevation={0} sx={{ width: '100%', height: '400px', p: 1.5 }}>
              <Typography variant="h6" gutterBottom>
                月度營收趨勢
              </Typography>
              <ReactECharts option={revenueOption} style={{ height: '340px', width: '100%' }} />
            </Paper>
          </Box>



        </Box>
      </CardContent>
    </Card>
  );
};

export default RevenueStatisticsCard;
