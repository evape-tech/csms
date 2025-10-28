"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  Typography,
  Paper,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import AnimatedNumber from "../common/AnimatedNumber";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EqualizerIcon from "@mui/icons-material/Equalizer";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PowerOverviewIndicatorCard from "../common/PowerOverviewIndicatorCard";
import { BarChartECharts } from "../charts/EChartsBarAreaTemplates";
import DimensionDatePicker from "../common/DimensionDatePicker";


// ============================================================
// ✅ 從 API 抓取資料（保證回傳陣列，永不為 undefined）
// ============================================================
async function fetchChargingTransactions(startDate, endDate) {
  try {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      status: "COMPLETED",
    });

    const response = await fetch(`/api/charging-transactions?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const result = await response.json();

    // 安全檢查：確保一定回傳陣列
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.transactions)) return result.transactions;
    console.log("🚀 [fetchChargingTransactions] API 回傳:", result);
    if (Array.isArray(result?.data)) return result.data;
    console.warn("⚠️ API 回傳格式非預期：", result);
    return [];
  } catch (error) {
    console.error("❌ Failed to fetch charging transactions:", error);
    return [];
  }
}


// ============================================================
// ✅ 資料分組邏輯（已加防呆）
// ============================================================
function groupDataByDimension(data, dimension) {
  if (!Array.isArray(data)) {
    console.warn("⚠️ groupDataByDimension: data 不是陣列", data);
    console.log("🧾 原始資料 sample:", data.slice(0, 3));
    return [];
  }

  const grouped = {};

  data.forEach((item) => {
    if (!item || !item.start_time) return;

    const d = new Date(item.start_time);
    if (isNaN(d)) return;

    let key = "";
    switch (dimension) {
      case "日":
        key = d.toISOString().slice(0, 10);
        break;
      case "週": {
        const year = d.getFullYear();
        const firstDay = new Date(year, 0, 1);
        const dayOfYear = Math.floor((d - firstDay) / 86400000) + 1;
        const week = Math.ceil(dayOfYear / 7);
        key = `${year}-W${String(week).padStart(2, "0")}`;
        break;
      }
      case "月":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "年":
        key = `${d.getFullYear()}`;
        break;
      default:
        key = "未知";
    }

    grouped[key] = (grouped[key] || 0) + (parseFloat(item.energy_consumed) || 0);
  });

  // 轉成陣列並排序
  const groupedArray = Object.entries(grouped).map(([period, usage]) => ({ period, usage }));

  groupedArray.sort((a, b) => {
    if (dimension === "週") {
      // 處理週格式 "YYYY-Www"
      const [yearA, weekA] = a.period.split("-W").map(Number);
      const [yearB, weekB] = b.period.split("-W").map(Number);
      return yearA !== yearB ? yearA - yearB : weekA - weekB;
    } else if (dimension === "月") {
      const [yearA, monthA] = a.period.split("-").map(Number);
      const [yearB, monthB] = b.period.split("-").map(Number);
      return yearA !== yearB ? yearA - yearB : monthA - monthB;
    } else if (dimension === "年") {
      return Number(a.period) - Number(b.period);
    } else {
      // 預設 "日"
      return new Date(a.period) - new Date(b.period);
    }
  });

  return groupedArray;
}


// ============================================================
// ✅ 主元件
// ============================================================
const PowerOverviewCard = () => {
  const [dimension, setDimension] = useState("週");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState([]);

  // 預設日期：過去30天
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // 取得資料
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChargingTransactions(startDate, endDate);
      setRawData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("獲取用電數據失敗: " + err.message);
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  // 圖表資料處理
  const chartData = useMemo(() => {
  if (!Array.isArray(rawData)) return [];
  const grouped = groupDataByDimension(rawData, dimension);
  console.log("📅 groupDataByDimension result:", grouped); // <- 加在這裡
  return grouped;
}, [rawData, dimension]);

  // 統計數據
  const avgUsage =
    chartData.length > 0
      ? Math.round(chartData.reduce((sum, d) => sum + d.usage, 0) / chartData.length)
      : 0;

  const peak =
    chartData.reduce((max, d) => (d.usage > max.usage ? d : max), chartData[0] || { usage: 0, period: "" });

  const totalUsage = chartData.reduce((sum, d) => sum + d.usage, 0);
  const duration = chartData.length;
  const durationUnit =
    dimension === "日" ? "天" : dimension === "週" ? "週" : dimension === "月" ? "月" : "年";

  console.log("📈 chartData:", chartData);
  console.log("📊 totalUsage:", totalUsage, "avg:", avgUsage, "peak:", peak); 


  // ============================================================
  // ✅ 畫面呈現
  // ============================================================
  return (
    <Card sx={{ width: "100%", height: "100%" }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", p: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: "bold", mb: 2 }}>
          電力用電概覽
        </Typography>

        {/* 錯誤提示 */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 載入中狀態 */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={40} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0 }}>
            
            {/* 統計卡片 */}
            <Box sx={{ display: "flex", gap: 1 }}>
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
                value={<AnimatedNumber value={Number(peak.usage.toFixed(2))} />}
                valueUnit="kWh"
                chipLabel={peak.period}
                valueColor="error"
                iconColor="error"
              />
              <PowerOverviewIndicatorCard
                icon={<EqualizerIcon />}
                label="累計總用電量"
                value={<AnimatedNumber value={Math.round(totalUsage)} />}
                valueUnit="kWh"
                valueColor="success"
                iconColor="success"
              />
              <PowerOverviewIndicatorCard
                icon={<CalendarMonthIcon />}
                label="時間跨度"
                value={<AnimatedNumber value={duration} />}
                valueUnit={durationUnit}
                valueColor="info"
                iconColor="info"
              />
            </Box>

            {/* 下方圖表區域 */}
            <Box sx={{ display: "flex", gap: 1, flex: 1, minHeight: 0 }}>
              <Paper
                elevation={0}
                sx={{ width: "100%", height: "100%", p: 1.5, display: "flex", flexDirection: "column" }}
              >
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <DimensionDatePicker
                    startDate={startDate}
                    endDate={endDate}
                    dimension={dimension}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onDimensionChange={setDimension}
                  />
                </Box>

                {/* 若沒有資料顯示提示 */}
                {chartData.length === 0 ? (
                  <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: "100%", color: "text.secondary" }}>
                    目前無用電資料
                  </Box>
                ) : (
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <BarChartECharts data={chartData} />
                  </Box>
                )}
              </Paper>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default PowerOverviewCard;
