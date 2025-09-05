"use client";
import React, { useState, useEffect, useCallback, useTransition } from 'react';
// 使用具體導入來減少 bundle 大小
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EvStationIcon from '@mui/icons-material/EvStation';
import TuneIcon from '@mui/icons-material/Tune';
import CircularProgressWithLabel from '../common/CircularProgressWithLabel';
import { updateBalanceMode, updateMaxPower } from '../../actions/siteActions';

// 負載平衡模式選項 - 移到組件外部避免初始化問題
const balanceOptions = [
  { value: 'static', label: '靜態分配' },
  { value: 'dynamic', label: '動態分配' },
];

/**
 * 充電狀態卡片組件
 * @param {Object} props
 * @param {Array} props.siteSettings - 站點設置數據
 * @param {Array} props.guns - 充電樁數據
 */
export default function ChargingStatusCard({ siteSettings = [], guns = [] }) {
  // 一次性宣告所有狀態，避免依賴順序問題
  const [siteSettingsState, setSiteSettingsState] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [emsMode, setEmsMode] = useState(null);
  const [maxPowerKw, setMaxPowerKw] = useState(null);
  const [totalWatts, setTotalWatts] = useState(null);
  const [balanceMode, setBalanceMode] = useState('static');
  const [isPendingBalance, startBalanceTransition] = useTransition();
  const [isPendingPower, startPowerTransition] = useTransition();
  const [isPendingReallocation, startReallocationTransition] = useTransition();
  const [chargingStatus, setChargingStatus] = useState([
    { label: '充電中', count: 0, percentage: 0, color: '#1976d2', ocppStatus: 'Charging' },
    { label: '閒置', count: 0, percentage: 0, color: '#4caf50', ocppStatus: 'Available' },
    { label: '不可用', count: 0, percentage: 0, color: '#ff9800', ocppStatus: 'Unavailable' },
    { label: '故障', count: 0, percentage: 0, color: '#f44336', ocppStatus: 'Faulted' },
  ]);
  const [totalStations, setTotalStations] = useState(20);

  // 除錯用：監控關鍵狀態變化 - 移到所有狀態定義之後
  useEffect(() => {
    console.log('State updated - emsMode:', emsMode, 'balanceMode:', balanceMode);
  }, [emsMode, balanceMode]);

  // 工具函數
  const getSettingValue = useCallback((key) => {
    if (!siteSettingsState || siteSettingsState.length === 0) return undefined;
    const row = siteSettingsState[0];
    if (!row) return undefined;
    if (key === 'ems_mode') return row.ems_mode ?? row.emsMode ?? undefined;
    if (key === 'max_power_kw') return row.max_power_kw ?? row.maxPowerKw ?? row.max_power ?? undefined;
    if (key === 'total_stations') return row.total_stations ?? row.totalStations ?? undefined;
    return undefined;
  }, [siteSettingsState]);

  // 處理充電狀態統計
  const processChargingStatus = useCallback(() => {
    try {
      console.log('Processing guns data from props:', guns.length, 'guns');

      // 統計各狀態數量
      const counts = { Charging: 0, Available: 0, Unavailable: 0, Faulted: 0 };

      guns.forEach((gun) => {
        const rawStatus = (gun.guns_status ?? '').toString().toLowerCase();

        if (!rawStatus) {
          counts.Available++;
          return;
        }

        if (rawStatus.includes('unavail') || rawStatus.includes('offline')) counts.Unavailable++;
        else if (rawStatus.includes('charg') || rawStatus.includes('inuse') || rawStatus.includes('charging')) counts.Charging++;
        else if (rawStatus.includes('available') || rawStatus.includes('idle') || rawStatus.includes('free')) counts.Available++;
        else if (rawStatus.includes('fault') || rawStatus.includes('error') || rawStatus.includes('fail')) counts.Faulted++;
        else counts.Available++;
      });

      const totalStations = guns.length;
      const unavailableCount = counts.Unavailable;
      const operationalStations = Math.max(0, totalStations - unavailableCount);

      // 計算百分比
      const chargingPct = totalStations ? Math.round((counts.Charging / totalStations) * 100) : 0;
      const availablePct = totalStations ? Math.round((counts.Available / totalStations) * 100) : 0;
      const faultedPct = totalStations ? Math.round((counts.Faulted / totalStations) * 100) : 0;
      const unavailablePct = totalStations ? Math.round((unavailableCount / totalStations) * 100) : 0;

      const chargingStatus = [
        { label: '充電中', count: counts.Charging, percentage: chargingPct, color: '#1976d2', ocppStatus: 'Charging' },
        { label: '閒置', count: counts.Available, percentage: availablePct, color: '#4caf50', ocppStatus: 'Available' },
        { label: '不可用', count: unavailableCount, percentage: unavailablePct, color: '#ff9800', ocppStatus: 'Unavailable' },
        { label: '故障', count: counts.Faulted, percentage: faultedPct, color: '#f44336', ocppStatus: 'Faulted' },
      ];

      console.log('Updated charging status:', chargingStatus);
      setChargingStatus(chargingStatus);
      setTotalStations(totalStations);
    } catch (error) {
      console.error('Failed to process charging status:', error);
    }
  }, [guns]);

  // 處理站點設置
  const processSiteSettings = useCallback(() => {
    setLoadingSettings(true);
    setSettingsError(null);

    try {
      console.log('Processing site settings from props:', siteSettings);
      setSiteSettingsState(siteSettings);

      if (siteSettings && siteSettings.length > 0) {
        const first = siteSettings[0];
        if (first) {
          // 確保正確設定 EMS 模式
          if (first.ems_mode !== undefined && first.ems_mode !== null) {
            console.log('Setting EMS mode from props:', first.ems_mode);
            setEmsMode(first.ems_mode);
            setBalanceMode(first.ems_mode);
          }
          // 確保正確設定最大功率
          if (first.max_power_kw !== undefined && first.max_power_kw !== null) {
            const kw = Number(first.max_power_kw);
            if (!isNaN(kw)) {
              console.log('Setting max power from props:', kw);
              setMaxPowerKw(kw);
              setTotalWatts(kw);
            }
          }
        }
      }
    } catch (error) {
      setSettingsError(error.message || 'Failed to process site settings');
      console.error('Failed to process site settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  }, [siteSettings]);

  // 更新負載平衡模式 - 使用 server action
  const handleBalanceModeChange = useCallback(async (event) => {
    const newMode = event.target.value;
    const previousMode = event.target.value; // 避免閉包問題

    startBalanceTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('ems_mode', newMode);
        
        const result = await updateBalanceMode(formData);
        
        if (result.success) {
          // 直接使用 server action 返回的數據更新狀態
          if (result.data) {
            setEmsMode(result.data.ems_mode);
            setBalanceMode(result.data.ems_mode);
            
            // 同步更新本地設置狀態
            setSiteSettingsState(prev => {
              if (!prev || prev.length === 0) return prev;
              const copy = [...prev];
              copy[0] = { 
                ...copy[0], 
                ems_mode: result.data.ems_mode,
                max_power_kw: result.data.max_power_kw 
              };
              return copy;
            });
          }
          console.log('負載平衡模式更新成功:', result.data);
        } else {
          console.error('Failed to update ems_mode:', result.error);
          alert('更新負載平衡模式失敗: ' + result.error);
          // 恢復到之前的模式 - 這裡需要重新處理當前的 props
          processSiteSettings();
        }
      } catch (error) {
        console.error('Failed to update ems_mode:', error);
        alert('更新負載平衡模式失敗: ' + error.message);
        // 恢復到之前的模式 - 這裡需要重新處理當前的 props
        processSiteSettings();
      }
    });
  }, [processSiteSettings]); // 添加 processSiteSettings 依賴

  // 更新場域總功率 - 使用 server action
  const handleUpdateMaxPower = useCallback(async () => {
    if (totalWatts === null || isNaN(Number(totalWatts))) {
      alert('請輸入有效的功率數值 (kW)');
      return;
    }

    startPowerTransition(async () => {
      const formData = new FormData();
      formData.append('max_power_kw', Number(totalWatts).toString());
      
      const result = await updateMaxPower(formData);
      
      if (result.success) {
        const updated = result.data;
        if (updated && updated.max_power_kw !== undefined) {
          setMaxPowerKw(Number(updated.max_power_kw));
          setTotalWatts(Number(updated.max_power_kw));

          // 更新本地設置
          setSiteSettingsState(prev => {
            if (!prev || prev.length === 0) return prev;
            const copy = [...prev];
            copy[0] = { ...copy[0], max_power_kw: updated.max_power_kw };
            return copy;
          });

          alert('更新成功');
        }
      } else {
        console.error('Failed to update max_power_kw:', result.error);
        alert('更新功率失敗: ' + result.error);
      }
    });
  }, [totalWatts]);

  // 手動觸發全站功率重新分配
  const handleTriggerPowerReallocation = useCallback(async () => {
    startReallocationTransition(async () => {
      try {
        console.log('開始手動觸發全站功率重新分配...');
        
        const response = await fetch('/api/trigger-power-reallocation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: 'charging-status-card',
            trigger_time: new Date().toISOString()
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('功率重新分配觸發結果:', result);
        
        if (result.success) {
          // 顯示成功訊息，包含詳細資訊
          const data = result.data || {};
          const message = `✅ 已成功觸發全站功率重新分配！\n\n` +
                         `📊 線上充電樁: ${data.onlineStations || 0} 個\n` +
                         `⚡ 排程更新: ${data.scheduledUpdates || 0} 個\n` +
                         `⏱️ 預計完成: ${data.estimatedCompletionTime || '未知'}`;
          
          alert(message);
          
          // 通知使用者頁面需要刷新才能反映最新的功率分配
          setTimeout(() => {
            alert('請刷新頁面以查看最新的功率分配結果');
          }, 3000);
          
        } else {
          console.error('功率重新分配觸發失敗:', result);
          alert(`❌ 觸發失敗: ${result.message || '未知錯誤'}`);
        }
        
      } catch (error) {
        console.error('手動觸發功率重新分配時發生錯誤:', error);
        alert(`❌ 觸發功率重新分配失敗:\n${error.message}`);
      }
    });
  }, []);

  // 批量操作處理函數
  const handleRestartAll = useCallback(() => {
    console.log('全部重啟');
    // 這裡可以實現批量重啟邏輯
  }, []);

  const handlePowerOffAll = useCallback(() => {
    console.log('全部斷電');
    // 這裡可以實現批量斷電邏輯
  }, []);

  const handleStartAll = useCallback(() => {
    console.log('全部啟動');
    // 這裡可以實現批量啟動邏輯
  }, []);

  // 初始化數據
  useEffect(() => {
    processSiteSettings();
    processChargingStatus();
  }, [processSiteSettings, processChargingStatus]);

  return (
    <Card sx={{
      width: '100%',
      height: 'auto'
    }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Box sx={{
            background: (theme) => theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.1)' : 'primary.main',
            borderRadius: '50%',
            p: 1,
            mr: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <EvStationIcon sx={{ color: 'primary.main', fontSize: '1.5rem' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            充電樁狀態
          </Typography>
        </Box>

        {/* 錯誤顯示 */}
        {settingsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {settingsError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexGrow: 1 }}>
          {/* 左側：充電樁狀態圓形進度條 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: 1 }}>
            {chargingStatus.map((status, index) => (
              <CircularProgressWithLabel
                key={index}
                value={status.percentage}
                label={status.label}
                color={status.color}
                quantity={status.count}
                animated={true}
              />
            ))}
          </Box>

          {/* 右側：系統控制 */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            minWidth: 180,
            ml: 2.5,
            pl: 2.5,
            borderLeft: '2px solid rgba(0, 0, 0, 0.12)',
            justifyContent: 'center'
          }}>
            {/* 負載平衡 */}
            <Box display="flex" flexDirection="column" alignItems="flex-start" gap={1}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>負載平衡</Typography>

              {/* 場域總瓦數輸入 */}
              <Box sx={{ display: 'flex', gap: 1, width: '100%', maxWidth: 240 }}>
                <TextField
                  size="small"
                  label="場域總功率 (kW)"
                  type="number"
                  value={totalWatts ?? ''}
                  onChange={(e) => setTotalWatts(e.target.value === '' ? null : Number(e.target.value))}
                  sx={{ flex: 1 }}
                  inputProps={{ min: 0 }}
                  disabled={isPendingPower}
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleUpdateMaxPower}
                  disabled={isPendingPower || totalWatts === null || isNaN(Number(totalWatts))}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {isPendingPower ? '儲存中...' : '確定'}
                </Button>
              </Box>

              <FormControl size="small" sx={{ width: '100%', maxWidth: 240 }}>
                <InputLabel id="balance-mode-label">模式</InputLabel>
                <Select
                  labelId="balance-mode-label"
                  id="balance-mode-select"
                  value={balanceMode || ''} // 確保有預設值
                  label="模式"
                  onChange={handleBalanceModeChange}
                  disabled={isPendingBalance}
                >
                  {balanceOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* 批量操作按鈕 */}
            <Box>
              {/* 第一排：手動觸發調整負載 */}
              <Box sx={{ mb: 1.5 }}>
                <Tooltip title="手動觸發全站功率重新分配" arrow>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleTriggerPowerReallocation}
                    disabled={isPendingReallocation}
                    startIcon={<TuneIcon sx={{ fontSize: '1rem' }} />}
                    fullWidth
                    sx={{
                      fontSize: '0.75rem',
                      py: 0.8,
                      backgroundColor: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '&:disabled': {
                        backgroundColor: 'action.disabled',
                      }
                    }}
                  >
                    {isPendingReallocation ? '調整中...' : '手動下發調整'}
                  </Button>
                </Tooltip>
              </Box>
              
              {/* 第二排：其他操作按鈕 */}
              <Stack direction="row" spacing={1}>
                <Tooltip title="全部重啟" arrow>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleRestartAll}
                    startIcon={<RestartAltIcon sx={{ fontSize: '1rem' }} />}
                    sx={{
                      fontSize: '0.7rem',
                      minWidth: 'auto',
                      px: 1,
                      py: 0.6,
                      borderColor: 'warning.main',
                      color: 'warning.main',
                      '&:hover': {
                        backgroundColor: 'warning.main',
                        color: 'white',
                        borderColor: 'warning.main',
                      }
                    }}
                  >
                    重啟
                  </Button>
                </Tooltip>

                <Tooltip title="全部斷電" arrow>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handlePowerOffAll}
                    startIcon={<PowerSettingsNewIcon sx={{ fontSize: '1rem' }} />}
                    sx={{
                      fontSize: '0.7rem',
                      minWidth: 'auto',
                      px: 1,
                      py: 0.6,
                      borderColor: 'error.main',
                      color: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.main',
                        color: 'white',
                        borderColor: 'error.main',
                      }
                    }}
                  >
                    斷電
                  </Button>
                </Tooltip>

                <Tooltip title="全部啟動" arrow>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleStartAll}
                    startIcon={<PlayArrowIcon sx={{ fontSize: '1rem' }} />}
                    sx={{
                      fontSize: '0.7rem',
                      minWidth: 'auto',
                      px: 1,
                      py: 0.6,
                      borderColor: 'success.main',
                      color: 'success.main',
                      '&:hover': {
                        backgroundColor: 'success.main',
                        color: 'white',
                        borderColor: 'success.main',
                      }
                    }}
                  >
                    啟動
                  </Button>
                </Tooltip>
              </Stack>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
