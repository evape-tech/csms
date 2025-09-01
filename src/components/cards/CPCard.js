"use client";
import React, { useState, useEffect, useTransition } from 'react';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
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
  useTheme
} from '@mui/material';
import PowerIcon from '@mui/icons-material/Power';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { AddChargerDialog, ChargerSettingsDialog } from '../dialog';
import { deleteGunAction } from '../../actions/gunActions';

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

export default function CPCard({ chargers }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [viewMode, setViewMode] = useState('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  // 使用 useTransition 來處理 server action
  const [isPendingDelete, startDeleteTransition] = useTransition();
  // normalize incoming charger objects to consistent shape used by this component
  const normalizeCharger = (c) => ({
    id: c.id,
    cpid: c.cpid ?? c.CPID ?? null,
    cpsn: c.cpsn ?? c.CPSN ?? null,
    // status field in DB is `guns_status`
    status: c.guns_status ?? c.status ?? c.gunsStatus ?? null,
    // AC/DC field
    type: (c.type ?? c.acdc ?? c.ACDC ?? null),
    // max power in kW
    max_kw: c.max_kw ?? c.maxPower ?? (c.power ? Math.round(c.power / 1000) : null),
    // description mapping: guns_memo1 is 備註/描述
    desc: c.guns_memo1 ?? c.desc ?? c.memo ?? null,
    // keep original values available
    ...c
  });

  const [localChargers, setLocalChargers] = useState((chargers || []).map(normalizeCharger));

  useEffect(() => {
    setLocalChargers((chargers || []).map(normalizeCharger));
  }, [chargers]);

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

  // 操作處理函數（直接傳給CPCardItem）
  const handleStartCharging = async (id) => {
    const charger = localChargers.find(c => c.id === id);
    if (!charger) return alert('找不到充電樁資料');
    if (!charger.cpid) return alert('此充電樁沒有 CPID，無法發送 OCPP 指令');

    setActionLoading(s => ({ ...s, [id]: true }));
    try {
      // build remote start body inline (do not use shared builder per request)
      const body = {
        apikey: undefined,
        cmd: 'cmd_start_charging',
        cp_id: charger.cpid,
      };
      await callOcppEndpoint(id, body);

      // optimistic update: set status to Charging
      setLocalChargers(prev => prev.map(c => (c.id === id ? { ...c, status: 'Charging' } : c)));
    } catch (err) {
      console.error('Start charging failed', err);
      alert('啟動指令失敗: ' + (err?.message || err));
    } finally {
      setActionLoading(s => ({ ...s, [id]: false }));
    }
  };

  const handleStopCharging = async (id) => {
    const charger = localChargers.find(c => c.id === id);
    if (!charger) return alert('找不到充電樁資料');
    if (!charger.cpid) return alert('此充電樁沒有 CPID，無法發送 OCPP 指令');

    setActionLoading(s => ({ ...s, [id]: true }));
    try {
      const body = {
        apikey: undefined,
        cmd: 'cmd_stop_charging',
        cp_id: charger.cpid,
      };
      await callOcppEndpoint(id, body);

      // optimistic update: set status to Available
      setLocalChargers(prev => prev.map(c => (c.id === id ? { ...c, status: 'Available' } : c)));
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
          setLocalChargers(prev => prev.filter(c => c.id !== id));
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
    setLocalChargers(prev => prev.map(c => (c.id === updated.id ? { ...c, ...updated } : c)));
  };

  const handleRestart = id => console.log('重啟充電樁:', id);
  const handleSettings = id => console.log('設定充電樁:', id);

  // 篩選充電樁
  const filteredChargers = (localChargers || []).filter(charger => {
    const matchesStatus = statusFilter === 'all' || charger.status === statusFilter;
    const matchesType = typeFilter === 'all' || charger.type === typeFilter;
    const matchesSearch = searchTerm === '' || 
      `CP-${String(charger.id).padStart(2, '0')}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (charger.user && charger.user.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesType && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'id') return a.id - b.id;
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    if (sortBy === 'power') return b.power - a.power;
    return 0;
  });

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
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {filterFields.map((field, idx) => (
              <Grid item size={{ xs: 12, sm: idx === 2 ? 2 : 2 }} key={field.label}>
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
              </Grid>
            ))}
            {/* 搜尋框 */}
            <Grid item size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="搜尋充電樁編號"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {/* 視圖切換 */}
            <Grid item size={{ xs: 12, sm: 1 }}>
              <Box display="flex" gap={1}>
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
            </Grid>
            {/* 新增充電樁按鈕 */}
            <Grid item size={{ xs: 12, sm: 2 }} sx={{ textAlign: 'right' }}>
              <Tooltip title="新增充電樁">
                <Box display="flex" justifyContent="flex-end">
                  <Button variant="contained" color="primary" size="medium" onClick={() => setAddDialogOpen(true)}>
                    新增充電樁
                  </Button>
                </Box>
              </Tooltip>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <AddChargerDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
      {/* 充電樁列表 */}
      <Box>
        <Box sx={{
          display: 'flex',
          flexDirection: viewMode === 'card' ? 'row' : 'column',
          flexWrap: viewMode === 'card' ? 'wrap' : 'nowrap',
          gap: 2,
          justifyContent: viewMode === 'card' ? 'flex-start' : undefined
        }}>
          {filteredChargers.map(charger => (
            <Box
              key={charger.id}
              sx={
                viewMode === 'card'
                  ? { width: { xs: '100%', sm: '48%', md: '33.3333%', lg: '24%' }, minWidth: 240, display: 'flex' }
                  : { width: '100%' }
              }
            >
              <CPCardItem
                charger={charger}
                layout={viewMode === 'card' ? 'grid' : 'linear'}
                onStartCharging={handleStartCharging}
                onStopCharging={handleStopCharging}
                onRestart={handleRestart}
                onSettings={handleSettings}
                onDelete={handleDeleteCharger}
                onSave={handleSaveCharger}
                loadingMap={actionLoading}
                isPendingDelete={isPendingDelete}
              />
            </Box>
          ))}
        </Box>
        {filteredChargers.length === 0 && (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              沒有找到符合條件的充電樁
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// 單一充電樁卡片
function CPCardItem({ charger, onStartCharging, onStopCharging, onRestart, onSettings, onDelete, onSave, loadingMap = {}, isPendingDelete = false, layout = 'linear' }) {
   const theme = useTheme();
   const isLinear = layout === 'linear';
   const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
   // 單一充電樁設置Dialog
   const handleSettingsClick = () => {
     setSettingsDialogOpen(true);
   };
   const isActionLoading = Boolean(loadingMap && loadingMap[charger.id]);
   return (
    <Card sx={{
      width: '100%',
      height: isLinear ? 140 : 'auto',
      minHeight: isLinear ? 140 : 160,
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
          onClick={handleSettingsClick}
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

        {/* 設置 Dialog */}
        <ChargerSettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} charger={charger} onSave={onSave} />
      </Box>
    </Card>
  );
}