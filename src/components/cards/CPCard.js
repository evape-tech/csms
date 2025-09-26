"use client";
import React, { useState, useEffect, useTransition } from 'react';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  IconButton, 
  Tooltip,
  useTheme,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Slider,
  Select,
  MenuItem
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import BoltIcon from '@mui/icons-material/Bolt';
import { AddChargerDialog, AddMeterDialog } from '../dialog';
import { deleteGunAction } from '../../actions/gunActions';
import { updateBalanceMode, updateMaxPower } from '../../actions/stationActions';

// OCPP 狀態顏色映射
const getOcppStatusColor = (status) => {
  const statusColors = {
    'Available': '#4caf50',      // 綠色 - 可用
    'Preparing': '#2196f3',      // 藍色 - 準備中
    'Charging': '#1976d2',       // 深藍色 - 充電中
    'SuspendedEVSE': '#ff9800',  // 橙色 - 暫停
    'SuspendedEV': '#ff9800',    // 橙色 - 暫停
    'Finishing': '#9c27b0',      // 紫色 - 完成中
    'Reserved': '#607d8b',       // 灰色 - 預約中
    'Unavailable': '#757575',    // 深灰色 - 不可用
    'Faulted': '#f44336',        // 紅色 - 故障
  };
  return statusColors[status] || '#757575';
};

// OCPP 狀態中文映射
const getOcppStatusText = (status) => {
  const statusTexts = {
    'Available': '可用',
    'Preparing': '準備中',
    'Charging': '充電中',
    'SuspendedEVSE': '暫停',
    'SuspendedEV': '暫停',
    'Finishing': '完成中',
    'Reserved': '預約中',
    'Unavailable': '不可用',
    'Faulted': '故障',
  };
  return statusTexts[status] || status;
};

