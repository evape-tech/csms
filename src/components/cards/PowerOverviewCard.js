"use client";
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Paper,
  Box,
} from '@mui/material';
import AnimatedNumber from '../common/AnimatedNumber';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PowerOverviewIndicatorCard from '../common/PowerOverviewIndicatorCard';
import { BarChartECharts } from '../charts/EChartsBarAreaTemplates';
import DimensionDatePicker from '../common/DimensionDatePicker';


// Mock data for demonstration
// 生成每日資料：2020/01/01 ~ 2025/01/01，每天一筆資料
function generateDailyData(start, end) {
  const data = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    // 用電量mock: 200~400 千瓦時
    data.push({
      date: current.toISOString().slice(0, 10),
      usage: Math.floor(200 + Math.random() * 200)
    });
    current.setDate(current.getDate() + 1);
  }
  return data;
}

// 分組資料
function groupDataByDimension(data, dimension) {
  const grouped = {};
  data.forEach(item => {
    const d = new Date(item.date);
    let key = '';
    if (dimension === '日') {
      key = item.date;
    } else if (dimension === '週') {
      // ISO week
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
    grouped[key] += item.usage;
  });
  return Object.entries(grouped).map(([period, usage]) => ({ period, usage }));
}

const PowerOverviewCard = () => {
  const [dimension, setDimension] = React.useState('日');
  // 預設日期範圍：去年到今年1/1
  const today = new Date();
  const lastYear = today.getFullYear() - 1;
  const defaultStart = `${lastYear}-01-01`;
  const defaultEnd = new Date(today.setDate(today.getDate() - 1)).toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(defaultEnd);

  // 根據選擇的日期範圍及維度都依照範圍產生
  const rawData = React.useMemo(() => generateDailyData(startDate, endDate), [startDate, endDate]);
  const chartData = React.useMemo(() => groupDataByDimension(rawData, dimension), [rawData, dimension]);

  // 統計數據計算
  // 平均用電量
  const avgUsage = chartData.length > 0 ? Math.round(chartData.reduce((sum, d) => sum + d.usage, 0) / chartData.length) : 0;
  // 峰值用電日/週/月/年
  const peak = chartData.reduce((max, d) => d.usage > max.usage ? d : max, chartData[0] || { usage: 0, period: '' });
  // 累計總用電量
  const totalUsage = chartData.reduce((sum, d) => sum + d.usage, 0);
  // 時間跨度：可以選擇的天數或週數或月數，依維度而定
  let duration = chartData.length;
  let durationUnit = '';
  if (dimension === '日') durationUnit = '天';
  else if (dimension === '週') durationUnit = '週';
  else if (dimension === '月') durationUnit = '月';
  else if (dimension === '年') durationUnit = '年';

  return (
    <Card sx={{ width: '100%', height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          電力用電概覽
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}>
          {/* 上層統計卡片 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <PowerOverviewIndicatorCard
              icon={<FlashOnIcon />}
              label={`平均${dimension}用電量`}
              value={<AnimatedNumber value={avgUsage} />}
              valueUnit="kWh"
              valueColor="primary"
              iconColor="primary"
            />
            <PowerOverviewIndicatorCard
              icon={<TrendingUpIcon />}
              label={`峰值用電${dimension}`}
              value={<AnimatedNumber value={peak.usage} />}
              valueUnit="kWh"
              chipLabel={peak.period}
              valueColor="error"
              iconColor="error"
            />
            <PowerOverviewIndicatorCard
              icon={<EqualizerIcon />}
              label="累計總用電量"
              value={<AnimatedNumber value={totalUsage} />}
              valueUnit="kWh"
              valueColor="success"
              iconColor="success"
            />
            <PowerOverviewIndicatorCard
              icon={<CalendarMonthIcon />}
              label={`時間跨度`}
              value={<AnimatedNumber value={duration} />}
              valueUnit={durationUnit}
              valueColor="info"
              iconColor="info"
            />
          </Box>

          {/* 下層圖表區 */}
          <Box sx={{ display: 'flex', gap: 1, flex: 1, minHeight: 0 }}>
            <Paper elevation={0} sx={{ width: '100%', height: '100%', p: 1.5, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DimensionDatePicker
                  startDate={startDate}
                  endDate={endDate}
                  dimension={dimension}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onDimensionChange={setDimension}
                />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <BarChartECharts data={chartData}/>
              </Box>
            </Paper>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default PowerOverviewCard;
