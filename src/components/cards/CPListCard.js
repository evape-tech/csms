"use client";
import React, { useMemo, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Button,
  IconButton
} from '@mui/material';
import EvStationIcon from '@mui/icons-material/EvStation';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AnimatedNumber from '../common/AnimatedNumber';

// Helper function for charging status check
const isCharging = (status) => {
  return status === 'Charging' || status === 'SuspendedEV' || status === 'SuspendedEVSE';
};

/**
 * 充電樁列表卡片組件 - 以電表為單位進行EMS分配
 * @param {Object} props
 * @param {Array} props.chargers - 扁平的充電樁數據 (向後兼容)
 * @param {Array} props.stations - 站點數據結構 (包含 meters 和 guns 的完整嵌套數據)
 */
export default function CPListCard({ chargers = [], stations = [] }) {
  // 重啟狀態管理
  const [restartingIds, setRestartingIds] = useState(new Set());
  // 電表展開/收合狀態管理
  const [expandedMeters, setExpandedMeters] = useState(new Set());

  // 重啟充電樁處理函數
  const handleRestart = async (chargerId) => {
    // 如果正在重啟中，忽略請求
    if (restartingIds.has(chargerId)) {
      return;
    }

    try {
      // 設置重啟狀態
      setRestartingIds(prev => new Set(prev).add(chargerId));

      console.log(`重啟充電樁: ${chargerId}`);

      // 模擬重啟過程 (實際實現中應該調用 API)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 顯示成功訊息
      console.log(`充電樁 ${chargerId} 重啟成功`);

      // 可以添加成功提示或狀態更新邏輯
      // alert(`充電樁 ${chargerId} 重啟成功`);

    } catch (error) {
      console.error(`重啟充電樁 ${chargerId} 失敗:`, error);
      // 可以添加錯誤處理邏輯
      // alert(`充電樁 ${chargerId} 重啟失敗`);
    } finally {
      // 移除重啟狀態
      setRestartingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(chargerId);
        return newSet;
      });
    }
  };

  // 切換電表展開狀態
  const toggleMeterExpansion = (meterId) => {
    setExpandedMeters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meterId)) {
        newSet.delete(meterId);
      } else {
        newSet.add(meterId);
      }
      return newSet;
    });
  };

  // 處理數據結構：優先使用 stations 的完整數據，必要時使用 chargers 作為補充
  const processedChargers = useMemo(() => {
    // 優先使用 stations 數據（包含完整的嵌套結構）
    if (stations.length > 0) {
      const flattenedGuns = [];
      
      stations.forEach(station => {
        station.meters?.forEach(meter => {
          meter.guns?.forEach(gun => {
            // 為每個 gun 添加完整的 meter 和 station 資訊
            flattenedGuns.push({
              ...gun,
              meter_id: meter.id,
              meter: {
                id: meter.id,
                meter_no: meter.meter_no,
                ems_mode: meter.ems_mode,
                max_power_kw: parseFloat(meter.max_power_kw) || 480,
                billing_mode: meter.billing_mode,
                station_id: meter.station_id
              },
              station: {
                id: station.id,
                station_code: station.station_code,
                name: station.name,
                address: station.address,
                floor: station.floor,
                operator_id: station.operator_id
              }
            });
          });
        });
      });
      
      console.log('使用 stations 數據結構，提取到', flattenedGuns.length, '個充電槍');
      return flattenedGuns;
    }
    
    // 如果 stations 沒有數據但有 chargers 數據，使用 chargers 作為後備
    if (chargers.length > 0) {
      console.log('使用 chargers 數據結構作為後備，共', chargers.length, '個充電槍');
      return chargers;
    }
    
    console.log('無可用數據');
    return [];
  }, [stations, chargers]);

  // 根據電表分組充電樁並計算各電表的 EMS 分配
  const meterEmsResults = useMemo(() => {
    // 首先從 stations 中獲取所有電表的列表，確保即使沒有充電樁的電表也能顯示
    const allMeters = {};
    
    if (stations.length > 0) {
      stations.forEach(station => {
        station.meters?.forEach(meter => {
          const meterId = meter.id.toString();
          if (!allMeters[meterId]) {
            allMeters[meterId] = {
              meter: {
                id: meter.id,
                meter_no: meter.meter_no,
                ems_mode: meter.ems_mode || 'static',
                max_power_kw: parseFloat(meter.max_power_kw) || 480,
                billing_mode: meter.billing_mode,
                station_id: meter.station_id
              },
              guns: [],
              station: {
                id: station.id,
                station_code: station.station_code,
                name: station.name,
                address: station.address,
                floor: station.floor,
                operator_id: station.operator_id
              }
            };
          }
        });
      });
    }
    
    // 如果沒有 stations 數據但有 processedChargers，則從充電樁數據中推斷電表信息
    if (Object.keys(allMeters).length === 0 && processedChargers && processedChargers.length > 0) {
      processedChargers.forEach(gun => {
        const meterId = (gun.meter_id || gun.meter?.id)?.toString();
        if (meterId && !allMeters[meterId]) {
          allMeters[meterId] = {
            meter: gun.meter || { 
              id: parseInt(meterId), 
              meter_no: `METER-${meterId}`,
              ems_mode: 'static',
              max_power_kw: 480 
            },
            guns: [],
            station: gun.station
          };
        }
      });
    }
    
    // 將充電樁分配到對應的電表
    if (processedChargers && processedChargers.length > 0) {
      processedChargers.forEach(gun => {
        const meterId = (gun.meter_id || gun.meter?.id)?.toString();
        if (meterId && allMeters[meterId]) {
          allMeters[meterId].guns.push(gun);
        } else {
          console.warn('充電樁沒有對應的電表:', gun);
        }
      });
    }
    
    // 對每個電表分別計算 EMS 分配
    const results = {};
    Object.entries(allMeters).forEach(([meterId, meterGroup]) => {
      try {
        // 準備電表設定數據
        const meterSetting = {
          ems_mode: meterGroup.meter.ems_mode || 'static',
          max_power_kw: meterGroup.meter.max_power_kw || 480
        };
        
        // 準備該電表下所有充電槍的數據
        const gunsForAllocation = meterGroup.guns.map((gun, index) => {
          const id = gun.cpid || gun.cpsn || `CP-${gun.id || index + 1}`;
          return {
            cpid: id,
            cpsn: gun.cpsn || id,
            connector: gun.connector || `Connector-${index % 2 + 1}`,
            acdc: gun.acdc || 'AC',
            max_kw: gun.max_kw || (gun.acdc === 'DC' ? 120 : 7), // 根據 AC/DC 類型設置默認功率
            guns_status: gun.guns_status || 'Available'
          };
        });
        
        // 獲取該電表下所有正在充電的充電樁 ID (使用與 gunsForAllocation 相同的 ID 邏輯)
        const chargingCpids = meterGroup.guns
          .filter(gun => isCharging(gun.guns_status))
          .map(gun => gun.cpid || gun.cpsn || `CP-${gun.id}`); // 使用相同的 ID 邏輯
        
        console.log(`電表 ${meterId} CPID 對應關係:`, {
          guns數據: meterGroup.guns.map(g => ({
            原始: { cpid: g.cpid, cpsn: g.cpsn, id: g.id },
            算法用ID: g.cpid || g.cpsn || `CP-${g.id}`,
            狀態: g.guns_status,
            isCharging: isCharging(g.guns_status)
          })),
          算法輸入: gunsForAllocation.map(g => ({ cpid: g.cpid, status: g.guns_status })),
          充電中的槍ID: chargingCpids
        });
        
        // 對該電表進行 EMS 分配計算（已移至 ocpp-core 微服務）
        // 注意：客戶端暫不調用遠端 API，使用本地簡化版本
        const result = {
          allocations: gunsForAllocation.map((gun, idx) => ({
            cpid: gun.cpid,
            acdc: gun.acdc,
            allocated_kw: chargingCpids.includes(gun.cpid) ? gun.max_kw : 0,
            limit: gun.max_kw,
            unit: 'kW'
          })),
          summary: {
            charging_guns: chargingCpids.length,
            total_allocated_kw: gunsForAllocation.filter(g => chargingCpids.includes(g.cpid)).reduce((s, g) => s + g.max_kw, 0),
            total_allocated_ac_kw: gunsForAllocation.filter(g => g.acdc === 'AC' && chargingCpids.includes(g.cpid)).reduce((s, g) => s + g.max_kw, 0),
            total_allocated_dc_kw: gunsForAllocation.filter(g => g.acdc === 'DC' && chargingCpids.includes(g.cpid)).reduce((s, g) => s + g.max_kw, 0),
            within_limit: true
          }
        };
        
        // 詳細記錄 EMS 計算結果
        console.log(`電表 ${meterId} (${meterGroup.meter.meter_no}) EMS 計算結果:`, {
          電表設定: meterSetting,
          充電槍數量: gunsForAllocation.length,
          充電中的槍數量: chargingCpids.length,
          充電中的槍ID: chargingCpids,
          分配結果: result?.allocations?.map(alloc => ({
            cpid: alloc.cpid,
            acdc: alloc.acdc,
            allocated_kw: alloc.allocated_kw,
            limit: alloc.limit,
            unit: alloc.unit
          })),
          總結: result?.summary ? {
            charging_guns: result.summary.charging_guns,
            total_allocated_kw: result.summary.total_allocated_kw,
            total_allocated_ac_kw: result.summary.total_allocated_ac_kw,
            total_allocated_dc_kw: result.summary.total_allocated_dc_kw,
            within_limit: result.summary.within_limit
          } : null
        });
        
        results[meterId] = {
          meter: meterGroup.meter,
          guns: meterGroup.guns,
          emsResult: result
        };
      } catch (error) {
        console.error(`電表 ${meterId} EMS 計算失敗:`, error);
        results[meterId] = {
          meter: meterGroup.meter,
          guns: meterGroup.guns,
          emsResult: null
        };
      }
    });
    
    return results;
  }, [processedChargers, stations]);

  // 同步展開狀態
  useEffect(() => {
    // 不再需要同步邏輯，因為移除了全部展開功能
  }, [expandedMeters, meterEmsResults]);
  
  // 處理充電樁數據 - 基於電表 EMS 分配結果
  const cpList = useMemo(() => {
    if (!processedChargers || processedChargers.length === 0) {
      return [];
    }
    
    // 從 guns 數據轉換為 CP 列表格式，並與對應電表的 EMS 分配結果關聯
    return processedChargers.map((gun, index) => {
      
      // 嘗試找到充電樁 ID - 優先使用 cpid，如果不存在則嘗試其他字段
      const id = gun.cpid || gun.cpsn || `CP-${gun.id || index + 1}`;
      
      // 嘗試找到連接器信息
      const connector = gun.connector || `Connector-${index % 2 + 1}`;
      
      // 查找該充電樁所屬電表的 EMS 分配結果
      let allocatedPower = 0;
      let emsAllocation = null;
      let meterInfo = null;
      
      const meterId = gun.meter_id || gun.meter?.id;
      if (meterId && meterEmsResults[meterId]) {
        const meterResult = meterEmsResults[meterId];
        meterInfo = meterResult.meter;
        
        if (meterResult.emsResult && meterResult.emsResult.allocations) {
          // 從該電表的 EMS 分配結果中找到對應該充電樁的分配
          const allocation = meterResult.emsResult.allocations.find(a => a.cpid === id);
          if (allocation) {
            emsAllocation = allocation;
            allocatedPower = allocation.allocated_kw || 0;
          }
        }
      }
      
      // 如果沒有找到 EMS 分配結果或結果為 0，使用備用邏輯
      if (allocatedPower === 0) {
        // 先嘗試從 gun 對象上直接獲取功率信息
        if (gun.power !== undefined && gun.power !== null) {
          allocatedPower = parseFloat(gun.power) || 0;
        } 
        // 再嘗試從 metervalue 獲取
        else if (gun.guns_metervalue1) {
          try {
            const powerValue = parseFloat(gun.guns_metervalue1) || 0;
            allocatedPower = powerValue;
          } catch (e) {
            console.warn(`解析功率失敗:`, e);
          }
        }
        
        // 如果仍然沒有功率值，根據充電狀態和類型設置一個默認值
        if (allocatedPower === 0) {
          const chargingStatus = isCharging(gun.guns_status);
          if (chargingStatus) {
            // 充電中的槍根據類型給一個合理的默認值
            allocatedPower = gun.acdc === 'DC' ? 50 : 7;
          } else {
            // 非充電中的槍給一個最小功率
            allocatedPower = gun.acdc === 'DC' ? 1 : 1.32; // DC最小1kW, AC最小6A≈1.32kW
          }
        }
      }
      
      // 處理狀態信息 - 參考 OCPP 標準狀態
      let status = '未知';
      let statusColor = 'default';
      
      // 記錄是否充電中，使用 emsAllocator 中的 isCharging 函數確保狀態判斷邏輯一致
      const chargingStatus = isCharging(gun.guns_status);

      if (gun.guns_status) {
        const statusLower = gun.guns_status.toLowerCase();

        // OCPP 標準狀態映射 - 注意順序：先檢查具體狀態，再檢查一般狀態
        if (statusLower.includes('unavailable') || statusLower.includes('不可用')) {
          status = '不可用';
          statusColor = 'default'; // 灰色表示不可用
        } else if (statusLower.includes('available') || statusLower.includes('可用')) {
          status = '可用';
          statusColor = 'success'; // 綠色表示可用
        } else if (statusLower.includes('preparing') || statusLower.includes('準備中')) {
          status = '準備中';
          statusColor = 'info'; // 藍色表示準備中
        } else if (chargingStatus) {
          // 使用 isCharging 函數判斷是否充電中
          status = '充電中';
          statusColor = 'primary'; // 藍色表示充電中
        } else if (statusLower.includes('suspendede') || statusLower.includes('suspendev') ||
                   statusLower.includes('暫停') || statusLower.includes('suspended')) {
          status = '充電暫停';
          statusColor = 'warning'; // 橙色表示暫停
        } else if (statusLower.includes('finishing') || statusLower.includes('結束中')) {
          status = '結束中';
          statusColor = 'secondary'; // 紫色表示結束中
        } else if (statusLower.includes('reserved') || statusLower.includes('預約')) {
          status = '已預約';
          statusColor = 'info'; // 藍色表示已預約
        } else if (statusLower.includes('faulted') || statusLower.includes('fault') ||
                   statusLower.includes('故障') || statusLower.includes('error')) {
          status = '故障';
          statusColor = 'error'; // 紅色表示故障
        } else if (statusLower.includes('offline') || statusLower.includes('離線')) {
          status = '離線';
          statusColor = 'default'; // 灰色表示離線
        } else {
          // 對於未識別的狀態，顯示原始狀態值
          status = gun.guns_status;
          statusColor = 'default'; // 灰色表示未知狀態
        }
      }
      
      return { 
        id, 
        connector, 
        power: allocatedPower, 
        status, 
        statusColor,
        emsAllocation, // 包含 EMS 分配的詳細信息
        meterInfo, // 包含電表資訊
        acdc: gun.acdc || 'AC', // 保存原始的 AC/DC 類型信息
        isCharging: chargingStatus, // 使用 emsAllocator 中的 isCharging 函數判斷的充電狀態
        meterId // 記錄電表 ID
      };
    });
  }, [processedChargers, meterEmsResults]);
  return (
    <Card sx={{ width: '100%', height: '100%' }}>
      <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Box sx={{
            background: (theme) => theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.1)' : 'primary.main',
            borderRadius: '50%',
            p: 1,
            mr: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <EvStationIcon sx={{ color: 'primary.main', fontSize: '1.5rem' }} />
          </Box>
          <Box>
            <Typography variant="h6">電表管理系統</Typography>
            {/* 顯示站點資訊 */}
            {processedChargers.length > 0 && processedChargers[0]?.station && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                📍 {processedChargers[0].station.name} - {processedChargers[0].station.address}
                {processedChargers[0].station.floor && ` ${processedChargers[0].station.floor}`}
              </Typography>
            )}
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={`${Object.keys(meterEmsResults).length} 個電表`} 
              size="small" 
              color="info"
              variant="filled"
            />
            <Chip 
              label={`${cpList.length} 個充電樁`} 
              size="small" 
              color="secondary"
              variant="filled"
            />
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {Object.keys(meterEmsResults).length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                暫無電表數據 {processedChargers.length > 0 ? `(收到 ${processedChargers.length} 條數據但無法分組)` : ''}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Object.entries(meterEmsResults).map(([meterId, meterData]) => {
                const isExpanded = expandedMeters.has(meterId);
                const meterCpList = cpList.filter(cp => cp.meterId === parseInt(meterId));
                
                return (
                  <Card 
                    key={`meter-${meterId}`} 
                    variant="outlined"
                    sx={{ 
                      borderRadius: 3,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: (theme) => theme.shadows[4],
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    {/* 電表摘要標題 - 可點擊展開/收合 */}
                    <Box 
                      sx={{ 
                        p: 2, 
                        background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.secondary.main}08 100%)`,
                        borderRadius: '12px 12px 0 0',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                        '&:hover': {
                          background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}12 0%, ${theme.palette.secondary.main}12 100%)`,
                        }
                      }}
                      onClick={() => toggleMeterExpansion(meterId)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                            📊 {meterData.meter.meter_no || `電表-${meterData.meter.id}`}
                          </Typography>
                          <Chip 
                            label={meterData.meter.ems_mode === 'dynamic' ? '動態模式' : '靜態模式'} 
                            size="small" 
                            color={meterData.meter.ems_mode === 'dynamic' ? 'primary' : 'default'}
                            variant="filled"
                          />
                          <Chip 
                            label={`${meterData.meter.max_power_kw}kW`}
                            size="small" 
                            color="secondary"
                            variant="outlined"
                          />
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {/* 電表狀態摘要 */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                            <Chip 
                              label={`${meterData.guns.length}樁`}
                              size="small" 
                              color="default"
                              variant="outlined"
                            />
                            {meterData.emsResult?.summary && (
                              <Chip 
                                label={`${meterData.emsResult.summary.total_allocated_kw.toFixed(1)}kW`} 
                                size="small" 
                                color={meterData.emsResult.summary.within_limit ? "success" : "error"}
                                variant="filled"
                              />
                            )}
                          </Box>
                          
                          {/* 展開/收合按鈕 */}
                          <IconButton 
                            size="small" 
                            sx={{ 
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.3s ease'
                            }}
                          >
                            <Typography sx={{ fontSize: '1.2rem' }}>▼</Typography>
                          </IconButton>
                        </Box>
                      </Box>
                      
                      {/* EMS 分配快速摘要 */}
                      {meterData.emsResult?.summary && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            功率分配:
                          </Typography>
                          <Chip 
                            label={`AC ${meterData.emsResult.summary.total_allocated_ac_kw.toFixed(1)}kW`} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                            sx={{ height: '20px', fontSize: '0.7rem' }}
                          />
                          <Chip 
                            label={`DC ${meterData.emsResult.summary.total_allocated_dc_kw.toFixed(1)}kW`} 
                            size="small" 
                            color="secondary"
                            variant="outlined"
                            sx={{ height: '20px', fontSize: '0.7rem' }}
                          />

                        </Box>
                      )}
                    </Box>

                    {/* 充電樁詳情 - 可摺疊 */}
                    {isExpanded && (
                      <Box sx={{ p: 0 }}>
                        {meterCpList.length === 0 ? (
                          // 電表沒有充電樁時顯示提示信息
                          <Box sx={{ p: 3, textAlign: 'center', backgroundColor: 'background.default' }}>
                            <Typography variant="body2" color="text.secondary">
                              此電表目前沒有配置充電樁
                            </Typography>
                          </Box>
                        ) : (
                          <List sx={{ py: 0 }}>
                            <ListItem sx={{ py: 1, px: 2, backgroundColor: 'background.default' }} disablePadding>
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <EvStationIcon sx={{ opacity: 0 }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', fontWeight: 'bold', fontSize: '0.9rem', color: 'text.secondary' }}>
                                    <Box sx={{ flex: 1 }}>充電樁</Box>
                                    <Box sx={{ flex: 1 }}>接頭</Box>
                                    <Box sx={{ flex: 1 }}>狀態</Box>
                                    <Box sx={{ flex: 1 }}>EMS功率 (kW)</Box>
                                    <Box sx={{ flex: 0.8, textAlign: 'center' }}>操作</Box>
                                  </Box>
                                }
                              />
                            </ListItem>
                            <Divider />
                            
                            {meterCpList.map((cp, index) => (
                              <ListItem key={`${cp.id}-${cp.connector}-${index}`} sx={{ py: 1.5, px: 2 }} divider={index < meterCpList.length - 1}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <EvStationIcon 
                                    color={cp.isCharging ? "warning" : "primary"} 
                                    sx={{ fontSize: '1.2rem' }}
                                  />
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.95rem' }}>
                                      <Box sx={{ flex: 1, fontWeight: 'bold', color: 'text.primary' }}>
                                        {cp.id}
                                        <Chip
                                          label={cp.emsAllocation?.acdc || cp.acdc || 'AC'}
                                          size="small"
                                          color={(cp.emsAllocation?.acdc || cp.acdc) === 'DC' ? 'secondary' : 'primary'}
                                          variant="outlined"
                                          sx={{
                                            ml: 1,
                                            fontSize: '0.65rem',
                                            height: '16px',
                                            '& .MuiChip-label': { px: 0.5 }
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ flex: 1, fontSize: '0.9rem' }}>{cp.connector}</Box>
                                      <Box sx={{ flex: 1 }}>
                                        <Chip
                                          label={cp.status}
                                          color={cp.statusColor}
                                          size="small"
                                          variant="filled"
                                          sx={{
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            minWidth: '60px',
                                            height: '24px'
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <AnimatedNumber value={cp.power} sx={{ fontWeight: 'bold', fontSize: '0.9rem' }} />
                                        {cp.emsAllocation && (
                                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                            {cp.emsAllocation.unit === 'A' ? 
                                              `限制 ${cp.emsAllocation.limit}A` : 
                                              `限制 ${(cp.emsAllocation.limit / 1000).toFixed(1)}kW`
                                            }
                                          </Typography>
                                        )}
                                      </Box>
                                      <Box sx={{ flex: 0.8, textAlign: 'center' }}>
                                        <IconButton
                                          size="small"
                                          color="primary"
                                          onClick={() => handleRestart(cp.id)}
                                          disabled={restartingIds.has(cp.id)}
                                          sx={{
                                            borderRadius: 2,
                                            padding: '6px',
                                            backgroundColor: restartingIds.has(cp.id) ? 'grey.300' : 'transparent',
                                            border: '1px solid',
                                            borderColor: restartingIds.has(cp.id) ? 'grey.400' : 'primary.main',
                                            color: restartingIds.has(cp.id) ? 'grey.600' : 'primary.main',
                                            transition: 'all 0.2s ease-in-out',
                                            '&:hover': restartingIds.has(cp.id) ? {} : {
                                              backgroundColor: 'primary.main',
                                              color: 'primary.contrastText',
                                              transform: 'scale(1.05)',
                                            },
                                            '& .MuiSvgIcon-root': {
                                              fontSize: '1rem',
                                              animation: restartingIds.has(cp.id) ? 'spin 1s linear infinite' : 'none',
                                            },
                                            '@keyframes spin': {
                                              '0%': { transform: 'rotate(0deg)' },
                                              '100%': { transform: 'rotate(360deg)' },
                                            }
                                          }}
                                        >
                                          <RestartAltIcon />
                                        </IconButton>
                                      </Box>
                                    </Box>
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>
                    )}
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