export default function CPCard({ chargers, stations, meters }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [viewMode, setViewMode] = useState('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMeterDialogOpen, setAddMeterDialogOpen] = useState(false);
  
  // 使用 useTransition 來處理 server action
  const [isPendingDelete, startDeleteTransition] = useTransition();
  
  // 從 stations 組織電表和充電樁的群組結構
  const organizeByMeters = () => {
    if (!stations || stations.length === 0) return [];
    
    const meterGroups = [];
    
    // 遍歷所有站點
    stations.forEach(station => {
      if (!station.meters || !Array.isArray(station.meters)) return;
      
      // 遍歷站點下的所有電表
      station.meters.forEach(meter => {
        // 從stations.meters.guns 獲取充電樁資料，如果沒有則從 chargers 參數中根據 meter_id 篩選
        let gunsForMeter = meter.guns || [];
        
        // 如果電表中沒有 guns 資料，則從外部 chargers 參數中篩選
        if ((!gunsForMeter || gunsForMeter.length === 0) && chargers && chargers.length > 0) {
          gunsForMeter = chargers.filter(gun => gun.meter_id === meter.id);
        }
        
        // 標準化充電樁資料
        const normalizedGuns = gunsForMeter.map(gun => normalizeCharger(gun, meter, station));
        
        meterGroups.push({
          meter: {
            id: meter.id,
            name: meter.meter_no || `電表 #${meter.id}`,
            meter_no: meter.meter_no,
            ems_mode: meter.ems_mode,
            max_power_kw: meter.max_power_kw,
            billing_mode: meter.billing_mode,
            station_id: station.id,
            station_name: station.name,
            station_code: station.station_code
          },
          guns: normalizedGuns,
          totalGuns: normalizedGuns.length,
          onlineGuns: normalizedGuns.filter(gun => gun.status === 'Available' || gun.status === 'Charging').length,
          chargingGuns: normalizedGuns.filter(gun => gun.status === 'Charging').length
        });
      });
    });
    
    return meterGroups;
  };
  
  // normalize incoming charger objects to consistent shape used by this component
  const normalizeCharger = (gun, meter, station) => {
    return {
      id: gun.id,
      cpid: gun.cpid ?? gun.CPID ?? null,
      cpsn: gun.cpsn ?? gun.CPSN ?? null,
      // status field in DB is `guns_status`
      status: gun.guns_status ?? gun.status ?? gun.gunsStatus ?? 'Available',
      // AC/DC field
      type: (gun.type ?? gun.acdc ?? gun.ACDC ?? null),
      // max power in kW
      max_kw: gun.max_kw ?? gun.maxPower ?? (gun.power ? Math.round(gun.power / 1000) : null),
      // description mapping: guns_memo1 is 備註/描述
      desc: gun.guns_memo1 ?? gun.desc ?? gun.memo ?? null,
      // tariff information
      gun_tariffs: gun.gun_tariffs || [],
      // meter information
      meter_id: meter.id,
      meter: {
        id: meter.id,
        name: meter.meter_no,
        meter_no: meter.meter_no,
        ems_mode: meter.ems_mode,
        max_power_kw: meter.max_power_kw,
        billing_mode: meter.billing_mode
      },
      station_id: station.id,
      station: station,
      // keep original values available
      ...gun
    };
  };

  const [meterGroups, setMeterGroups] = useState(organizeByMeters());

  useEffect(() => {
    setMeterGroups(organizeByMeters());
  }, [chargers, stations, meters]);

  // track in-flight actions per charger id
  const [actionLoading, setActionLoading] = useState({});

  // helper to POST to local server route which handles OCPP forwarding and API key
  const callOcppEndpoint = async (id, body) => {
    const url = `/api/guns/${id}/ocpp`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || res.statusText || 'OCSP controller request failed');
      }
      return await res.json().catch(() => ({}));
    } catch (err) {
      throw err;
    }
  };

  // 操作處理函數 - 更新 local state
  const updateLocalCharger = (gunnerId, updates) => {
    setMeterGroups(prevGroups => 
      prevGroups.map(group => ({
        ...group,
        guns: group.guns.map(gun => 
          gun.id === gunnerId ? { ...gun, ...updates } : gun
        )
      }))
    );
  };

  const removeLocalCharger = (gunnerId) => {
    setMeterGroups(prevGroups => 
      prevGroups.map(group => ({
        ...group,
        guns: group.guns.filter(gun => gun.id !== gunnerId),
        totalGuns: group.guns.filter(gun => gun.id !== gunnerId).length
      }))
    );
  };

  const handleStartCharging = async (id) => {
    // 找到充電樁
    let targetCharger = null;
    for (const group of meterGroups) {
      const charger = group.guns.find(gun => gun.id === id);
      if (charger) {
        targetCharger = charger;
        break;
      }
    }

    if (!targetCharger) return alert('找不到充電樁資料');
    if (!targetCharger.cpid) return alert('此充電樁沒有 CPID，無法發送 OCPP 指令');

    setActionLoading(s => ({ ...s, [id]: true }));
    try {
      // 管理後台的啟動與停止充電先寫死
      const body = {
        cmd: 'cmd_start_charging',
        cp_id: targetCharger.cpid,
        connectorId: targetCharger.connector,
        user_uuid: 'cc2bccd0-c979-11e9-ba8d-d70282892727',
        user_id_tag: 'RFID002',
      };
      await callOcppEndpoint(id, body);

      // optimistic update: set status to Charging
      updateLocalCharger(id, { status: 'Charging' });
    } catch (err) {
      console.error('Start charging failed', err);
      alert('啟動指令失敗: ' + (err?.message || err));
    } finally {
      setActionLoading(s => ({ ...s, [id]: false }));
    }
  };

  const handleStopCharging = async (id) => {
    // 找到充電樁
    let targetCharger = null;
    for (const group of meterGroups) {
      const charger = group.guns.find(gun => gun.id === id);
      if (charger) {
        targetCharger = charger;
        break;
      }
    }

    if (!targetCharger) return alert('找不到充電樁資料');
    if (!targetCharger.cpid) return alert('此充電樁沒有 CPID，無法發送 OCPP 指令');

    setActionLoading(s => ({ ...s, [id]: true }));
    try {
      const body = {
        cmd: 'cmd_stop_charging',
        cp_id: targetCharger.cpid,
        connectorId: targetCharger.connector ? parseInt(targetCharger.connector, 10) : 1, // 使用充電樁的實際 connector 欄位，預設為1
        user_uuid: 'cc2bccd0-c979-11e9-ba8d-d70282892727',
        user_id_tag: 'RFID002',
      };
      await callOcppEndpoint(id, body);

      // optimistic update: set status to Available
      updateLocalCharger(id, { status: 'Available' });
    } catch (err) {
      console.error('Stop charging failed', err);
      alert('停止指令失敗: ' + (err?.message || err));
    } finally {
      setActionLoading(s => ({ ...s, [id]: false }));
    }
  };

  // delete handler - 使用 server action
  const handleDeleteCharger = async (id) => {
    if (!confirm('確認刪除此充電樁？')) return;
    
    startDeleteTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('id', id);
        
        const result = await deleteGunAction(formData);
        
        if (result.success) {
          // 成功：從本地列表中移除，UI 立即更新
          removeLocalCharger(id);
        } else {
          console.error('Failed to delete charger:', result.error);
          alert('刪除失敗: ' + result.error);
        }
      } catch (err) {
        console.error('Failed to delete charger', err);
        alert('刪除失敗: ' + (err?.message || err));
      }
    });
  };

  // save/update handler from edit dialog
  const handleSaveCharger = (updated) => {
    updateLocalCharger(updated.id, updated);
  };

  // save handler for new meter
  const handleSaveMeter = (newMeter) => {
    // Since meter data comes from props, we need to notify parent to refresh
    // For now, just show a success message and suggest refreshing the page
    alert(`電表 "${newMeter.meter_no}" 新增成功！請重新整理頁面以查看最新資料。`);
  };

  const handleRestart = id => console.log('重啟充電樁:', id);
  const handleSettings = id => console.log('設定充電樁:', id);

  // 篩選功能 - 從 meterGroups 中篩選
  const getFilteredMeterGroups = () => {
    return meterGroups.map(group => {
      const filteredGuns = group.guns.filter(gun => {
        const matchesStatus = statusFilter === 'all' || gun.status === statusFilter;
        const matchesType = typeFilter === 'all' || gun.type === typeFilter;
        const matchesSearch = searchTerm === '' || 
          `CP-${String(gun.id).padStart(2, '0')}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (gun.cpid && String(gun.cpid).toLowerCase().includes(searchTerm.toLowerCase())) ||
          (gun.cpsn && String(gun.cpsn).toLowerCase().includes(searchTerm.toLowerCase())) ||
          (gun.meter && gun.meter.meter_no && String(gun.meter.meter_no).toLowerCase().includes(searchTerm.toLowerCase())) ||
          (gun.meter && gun.meter.name && gun.meter.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesStatus && matchesType && matchesSearch;
      });

      return {
        ...group,
        guns: filteredGuns.sort((a, b) => {
          if (sortBy === 'id') return a.id - b.id;
          if (sortBy === 'status') return a.status.localeCompare(b.status);
          if (sortBy === 'power') return (b.max_kw || 0) - (a.max_kw || 0);
          return 0;
        })
      };
    }); // 顯示所有電表群組，包括沒有充電樁的
  };

  const filteredMeterGroups = getFilteredMeterGroups();

  // 篩選欄位資料
  const filterFields = [
    {
      label: '狀態篩選', value: statusFilter, setValue: setStatusFilter, options: [
        { value: 'all', label: '全部狀態' },
        { value: 'Available', label: '可用' },
        { value: 'Charging', label: '充電中' },
        { value: 'Faulted', label: '故障' },
        { value: 'Preparing', label: '準備中' },
        { value: 'Finishing', label: '完成中' }
      ]
    },
    {
      label: '類型篩選', value: typeFilter, setValue: setTypeFilter, options: [
        { value: 'all', label: '全部類型' },
        { value: 'AC', label: '交流充電' },
        { value: 'DC', label: '直流充電' }
      ]
    },
    {
      label: '排序方式', value: sortBy, setValue: setSortBy, options: [
        { value: 'id', label: '按編號' },
        { value: 'status', label: '按狀態' },
        { value: 'power', label: '按功率' }
      ]
    }
  ];

  return (
    <Box>
      {/* 篩選和搜尋控制項 */}
      <Card sx={{ mb: 2, width: '100%' }}>
        <CardContent sx={{ px: 0, py: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              width: '100%',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              px: 1,
            }}
          >
            {filterFields.map((field) => (
              <Box key={field.label} sx={{ minWidth: 160 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    value={field.value}
                    label={field.label}
                    onChange={e => field.setValue(e.target.value)}
                  >
                    {field.options.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            ))}

            {/* 搜尋框 - 彈性成長 */}
            <Box sx={{ flex: '1 1 360px', minWidth: 240 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="搜尋充電樁編號、CPID、CPSN 或電表編號"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 0 }}
              />
            </Box>

            {/* 視圖切換 */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title="卡片視圖">
                <IconButton size="small" color={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>
                  <ViewModuleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="列表視圖">
                <IconButton size="small" color={viewMode === 'list' ? 'primary' : 'default'} onClick={() => setViewMode('list')}>
                  <ViewListIcon />
                </IconButton>
              </Tooltip>
            </Box>

            {/* action buttons - 固定在最右 */}
            <Box sx={{ marginLeft: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title="新增電表">
                <Button variant="contained" color="primary" size="medium" onClick={() => setAddMeterDialogOpen(true)}>
                  新增電表
                </Button>
              </Tooltip>
              <Tooltip title="新增充電樁">
                <Button variant="contained" color="primary" size="medium" onClick={() => setAddDialogOpen(true)}>
                  新增充電樁
                </Button>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
      <AddChargerDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} stations={stations} meters={meters} onAdd={handleSaveCharger} />
      <AddMeterDialog open={addMeterDialogOpen} onClose={() => setAddMeterDialogOpen(false)} stations={stations} onAdd={handleSaveMeter} />
      {/* 充電樁列表 - 按電表群組顯示 */}
      <Box>
        {/* 添加一個小提示顯示總數據 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            共 {filteredMeterGroups.length} 個電表群組，
            {filteredMeterGroups.reduce((sum, group) => sum + group.guns.length, 0)} 個充電樁
          </Typography>
        </Box>
        
        {filteredMeterGroups.length === 0 ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              沒有找到符合條件的充電樁
            </Typography>
          </Box>
        ) : (
          filteredMeterGroups.map(group => (
            <MeterGroupCard 
              key={`meter-${group.meter.id}`}
              meterGroup={group}
              viewMode={viewMode}
              onStartCharging={handleStartCharging}
              onStopCharging={handleStopCharging}
              onRestart={handleRestart}
              onSettings={handleSettings}
              onDelete={handleDeleteCharger}
              onSave={handleSaveCharger}
              loadingMap={actionLoading}
              isPendingDelete={isPendingDelete}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

// 電表群組卡片組件
function MeterGroupCard({ 
  meterGroup, 
  viewMode, 
  onStartCharging, 
  onStopCharging, 
  onRestart, 
  onSettings, 
  onDelete, 
  onSave, 
  loadingMap, 
  isPendingDelete 
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  
  // EMS設置相關狀態
  const [emsMode, setEmsMode] = useState(meterGroup.meter.ems_mode || 'static');
  const [maxPowerKw, setMaxPowerKw] = useState(meterGroup.meter.max_power_kw || 0);
  const [isPendingEms, startEmsTransition] = useTransition();
  const [emsError, setEmsError] = useState(null);
  const [emsSuccess, setEmsSuccess] = useState(null);

  const { meter, guns, totalGuns, onlineGuns, chargingGuns } = meterGroup;
  
  // 更新EMS模式
  const handleUpdateEmsMode = () => {
    setEmsError(null);
    startEmsTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('ems_mode', emsMode);
        formData.append('meter_id', meter.id);
        
        const result = await updateBalanceMode(formData);
        
        if (result.success) {
          setEmsSuccess('EMS模式更新成功!');
          setTimeout(() => setEmsSuccess(null), 3000);
        } else {
          setEmsError(`更新EMS模式失敗: ${result.error}`);
        }
      } catch (err) {
        setEmsError(`更新EMS模式發生錯誤: ${err.message}`);
      }
    });
  };
  
  // 更新最大功率
  const handleUpdateMaxPower = () => {
    setEmsError(null);
    startEmsTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('max_power_kw', maxPowerKw);
        formData.append('meter_id', meter.id);
        
        const result = await updateMaxPower(formData);
        
        if (result.success) {
          setEmsSuccess('最大功率更新成功!');
          setTimeout(() => setEmsSuccess(null), 3000);
        } else {
          setEmsError(`更新最大功率失敗: ${result.error}`);
        }
      } catch (err) {
        setEmsError(`更新最大功率發生錯誤: ${err.message}`);
      }
    });
  };

  // 手動調整負載
  const handleManualLoadAdjustment = async () => {
    setEmsError(null);
    startEmsTransition(async () => {
      try {
        console.log(`🔄 [電表級負載調整] 觸發電表 ${meter.id} (${meter.name}) 的功率重新分配`);
        console.log(`📊 [電表級負載調整] 電表資訊: ID=${meter.id}, 名稱=${meter.name}, 編號=${meter.meter_no}, 站點=${meter.station_name}`);
        
        const response = await fetch('/api/trigger-power-reallocation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meter_id: meter.id,
            station_id: meter.station_id,
            source: 'frontend-meter-manual-trigger',
            timestamp: new Date().toISOString()
          })
        });
        
        if (!response.ok) {
          throw new Error(`API 請求失敗: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          setEmsSuccess(`電表 ${meter.name} 負載調整成功!`);
          console.log(`✅ [電表級負載調整] 成功: ${result.message}`);
          console.log(`📊 [電表級負載調整] 目標類型: ${result.data?.targetType || 'meter'}`);
          console.log(`📊 [電表級負載調整] 目標ID: ${result.data?.targetId || meter.id}`);
          console.log(`📊 [電表級負載調整] 影響充電桩: ${result.data?.scheduledUpdates || 0} 個`);
          setTimeout(() => setEmsSuccess(null), 3000);
        } else {
          throw new Error(result.message || '電表負載調整失敗');
        }
      } catch (err) {
        console.error(`❌ [電表級負載調整] 失敗:`, err);
        setEmsError(`電表 ${meter.name} 負載調整失敗: ${err.message}`);
      }
    });
  };

  return (
    <Card sx={{ mb: 3, borderRadius: 4, overflow: 'hidden' }}>
      {/* 電表資訊標題 */}
      <Box 
        sx={{ 
          background: `linear-gradient(135deg, ${theme.palette.primary.main}20 0%, ${theme.palette.secondary.main}20 100%)`,
          p: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${theme.palette.primary.main}30 0%, ${theme.palette.secondary.main}30 100%)`,
          }
        }}
      >
        {/* 所有內容放在一行 */}
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' }, flex: 1 }}>
            {/* 電表基本資訊 */}
            <Box display="flex" alignItems="center" sx={{ cursor: 'pointer', minWidth: 'fit-content' }} onClick={() => setExpanded(!expanded)}>
              <Typography variant="h6" fontWeight="bold" color="primary" sx={{ whiteSpace: 'nowrap' }}>
                📊 {meter.name}
              </Typography>
              <Chip 
                label={`編號: ${meter.meter_no || meter.id}`} 
                size="small" 
                variant="filled" 
                color="secondary" 
                sx={{ fontWeight: 'bold', fontSize: '0.75rem', ml: 1 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                站點: {meter.station_name} ({meter.station_code})
              </Typography>
            </Box>
            
            {/* 分隔線 */}
            <Divider orientation="vertical" flexItem sx={{ mx: 1, display: { xs: 'none', md: 'block' } }} />
            
            {/* EMS控制 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: { xs: 'wrap', lg: 'nowrap' }, flex: 1 }}>
              {/* EMS模式選擇 */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>EMS模式:</Typography>
                <Select
                  value={emsMode}
                  onChange={(e) => setEmsMode(e.target.value)}
                  size="small"
                  sx={{ ml: 1, minWidth: '100px', height: '36px' }}
                >
                  <MenuItem value="static">靜態</MenuItem>
                  <MenuItem value="dynamic">動態</MenuItem>
                </Select>
                <Button 
                  variant="outlined" 
                  color="primary"
                  size="small"
                  disabled={isPendingEms || emsMode === meter.ems_mode}
                  onClick={handleUpdateEmsMode}
                  sx={{ fontSize: '0.75rem', ml: 1, minWidth: '60px', height: '30px' }}
                >
                  {isPendingEms ? <CircularProgress size={14} color="inherit" /> : '更新'}
                </Button>
              </Box>
              
              {/* 最大功率設定 */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>最大功率:</Typography>
                <TextField
                  variant="outlined"
                  type="number"
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kW</InputAdornment>,
                  }}
                  value={maxPowerKw}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || !isNaN(Number(value))) {
                      setMaxPowerKw(value === '' ? '' : Number(value));
                    }
                  }}
                  sx={{ width: '120px', mx: 1, '& .MuiOutlinedInput-root': { height: '36px' } }}
                />
                <Button 
                  variant="outlined" 
                  color="primary"
                  size="small"
                  disabled={isPendingEms || maxPowerKw === Number(meter.max_power_kw)}
                  onClick={handleUpdateMaxPower}
                  sx={{ fontSize: '0.75rem', minWidth: '60px', height: '30px' }}
                >
                  {isPendingEms ? <CircularProgress size={14} color="inherit" /> : '更新'}
                </Button>
              </Box>
              
              {/* 手動電表負載調整 */}
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Button 
                  variant="contained" 
                  color="secondary"
                  size="small"
                  disabled={isPendingEms}
                  onClick={handleManualLoadAdjustment}
                  startIcon={isPendingEms ? <CircularProgress size={14} color="inherit" /> : <BoltIcon fontSize="small" />}
                  sx={{ fontSize: '0.75rem', minWidth: '120px', height: '30px' }}
                >
                  {isPendingEms ? '調整中...' : '電表負載調整'}
                </Button>
              </Box>
            </Box>
          </Box>
          
          {/* 展開/收合充電樁列表圖示 */}
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ ml: 1 }}>
            {expanded ? <Typography>🔽</Typography> : <Typography>▶️</Typography>}
          </IconButton>
        </Box>
        
        {/* 錯誤和成功訊息 */}
        {(emsError || emsSuccess) && (
          <Box sx={{ mt: 2 }}>
            {emsError && <Alert severity="error" sx={{ mb: 1 }}>{emsError}</Alert>}
            {emsSuccess && <Alert severity="success">{emsSuccess}</Alert>}
          </Box>
        )}
      </Box>

      {/* 充電樁列表 */}
      {expanded && (
        <CardContent sx={{ p: 3 }}>
          {guns.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                此電表下沒有充電樁
              </Typography>
            </Box>
          ) : (
            <Box sx={{
              display: 'flex',
              flexDirection: viewMode === 'card' ? 'row' : 'column',
              flexWrap: viewMode === 'card' ? 'wrap' : 'nowrap',
              gap: 2,
              justifyContent: viewMode === 'card' ? 'flex-start' : undefined
            }}>
              {guns.map(gun => (
                <Box
                  key={`gun-${gun.id}`}
                  sx={
                    viewMode === 'card'
                      ? { width: { xs: '100%', sm: '48%', md: '33.3333%', lg: '24%' }, minWidth: 240, display: 'flex' }
                      : { width: '100%' }
                  }
                >
                  <CPCardItem
                    charger={gun}
                    layout={viewMode === 'card' ? 'grid' : 'linear'}
                    onStartCharging={onStartCharging}
                    onStopCharging={onStopCharging}
                    onRestart={onRestart}
                    onSettings={onSettings}
                    onDelete={onDelete}
                    onSave={onSave}
                    loadingMap={loadingMap}
                    isPendingDelete={isPendingDelete}
                    stations={[{
                      id: meterGroup.meter.station_id,
                      name: meterGroup.meter.station_name,
                      station_code: meterGroup.meter.station_code,
                      meters: [meterGroup.meter]
                    }]} // 構造包含當前電表的 stations 結構
                  />
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// 單一充電樁卡片
function CPCardItem({ charger, onStartCharging, onStopCharging, onRestart, onSettings, onDelete, onSave, loadingMap = {}, isPendingDelete = false, layout = 'linear', stations = [] }) {
   const theme = useTheme();
   const isLinear = layout === 'linear';
   const [editDialogOpen, setEditDialogOpen] = useState(false);
   
   // 單一充電樁編輯Dialog
   const handleEditClick = () => {
     setEditDialogOpen(true);
   };
   const isActionLoading = Boolean(loadingMap && loadingMap[charger.id]);
   return (
    <Card sx={{
      width: '100%',
      height: isLinear ? 'auto' : 'auto',
      minHeight: isLinear ? 160 : 180,
      border: `2px solid ${getOcppStatusColor(charger.status)}`,
      borderRadius: 3,
      background: `linear-gradient(120deg, ${theme.palette.background.paper} 60%, ${getOcppStatusColor(charger.status)}11 100%)`,
      boxShadow: theme.shadows[2],
      display: 'flex',
      flexDirection: isLinear ? 'row' : 'column',
      position: 'relative',
      overflow: 'hidden',
      transition: 'box-shadow 0.3s, border-color 0.3s',
      '&:hover': {
        boxShadow: theme.shadows[6],
        borderColor: theme.palette.primary.main,
      },
    }}>
      <CardContent sx={{
        p: isLinear ? 2.5 : 3,
        pb: isLinear ? 2.5 : 2,
        flex: 1,
        display: 'flex',
        flexDirection: isLinear ? 'row' : 'column',
        alignItems: isLinear ? 'center' : 'stretch',
        gap: isLinear ? 3 : 2.5,
        justifyContent: isLinear ? 'flex-start' : 'space-between',
        minHeight: 0,
        background: isLinear ? 'none' : `${getOcppStatusColor(charger.status)}08`,
        borderRadius: isLinear ? 0 : 2,
      }}>
        {/* 標題與狀態 */}
        <Box display="flex" alignItems="center" gap={2} sx={{ minWidth: 180 }}>
          <Typography variant={isLinear ? "h6" : "h5"} fontWeight="bold" sx={{ fontSize: isLinear ? '1.1rem' : '1.25rem', letterSpacing: 1 }}>
            {charger.cpid ? String(charger.cpid) : '—'}
          </Typography>
          <Chip
            label={getOcppStatusText(charger.status)}
            size="medium"
            sx={{
              backgroundColor: getOcppStatusColor(charger.status),
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              height: 28,
              minWidth: 70,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          />
        </Box>

        {/* 主要資訊區塊 */}
        <Box sx={{
          display: 'flex',
          flexDirection: isLinear ? 'row' : 'column',
          gap: isLinear ? 3 : 2,
          flex: 1,
          alignItems: isLinear ? 'center' : 'flex-start',
          justifyContent: isLinear ? 'flex-start' : 'center',
          minHeight: 0,
        }}>
          {/* Show CPSN */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', justifyContent: isLinear ? 'flex-start' : 'space-between' }}>
            <Typography variant="body2" color="text.secondary">樁序號 (CPSN)</Typography>
            <Typography variant="body2" fontWeight="bold" color="text.primary" sx={{ fontSize: '1rem', ml: 1 }}>
              {charger.cpsn ?? '—'}
            </Typography>
          </Box>

          {/* Show 電流型態 (AC/DC) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', justifyContent: isLinear ? 'flex-start' : 'space-between' }}>
            <Typography variant="body2" color="text.secondary">類型 (AC/DC)</Typography>
            <Typography variant="body2" fontWeight="bold" color="secondary.main" sx={{ fontSize: '1rem', ml: 1 }}>
              {charger.type ?? (charger.ACDC ?? '—')}
            </Typography>
          </Box>

          {/* Show 最大功率 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', justifyContent: isLinear ? 'flex-start' : 'space-between' }}>
            <Typography variant="body2" color="text.secondary">最大功率(kW)</Typography>
            <Typography variant="body2" fontWeight="bold" color={charger.maxPower || charger.max_kw || charger.power ? 'primary.main' : 'text.secondary'} sx={{ fontSize: '1rem', ml: 1 }}>
              {charger.maxPower ? `${charger.maxPower} kW` : charger.max_kw ? `${charger.max_kw} kW` : (charger.power ? `${(charger.power/1000).toFixed(1)} kW` : '—')}
            </Typography>
          </Box>

          {/* Show 連接器ID */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', justifyContent: isLinear ? 'flex-start' : 'space-between' }}>
            <Typography variant="body2" color="text.secondary">連接器ID</Typography>
            <Typography variant="body2" fontWeight="bold" color="info.main" sx={{ fontSize: '1rem', ml: 1 }}>
              {charger.connector ?? '—'}
            </Typography>
          </Box>
          

        </Box>

        {/* 額外描述：顯示 guns_memo1（mapping 到 charger.desc），以 KV 形式左右對齊 */}
        {charger.desc && (
          <Box sx={{ mt: 1, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, width: '100%', justifyContent: isLinear ? 'flex-start' : 'space-between' }}>
              <Typography variant="body2" color="text.secondary">描述</Typography>
              <Typography
                variant="body2"
                sx={{
                  ml: 1,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 160,
                  overflow: 'auto',
                  maxWidth: isLinear ? 220 : '60%',
                  textAlign: isLinear ? 'left' : 'right'
                }}
              >
                {charger.desc}
              </Typography>
            </Box>
          </Box>
        )}

        {/* 費率方案展示 */}
        {charger.gun_tariffs && charger.gun_tariffs.length > 0 && (
          <Box sx={{ mt: 1.5, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, width: '100%', justifyContent: isLinear ? 'flex-start' : 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>費率方案</Typography>
              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 0.5, 
                maxWidth: isLinear ? 250 : '65%',
                justifyContent: isLinear ? 'flex-start' : 'flex-end',
                alignItems: 'center'
              }}>
                {charger.gun_tariffs
                  .sort((a, b) => (a.priority || 1) - (b.priority || 1))
                  .map((gunTariff, index) => {
                    const tariff = gunTariff.tariffs;
                    if (!tariff) return null;
                    
                    const isPrimary = index === 0; // 優先級最高的為主要費率
                    
                    return (
                      <Chip
                        key={`tariff-${gunTariff.id || tariff.id}`}
                        label={tariff.name}
                        size="small"
                        variant={isPrimary ? "filled" : "outlined"}
                        color={isPrimary ? "primary" : "default"}
                        sx={{
                          fontWeight: isPrimary ? 600 : 400,
                          borderRadius: 2,
                          height: 24,
                          fontSize: '0.75rem',
                          transition: 'all 0.2s ease-in-out',
                          '& .MuiChip-label': {
                            px: 1.5,
                            py: 0.5,
                            lineHeight: 1.2
                          },
                          ...(isPrimary ? {
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            '&:hover': {
                              backgroundColor: 'primary.dark',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                              transform: 'translateY(-1px)'
                            }
                          } : {
                            backgroundColor: 'background.paper',
                            borderColor: 'divider',
                            color: 'text.secondary',
                            '&:hover': {
                              backgroundColor: 'action.hover',
                              borderColor: 'primary.main',
                              color: 'primary.main'
                            }
                          })
                        }}
                      />
                    );
                  })
                  .filter(Boolean)
                }
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>

      {/* 操作按鈕：啟用/停用狀態 */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: isLinear ? 2.5 : 3,
        py: isLinear ? 1.2 : 2,
        borderLeft: isLinear ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
        borderTop: isLinear ? 'none' : '1px solid rgba(0, 0, 0, 0.08)',
        minWidth: isLinear ? 220 : 'auto',
        minHeight: isLinear ? 'auto' : 60,
        justifyContent: isLinear ? 'flex-end' : 'center',
        background: isLinear ? 'none' : `${getOcppStatusColor(charger.status)}08`,
        borderRadius: isLinear ? 0 : 2,
      }}>
        {/* Start / Stop */}
        <Button
          variant="outlined"
          color="success"
          startIcon={<PlayArrowIcon />}
          onClick={() => onStartCharging && onStartCharging(charger.id)}
          disabled={isActionLoading}
          sx={{ textTransform: 'none', borderColor: '#4caf50', color: '#2e7d32' }}
        >
          啟動
        </Button>

        <Button
          variant="outlined"
          color="error"
          startIcon={<StopIcon />}
          onClick={() => onStopCharging && onStopCharging(charger.id)}
          disabled={isActionLoading}
          sx={{ textTransform: 'none', borderColor: '#f44336', color: '#c62828' }}
        >
          停止
        </Button>

        {/* Edit */}
        <Button
          variant="outlined"
          color="warning"
          startIcon={<EditIcon />}
          onClick={handleEditClick}
          sx={{ textTransform: 'none', borderColor: '#ffb300', color: '#ff6f00' }}
        >
          編輯
        </Button>

        {/* Delete */}
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => onDelete && onDelete(charger.id)}
          disabled={isPendingDelete}
          sx={{ textTransform: 'none' }}
        >
          {isPendingDelete ? '刪除中...' : '刪除'}
        </Button>

        {/* 編輯 Dialog - 使用 AddChargerDialog 的編輯模式 */}
        <AddChargerDialog 
          open={editDialogOpen} 
          onClose={() => setEditDialogOpen(false)} 
          charger={charger} 
          onSave={onSave}
          stations={stations} // 傳遞 stations 數據
        />
      </Box>
    </Card>
  );
}