"use client";
import React, { useMemo, useState } from 'react';
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
import { calculateEmsAllocation, isCharging } from '../../lib/emsAllocator';

/**
 * 充電樁列表卡片組件
 * @param {Object} props
 * @param {Array} props.chargers - 充電樁數據
 * @param {Array} props.siteSettings - 站點設定數據
 */
export default function CPListCard({ chargers = [], siteSettings = [] }) {
  // 重啟狀態管理
  const [restartingIds, setRestartingIds] = useState(new Set());

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
  // 計算整個場域的 EMS 分配
  const emsResult = useMemo(() => {
    if (!chargers || chargers.length === 0 || !siteSettings || siteSettings.length === 0) {
      return null;
    }
    
    try {
      // 準備 siteSetting 數據
      const siteSetting = siteSettings[0]; // 使用第一個設定
      
      // 準備所有充電槍的數據
      const gunsForAllocation = chargers.map((gun, index) => {
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
      
      // 獲取所有在線充電樁 ID
      const onlineCpids = chargers
        .filter(gun => gun.guns_status && !gun.guns_status.toLowerCase().includes('offline'))
        .map(gun => gun.cpsn || gun.cpid);
      
      // 對整個場域進行一次 EMS 分配計算
      const result = calculateEmsAllocation(siteSetting, gunsForAllocation, onlineCpids);
      // console.log('EMS 計算結果:', result);
      return result;
    } catch (error) {
      console.error('整體 EMS 計算失敗:', error);
      return null;
    }
  }, [chargers, siteSettings]);
  
  // 處理充電樁數據
  const cpList = useMemo(() => {
    if (!chargers || chargers.length === 0) {
      return [];
    }
    
    // 從 guns 數據轉換為 CP 列表格式
    // 增強數據轉換邏輯，更好地匹配 Prisma schema 中的 guns 表結構
    return chargers.map((gun, index) => {
      
      // 嘗試找到充電樁 ID - 優先使用 cpid，如果不存在則嘗試其他字段
      // 參考 Prisma schema: guns 表有 cpid, cpsn, id 字段
      const id = gun.cpid || gun.cpsn || 
                `CP-${gun.id || index + 1}`;
      
      // 嘗試找到連接器信息 - guns 表有 connector 字段
      const connector = gun.connector || 
                       `Connector-${index % 2 + 1}`; // 如果沒有連接器信息，根據索引模擬
      
      // 查找該充電樁的 EMS 分配結果
      let allocatedPower = 0;
      let emsAllocation = null;
      
      if (emsResult && emsResult.allocations) {
        // 從整體計算結果中找到對應該充電樁的分配
        const allocation = emsResult.allocations.find(a => a.cpid === id);
        if (allocation) {
          emsAllocation = allocation;
          allocatedPower = allocation.allocated_kw || 0;
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
      
      // 直接從站點設定中獲取 EMS 模式，而不是從計算結果中獲取
      const emsMode = siteSettings && siteSettings[0] && siteSettings[0].ems_mode 
        ? siteSettings[0].ems_mode === 'dynamic' ? 'dynamic' : 'static'
        : '靜態模式'; // 默認為靜態模式
      
      return { 
        id, 
        connector, 
        power: allocatedPower, 
        status, 
        statusColor,
        emsAllocation, // 包含 EMS 分配的詳細信息
        acdc: gun.acdc || 'AC', // 保存原始的 AC/DC 類型信息
        isCharging: chargingStatus, // 使用 emsAllocator 中的 isCharging 函數判斷的充電狀態
        emsMode // 記錄 EMS 模式
      };
    });
  }, [chargers, siteSettings]);
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
          <Typography variant="h6">充電樁狀態</Typography>
          {siteSettings && siteSettings[0] && (
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
              <Chip 
                label={`EMS模式: ${siteSettings[0].ems_mode === 'dynamic' ? '動態' : '靜態'}`} 
                size="small" 
                color="info"
                sx={{ mr: 1 }}
              />
              {emsResult && emsResult.summary && (
                <Chip 
                  label={`總功率: ${emsResult.summary.total_allocated_kw.toFixed(2)}kW/${emsResult.summary.max_power_kw}kW`} 
                  size="small" 
                  color={emsResult.summary.within_limit ? "success" : "error"}
                />
              )}
              {(!emsResult || !emsResult.summary) && siteSettings[0].max_power_kw && (
                <Chip 
                  label={`場域限制: ${siteSettings[0].max_power_kw}kW`}
                  size="small" 
                  color="secondary"
                />
              )}
            </Box>
          )}
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List>
            <ListItem sx={{ py: 2, px: 1 }} key="header" disablePadding>
              <ListItemIcon sx={{ minWidth: 36 }}>
                {/* 佔位，讓內容對齊 */}
                <EvStationIcon sx={{ opacity: 0 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', fontWeight: 'bold', fontSize: '1rem', color: 'text.secondary' }}>
                    <Box sx={{ flex: 1 }}>充電樁</Box>
                    <Box sx={{ flex: 1 }}>接頭</Box>
                    <Box sx={{ flex: 1 }}>狀態</Box>
                    <Box sx={{ flex: 1 }}>EMS分配之功率 (kW)</Box>
                    <Box sx={{ flex: 0.8, textAlign: 'center' }}>操作</Box>
                  </Box>
                }
              />
            </ListItem>
            <Divider />
            {cpList.length > 0 ? (
              <>
                {cpList.map((cp, index) => (
                  <ListItem key={`${cp.id}-${cp.connector}-${index}`} sx={{ py: 2, px: 1 }} divider>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <EvStationIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '1rem' }}>
                          <Box sx={{ flex: 1, fontWeight: 'bold', color: 'text.primary' }}>
                            {cp.id}
                            <Chip
                              label={cp.emsAllocation?.acdc || cp.acdc || 'AC'}
                              size="small"
                              color={(cp.emsAllocation?.acdc || cp.acdc) === 'DC' ? 'secondary' : 'primary'}
                              variant="outlined"
                              sx={{
                                ml: 1,
                                fontSize: '0.7rem',
                                height: '18px',
                                '& .MuiChip-label': {
                                  px: 0.5,
                                }
                              }}
                            />
                          </Box>
                          <Box sx={{ flex: 1 }}>{cp.connector}</Box>
                          <Box sx={{ flex: 1 }}>
                            <Chip
                              label={cp.status}
                              color={cp.statusColor}
                              size="small"
                              variant="filled"
                              sx={{
                                fontSize: '0.875rem',
                                fontWeight: 'bold',
                                minWidth: '60px',
                                '& .MuiChip-label': {
                                  px: 1,
                                }
                              }}
                            />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <AnimatedNumber value={cp.power} />
                            {cp.emsAllocation && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                {cp.emsAllocation.unit === 'A' ? 
                                  `${cp.emsAllocation.limit}A` : 
                                  `${(cp.emsAllocation.limit / 1000).toFixed(1)}kW`
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
                                padding: '8px',
                                backgroundColor: restartingIds.has(cp.id) ? 'grey.300' : 'transparent',
                                border: '1px solid',
                                borderColor: restartingIds.has(cp.id) ? 'grey.400' : 'primary.main',
                                color: restartingIds.has(cp.id) ? 'grey.600' : 'primary.main',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': restartingIds.has(cp.id) ? {} : {
                                  backgroundColor: 'primary.main',
                                  color: 'primary.contrastText',
                                  transform: 'scale(1.05)',
                                  boxShadow: (theme) => theme.shadows[2],
                                },
                                '&:active': restartingIds.has(cp.id) ? {} : {
                                  transform: 'scale(0.95)',
                                },
                                '& .MuiSvgIcon-root': {
                                  fontSize: '1.2rem',
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
              </>
            ) : (
              <ListItem sx={{ py: 4, px: 1 }}>
                <ListItemText
                  primary={
                    <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                      暫無充電樁數據 {chargers.length > 0 ? `(收到 ${chargers.length} 條數據但處理後為空)` : ''}
                    </Box>
                  }
                />
              </ListItem>
            )}
          </List>
        </Box>
      </CardContent>
    </Card>
  );
}
