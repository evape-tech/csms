"use client";
import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Paper } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import DimensionDatePicker from '../common/DimensionDatePicker';

// Mock data for demonstration
const hourlyData = Array.from({ length: 24 }, (_, i) => {
  const hour = `${i.toString().padStart(2, '0')}:00`;
  const existing = [
    { hour: '00:00', usage: 45 }, { hour: '01:00', usage: 32 }, { hour: '02:00', usage: 28 },
    { hour: '03:00', usage: 25 }, { hour: '04:00', usage: 22 }, { hour: '05:00', usage: 35 },
    { hour: '06:00', usage: 58 }, { hour: '07:00', usage: 85 }, { hour: '08:00', usage: 120 },
    { hour: '09:00', usage: 95 }, { hour: '10:00', usage: 78 }, { hour: '11:00', usage: 88 },
    { hour: '12:00', usage: 105 }, { hour: '13:00', usage: 92 }, { hour: '14:00', usage: 85 },
    { hour: '15:00', usage: 98 }, { hour: '16:00', usage: 115 }, { hour: '17:00', usage: 135 },
    { hour: '18:00', usage: 125 }, { hour: '19:00', usage: 110 }, { hour: '20:00', usage: 95 },
    { hour: '21:00', usage: 85 }, { hour: '22:00', usage: 72 }, { hour: '23:00', usage: 58 }
  ].find(item => item.hour === hour);
  return existing || { hour, usage: 0 };
});

const UsagePatternCard = () => {
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const filterDataByDate = (data, start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    // Return the original data if the date range is invalid
    if (startDate > endDate) return data;

    return data.filter(({ hour }) => {
      const itemDate = new Date(`1970-01-01T${hour}:00`);
      return itemDate >= startDate && itemDate <= endDate;
    });
  };

  const fillHourlyData = (data) => {
    const fullHours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    return fullHours.map(hour => data.find(item => item.hour === hour) || { hour, usage: 0 });
  };

  const filteredHourlyData = filterDataByDate(hourlyData, defaultStart, defaultEnd);
  const filledHourlyData = fillHourlyData(
    filteredHourlyData.length > 0 ? filteredHourlyData : hourlyData
  );

  const [chartData, setChartData] = useState(filledHourlyData);

  const handleStartDateChange = (date) => {
    setStartDate(date);
    regenerateData(date, endDate);
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
    regenerateData(startDate, date);
  };

  const regenerateData = (start, end) => {
    const filteredData = filterDataByDate(hourlyData, start, end);
    const updatedData = fillHourlyData(
      filteredData.length > 0
        ? filteredData.map(item => {
            // Dynamically regenerate usage based on some logic (e.g., random or calculated values)
            return { ...item, usage: Math.floor(Math.random() * 150) }; // Example: random usage between 0 and 150
          })
        : hourlyData.map(item => ({ ...item, usage: Math.floor(Math.random() * 100) })) // Generate random usage for empty data
    );
    setChartData(updatedData);
  };

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          充電 使用習慣分析
        </Typography>
        
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
                      .map(item => `<b>${item.axisValueLabel}</b><br/>平均用電量: <b>${item.data} kWh</b>`)
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
          </Paper>
        </Box>
      </CardContent>
    </Card>
  );
};

export default UsagePatternCard;
