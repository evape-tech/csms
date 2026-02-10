'use client';
import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import {
  PowerOverviewCard,
  ChargerContributionCard,
  UsagePatternCard,
  RevenueStatisticsCard
} from '@/components/cards';
import { useSiteId } from '@/stores/siteStore';

// 獲取電表列表
async function fetchMeters(stationId?: number | null) {
  try {
    const params = new URLSearchParams();
    if (stationId) params.set('station_id', String(stationId));
    const response = await fetch(`/api/meters${params.toString() ? '?' + params.toString() : ''}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('❌ Failed to fetch meters:', error);
    return [];
  }
}

// 獲取場域、電表和充電樁的關聯關係
async function fetchStations(stationId?: number | null) {
  try {
    const params = new URLSearchParams();
    if (stationId) params.set('station_id', String(stationId));
    const response = await fetch(`/api/stations${params.toString() ? '?' + params.toString() : ''}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const stations = await response.json();
    return Array.isArray(stations) ? stations : [];
  } catch (error) {
    console.error('❌ Failed to fetch stations:', error);
    return [];
  }
}

// 建立電表與充電樁的映射關係
function buildMeterGunMap(stations: any[]) {
  const meterGunMap = new Map(); // meter_no -> [cpid, cpsn, ...]
  
  stations.forEach((station: any) => {
    if (!station.meters || !Array.isArray(station.meters)) return;
    
    station.meters.forEach((meter: any) => {
      const meterNo = meter.meter_no;
      const guns = meter.guns || [];
      const cpids = guns.map((gun: any) => gun.cpid).filter(Boolean);
      const cpsns = guns.map((gun: any) => gun.cpsn).filter(Boolean);
      
      meterGunMap.set(meterNo, {
        meterId: meter.id,
        meterNo: meterNo,
        cpids: cpids,
        cpsns: cpsns,
        allIdentifiers: [...cpids, ...cpsns].filter(Boolean)
      });
    });
  });
  
  return meterGunMap;
}

export default function PowerQuery() {
  const siteId = useSiteId();
  const [selectedMeter, setSelectedMeter] = useState('全部');
  const [meters, setMeters] = useState<string[]>([]);
  const [meterGunMap, setMeterGunMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  // 初始化：獲取電表列表和關聯關係（當場域切換時重新載入）
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const [meterList, stations] = await Promise.all([
          fetchMeters(siteId),
          fetchStations(siteId)
        ]);
        
        setMeters(meterList);
        const map = buildMeterGunMap(stations);
        setMeterGunMap(map);
        setSelectedMeter('全部');
      } catch (error) {
        console.error('初始化失敗:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initialize();
  }, [siteId]);

  // 根據選中的電表獲取對應的充電樁識別碼
  const getSelectedMeterGuns = () => {
    if (selectedMeter === '全部') {
      return null; // null 表示不過濾，顯示全部
    }
    
    const meterInfo = meterGunMap.get(selectedMeter);
    return meterInfo ? meterInfo.allIdentifiers : [];
  };

  const selectedGuns = getSelectedMeterGuns();

  return (
    <Box sx={{ p: 2, pb: 8 }}>
      {/* 電表選擇下拉選單 */}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth sx={{ maxWidth: 300 }}>
          <InputLabel id="meter-select-label">電表選擇</InputLabel>
          <Select
            labelId="meter-select-label"
            id="meter-select"
            value={selectedMeter}
            label="電表選擇"
            onChange={(e) => setSelectedMeter(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="全部">全部</MenuItem>
            {meters.map((meterNo) => (
              <MenuItem key={meterNo} value={meterNo}>
                {meterNo}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* 用電概況卡片 */}
      <Box sx={{ mb: 2 }}>
        <PowerOverviewCard selectedGuns={selectedGuns} />
      </Box>

      {/* 每樁貢獻分析卡片 */}
      <Box sx={{ mb: 2 }}>
        <ChargerContributionCard selectedGuns={selectedGuns} />
      </Box>

      {/* 使用習慣分析卡片 */}
      <Box sx={{ mb: 2 }}>
        <UsagePatternCard selectedGuns={selectedGuns} />
      </Box>

      {/* 營收統計卡片 */}
      <Box sx={{ mb: 2 }}>
        <RevenueStatisticsCard selectedGuns={selectedGuns} />
      </Box>  
    </Box>
  );
} 