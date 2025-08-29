"use client";
import React from 'react';
import PowerOverviewIndicatorCard from '../common/PowerOverviewIndicatorCard';
import AnimatedNumber from '../common/AnimatedNumber';
import { Card, CardContent, Typography, Box, Paper } from '@mui/material';
import { ChargerBarChartECharts } from '../charts/EChartsChargerTemplates';
import { TrendingUp, LocalFireDepartment, ElectricCar } from '@mui/icons-material';
import DimensionDatePicker from '../common/DimensionDatePicker';

// 充電樁mock 資料產生
const chargerIds = ['CP-001','CP-002','CP-003','CP-004','CP-005','CP-006','CP-007','CP-008'];
function generateChargerData(start, end) {
  const data = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    chargerIds.forEach(id => {
      data.push({
        charger: id,
        date: current.toISOString().slice(0, 10),
        usage: Math.floor(100 + Math.random() * 100)
      });
    });
    current.setDate(current.getDate() + 1);
  }
  return data;
}

// 分組資料
function groupChargerDataByDimension(data, dimension) {
  // period: 時間週期分組
  const grouped = {};
  data.forEach(item => {
    const d = new Date(item.date);
    let key = '';
    if (dimension === '日') {
      key = item.date;
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
    if (!grouped[key][item.charger]) grouped[key][item.charger] = 0;
    grouped[key][item.charger] += item.usage;
  });
  // 轉換為ECharts 多系列格式
  const periods = Object.keys(grouped);
  const series = chargerIds.map(id => ({
    name: id,
    data: periods.map(period => grouped[period][id] || 0)
  }));
  return { periods, series };
}


const ChargerContributionCard = () => {
  // 預設維度為日期選擇
  const [dimension, setDimension] = React.useState('日');
  const today = new Date();
  const lastYear = today.getFullYear() - 1;
  const defaultStart = `${lastYear}-01-01`;
  const defaultEnd = new Date(today.setDate(today.getDate() - 1)).toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(defaultEnd);

  // 產生 mock 資料
  const rawData = React.useMemo(() => generateChargerData(startDate, endDate), [startDate, endDate]);
  const groupedData = React.useMemo(() => groupChargerDataByDimension(rawData, dimension), [rawData, dimension]);
  const periods = groupedData?.periods || [];
  const series = groupedData?.series || [];


  // 統計 mock
  const avgCharge = 32.5;
  const maxCharge = 85.6;
  const totalCount = 1247;
  const activeCharger = 8;

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          充電樁 每日貢獻分析
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 上層統計卡片 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <PowerOverviewIndicatorCard
              icon={<TrendingUp />}
              label="平均每次充電度數"
              value={<AnimatedNumber value={avgCharge} />}
              valueUnit="kWh"
              valueColor="primary"
              iconColor="primary"
            />
            <PowerOverviewIndicatorCard
              icon={<LocalFireDepartment />}
              label="最大單次充電度數"
              value={<AnimatedNumber value={maxCharge} />}
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
              {/* X軸為 period，數據為充電樁別 */}
              <ChargerBarChartECharts periods={periods} series={series} />
            </Paper>
          </Box>

        </Box>
      </CardContent>
    </Card>
  );
};

export default ChargerContributionCard;
