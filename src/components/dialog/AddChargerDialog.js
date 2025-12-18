"use client";
import React, { useState, useTransition, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, MenuItem, Stack, Alert, CircularProgress, FormControl, InputLabel, Select, Chip, Box, Grid, Paper, Divider, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction } from '@mui/material';
import { createGunAction, updateGunAction } from '../../actions/gunActions';
import { getChargingStandards } from '../../actions/chargingStandardActions';
import { getTariffs } from '../../actions/tariffActions';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

/**
 * 充電樁新增/編輯對話框
 * 
 * Props:
 * - open: 是否開啟對話框
 * - onClose: 關閉對話框回調
 * - onAdd: 新增成功回調 (新增模式)
 * - onSave: 更新成功回調 (編輯模式)
 * - stations: 站點資料 (包含電表)
 * - meters: 電表資料 (可選)
 * - charger: 要編輯的充電樁資料，為 null 時為新增模式
 */

export default function AddChargerDialog({ open, onClose, onAdd, onSave, stations, meters, charger = null }) {
  // 判斷是編輯還是新增模式
  const isEditMode = !!charger;
  // 狀態管理
  const [cpid, setCpid] = useState('');
  const [connector, setConnector] = useState('');
  const [cpsn, setCpsn] = useState('');
  const [type, setType] = useState('');
  const [maxPower, setMaxPower] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [selectedTariffs, setSelectedTariffs] = useState([]); // 格式: [{tariffId, priority}]
  const [availableTariffs, setAvailableTariffs] = useState([]);
  const [chargingStandards, setChargingStandards] = useState([]);
  const [selectedChargingStandardId, setSelectedChargingStandardId] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [loadingTariffs, setLoadingTariffs] = useState(false);
  
  // 使用 useTransition 來處理 server action
  const [isPending, startTransition] = useTransition();

  // 載入可用的費率
  useEffect(() => {
    const loadTariffs = async () => {
      if (!open) return;

      setLoadingTariffs(true);
      try {
        // use server action instead of client-side API fetch
        const result = await getTariffs();
        if (result && result.success) {
          setAvailableTariffs(result.data || []);
        } else {
          console.error('Failed to load tariffs', result?.error);
        }
      } catch (error) {
        console.error('Error loading tariffs:', error);
      } finally {
        setLoadingTariffs(false);
      }
    };

    const loadChargingStandards = async () => {
      try {
        // use server action instead of client-side API fetch
        const result = await getChargingStandards();
        if (result && result.success) {
          setChargingStandards(result.data || []);
        } else {
          console.error('Failed to load charging standards', result?.error);
        }
      } catch (e) {
        console.error('Error loading charging standards:', e);
      }
    };

    loadTariffs();
    loadChargingStandards();
  }, [open]);

  // 當編輯模式時，載入現有資料
  useEffect(() => {
    if (isEditMode && charger && open) {
      setCpid(charger.cpid || '');
      setConnector(charger.connector || '');
      setCpsn(charger.cpsn || '');
      setType(charger.acdc || charger.type || '');
      setMaxPower(charger.max_kw ? charger.max_kw.toString() : (charger.maxPower ? charger.maxPower.toString() : ''));
      setDesc(charger.guns_memo1 || charger.desc || '');
      setSelectedMeterId(charger.meter_id ? charger.meter_id.toString() : '');
  setSelectedChargingStandardId(charger.charging_standard_id ? charger.charging_standard_id.toString() : (charger.charging_standard && charger.charging_standard.id ? charger.charging_standard.id.toString() : ''));
      
      // 載入現有的費率配置
      if (charger.gun_tariffs && Array.isArray(charger.gun_tariffs)) {
        const existingTariffs = charger.gun_tariffs.map(gunTariff => ({
          tariffId: gunTariff.tariff_id,
          priority: gunTariff.priority || 1
        }));
        setSelectedTariffs(existingTariffs);
      } else {
        setSelectedTariffs([]);
      }
      
      setSaveError(null);
    } else if (!isEditMode && open) {
      // 新增模式：重置所有欄位
      setCpid('');
      setConnector('');
      setCpsn('');
      setType('');
      setMaxPower('');
      setDesc('');
      setSelectedMeterId('');
  setSelectedChargingStandardId('');
      setSelectedTariffs([]);
      setSaveError(null);
    }
  }, [isEditMode, charger, open]);

  const handleCancel = () => {
    // reset
    setCpid(''); setConnector(''); setCpsn(''); setType(''); setMaxPower(''); setDesc(''); setSelectedMeterId('');
    setSelectedTariffs([]);
    setSaveError(null);
    onClose && onClose();
  };

  // 添加費率到選擇列表
  const addTariff = (tariffId) => {
    if (selectedTariffs.some(item => item.tariffId === tariffId)) return;
    if (selectedTariffs.length >= 3) return; // 最多只能選擇3個費率方案
    
    const newPriority = Math.max(0, ...selectedTariffs.map(item => item.priority)) + 1;
    setSelectedTariffs([...selectedTariffs, { tariffId, priority: newPriority }]);
  };

  // 從選擇列表移除費率
  const removeTariff = (tariffId) => {
    setSelectedTariffs(selectedTariffs.filter(item => item.tariffId !== tariffId));
  };

  // 調整費率優先級
  const adjustPriority = (tariffId, direction) => {
    const currentIndex = selectedTariffs.findIndex(item => item.tariffId === tariffId);
    if (currentIndex === -1) return;

    const newTariffs = [...selectedTariffs];
    const currentItem = newTariffs[currentIndex];
    
    if (direction === 'up' && currentIndex > 0) {
      // 向上移動：與前一個交換優先級
      const prevItem = newTariffs[currentIndex - 1];
      const tempPriority = currentItem.priority;
      currentItem.priority = prevItem.priority;
      prevItem.priority = tempPriority;
      
      // 重新排序數組
      newTariffs.sort((a, b) => a.priority - b.priority);
    } else if (direction === 'down' && currentIndex < newTariffs.length - 1) {
      // 向下移動：與後一個交換優先級
      const nextItem = newTariffs[currentIndex + 1];
      const tempPriority = currentItem.priority;
      currentItem.priority = nextItem.priority;
      nextItem.priority = tempPriority;
      
      // 重新排序數組
      newTariffs.sort((a, b) => a.priority - b.priority);
    }
    
    setSelectedTariffs(newTariffs);
  };

  const handleConfirm = async () => {
    setSaveError(null);
    
    // 編輯模式的驗證
    if (isEditMode) {
      if (!charger || !charger.id) {
        setSaveError('找不到充電樁資料');
        return;
      }
    } else {
      // 新增模式的驗證：必須選擇電表
      if (!selectedMeterId) {
        setSaveError('請選擇電表');
        return;
      }
      
      // 驗證所選電表是否存在
      const selectedMeterExists = stations && stations.some(station => 
        station.meters && station.meters.some(meter => meter.id.toString() === selectedMeterId.toString())
      );
      
      if (!selectedMeterExists) {
        setSaveError('找不到對應的電表，請重新選擇');
        return;
      }
    }
    
    startTransition(async () => {
      try {
        const formData = new FormData();
        
        if (isEditMode) {
          // 編輯模式：使用 updateGunAction
          formData.append('id', charger.id.toString());
          formData.append('cpid', cpid);
          formData.append('connector', connector);
          formData.append('cpsn', cpsn);
          formData.append('acdc', type);
          if (maxPower) formData.append('max_kw', maxPower);
          formData.append('guns_memo1', desc);
          
          // 編輯模式也支持費率配置更新
          if (selectedTariffs.length > 0) {
            const tariffData = selectedTariffs.map(item => ({
              tariffId: item.tariffId,
              priority: item.priority
            }));
            formData.append('tariff_data', JSON.stringify(tariffData));
          } else {
            // 如果沒有選擇費率，發送空數組來清除現有配置
            formData.append('tariff_data', JSON.stringify([]));
          }
          // 編輯模式也可以更新充電標準
          if (selectedChargingStandardId) formData.append('charging_standard_id', selectedChargingStandardId);
          
          const result = await updateGunAction(formData);
          
          if (result.success) {
            // 成功：通知父組件並關閉對話框
            if (onSave) onSave(result.data);
            else console.log('EditChargerDialog submit', result.data);
            
            handleCancel(); // 重置表單並關閉
          } else {
            setSaveError(result.error || '更新充電樁失敗');
          }
        } else {
          // 新增模式：使用 createGunAction
          if (cpid) formData.append('cpid', cpid);
          if (connector) formData.append('connector', connector);
          if (cpsn) formData.append('cpsn', cpsn);
          if (type) formData.append('acdc', type);
          if (maxPower) formData.append('max_kw', maxPower);
          if (desc) formData.append('guns_memo1', desc);
          if (selectedMeterId) formData.append('meter_id', selectedMeterId);
          
          // 添加選中的費率（包含優先級）
          if (selectedTariffs.length > 0) {
            const tariffData = selectedTariffs.map(item => ({
              tariffId: item.tariffId,
              priority: item.priority
            }));
            formData.append('tariff_data', JSON.stringify(tariffData));
          }
          if (selectedChargingStandardId) formData.append('charging_standard_id', selectedChargingStandardId);
          
          const result = await createGunAction(formData);
          
          if (result.success) {
            // 成功：通知父組件並關閉對話框
            if (onAdd) onAdd(result.data);
            else console.log('AddChargerDialog submit', result.data);
            
            handleCancel(); // 重置表單並關閉
          } else {
            setSaveError(result.error || '新增充電樁失敗，請檢查電表是否有效');
          }
        }
        
      } catch (err) {
        console.error('Failed to save charger', err);
        setSaveError(err?.message || (isEditMode ? '更新充電樁失敗' : '新增充電樁失敗，請確認電表選擇是否正確'));
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} sx={{ '& .MuiDialog-paper': { width: '80%' } }}>
      <DialogTitle>{isEditMode ? '編輯充電樁' : '新增充電樁'}</DialogTitle>
      <DialogContent sx={{ height: '80vh', display: 'flex', flexDirection: 'column', pb: 2 }}>
        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            flexGrow: 1, 
            minHeight: 0, 
            width: '100%' 
          }}>
            {/* 左側：基本信息區域 */}
            <Box sx={{ height: '100%', display: 'flex' }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                width: '100%',
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                p: 2
              }}>
                <Typography variant="h6" sx={{ mb: 2 }}>基本信息</Typography>
                <Box sx={{ 
                  flexGrow: 1, 
                  overflowY: 'auto',
                  pr: 1,
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px',
                  }
                }}>
                  <Stack spacing={2.5}>
                    <TextField 
                      label="充電樁編號(CPID)" 
                      value={cpid} 
                      onChange={(e) => setCpid(e.target.value)} 
                      fullWidth 
                      size="medium"
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField 
                      label="Connector(gun)" 
                      value={connector} 
                      onChange={(e) => setConnector(e.target.value)} 
                      fullWidth 
                      size="medium"
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField 
                      label="樁序號(CPSN)" 
                      value={cpsn} 
                      onChange={(e) => setCpsn(e.target.value)} 
                      fullWidth 
                      size="medium"
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField 
                      select 
                      label="電流型態 (AC/DC)" 
                      value={type} 
                      onChange={(e) => setType(e.target.value)} 
                      fullWidth 
                      size="medium"
                      sx={{ bgcolor: 'background.paper' }}
                    >
                      <MenuItem value="">請選擇</MenuItem>
                      <MenuItem value="AC">AC</MenuItem>
                      <MenuItem value="DC">DC</MenuItem>
                    </TextField>
                    <TextField 
                      select 
                      label="關聯電表" 
                      value={selectedMeterId} 
                      onChange={(e) => setSelectedMeterId(e.target.value)} 
                      fullWidth 
                      size="medium"
                      required={!isEditMode}
                      disabled={isEditMode}
                      sx={{ bgcolor: 'background.paper' }}
                    >
                      <MenuItem value="">請選擇電表</MenuItem>
                      {stations && stations.flatMap(station => 
                        station.meters ? station.meters.map((meter) => (
                          <MenuItem key={meter.id} value={meter.id}>
                            {meter.meter_no} (站點: {station.name || station.station_code || '未知'})
                          </MenuItem>
                        )) : []
                      )}
                    </TextField>
                    <TextField
                      select
                      label="充電標準"
                      value={selectedChargingStandardId}
                      onChange={(e) => setSelectedChargingStandardId(e.target.value)}
                      fullWidth
                      size="medium"
                      sx={{ bgcolor: 'background.paper', mt: 1 }}
                    >
                      <MenuItem value="">無</MenuItem>
                      {chargingStandards.map((std) => (
                        <MenuItem key={std.id} value={String(std.id)}>
                          {std.name} {std.code ? `(${std.code})` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField 
                      label="最大功率 (kW)" 
                      type="number" 
                      value={maxPower} 
                      onChange={(e) => setMaxPower(e.target.value)} 
                      fullWidth 
                      size="medium"
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField 
                      label="描述(desc)" 
                      value={desc} 
                      onChange={(e) => setDesc(e.target.value)} 
                      multiline 
                      rows={3} 
                      fullWidth 
                      size="medium"
                      sx={{ bgcolor: 'background.paper' }}
                    />
                  </Stack>
                </Box>
              </Box>
            </Box>

            {/* 右側：費率選擇區域 - 新增和編輯模式都顯示 */}
            <Box sx={{ height: '100%', display: 'flex' }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                width: '100%',
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                p: 2
              }}>
                <Typography variant="h6" sx={{ mb: 0.5 }}>費率方案配置</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  選擇適用於此充電樁的費率方案（最多3個）。點擊費率項目進行選擇，優先級數字越小，優先級越高。
                </Typography>
                
                <Box sx={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
                  <Box sx={{ flexGrow: 1, width: '100%' }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      可用費率方案 {selectedTariffs.length > 0 && `(已選 ${selectedTariffs.length}/3 個)`}
                      {loadingTariffs && <CircularProgress size={16} />}
                    </Typography>
                    <Box sx={{ 
                      flexGrow: 1, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 1,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      height: 'calc(100% - 40px)'
                    }}>
                      <Box sx={{ 
                        flexGrow: 1, 
                        overflowY: 'auto',
                        '&::-webkit-scrollbar': {
                          width: '8px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: 'rgba(0,0,0,0.2)',
                          borderRadius: '4px',
                        }
                      }}>
                        {loadingTariffs ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                          </Box>
                        ) : availableTariffs.length === 0 ? (
                          <Box sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">無可用費率方案</Typography>
                          </Box>
                        ) : (
                          <List dense disablePadding>
                            {availableTariffs.map((tariff) => {
                              const selectedItem = selectedTariffs.find(item => item.tariffId === tariff.id);
                              const isSelected = !!selectedItem;
                              const priorityIndex = selectedItem ? selectedTariffs.sort((a, b) => a.priority - b.priority).findIndex(item => item.tariffId === tariff.id) : -1;
                              
                              return (
                                <ListItem key={tariff.id} sx={{ 
                                  '&:hover': { backgroundColor: 'action.hover' },
                                  backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
                                  border: isSelected ? '1px solid rgba(25, 118, 210, 0.3)' : '1px solid transparent',
                                  py: 1,
                                  my: 0.5,
                                  mx: 1,
                                  borderRadius: 1
                                }}>
                                  <ListItemText
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                        {isSelected && (
                                          <Chip 
                                            label={`優先級 ${priorityIndex + 1}`} 
                                            size="small" 
                                            color={priorityIndex === 0 ? "primary" : "default"}
                                            variant={priorityIndex === 0 ? "filled" : "outlined"}
                                          />
                                        )}
                                        <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: isSelected ? '80px' : '120px' }}>
                                          {tariff.name}
                                        </Typography>
                                        <Chip 
                                          label={tariff.tariff_type} 
                                          size="small" 
                                          variant="outlined"
                                          color={tariff.is_default ? "primary" : "default"}
                                        />
                                        {tariff.is_default && (
                                          <Chip label="預設" size="small" color="success" variant="filled" />
                                        )}
                                        {priorityIndex === 0 && (
                                          <Typography variant="caption" color="primary" fontWeight="bold">
                                            (主要費率)
                                          </Typography>
                                        )}
                                      </Box>
                                    }
                                    secondary={
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        基本價格: ${Number(tariff.base_price).toFixed(2)}/kWh
                                      </Typography>
                                    }
                                    sx={{ m: 0 }}
                                  />
                                  <ListItemSecondaryAction>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                      {isSelected && (
                                        <>
                                          <IconButton 
                                            size="small"
                                            onClick={() => adjustPriority(tariff.id, 'up')}
                                            disabled={priorityIndex === 0}
                                            title="提高優先級"
                                          >
                                            <ArrowUpwardIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton 
                                            size="small"
                                            onClick={() => adjustPriority(tariff.id, 'down')}
                                            disabled={priorityIndex === selectedTariffs.length - 1}
                                            title="降低優先級"
                                          >
                                            <ArrowDownwardIcon fontSize="small" />
                                          </IconButton>
                                        </>
                                      )}
                                      <IconButton 
                                        edge="end" 
                                        onClick={() => isSelected ? removeTariff(tariff.id) : addTariff(tariff.id)}
                                        color={isSelected ? "error" : "primary"}
                                        size="small"
                                        title={isSelected ? "移除費率" : selectedTariffs.length >= 3 ? "已達最大選擇數量(3個)" : "新增費率"}
                                        disabled={!isSelected && selectedTariffs.length >= 3}
                                      >
                                        {isSelected ? <RemoveIcon /> : <AddIcon />}
                                      </IconButton>
                                    </Box>
                                  </ListItemSecondaryAction>
                                </ListItem>
                              );
                            })}
                          </List>
                        )}
                      </Box>
                    </Box>
                    {selectedTariffs.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                        💡 提示：優先級數字越小，費率優先級越高。已選擇 {selectedTariffs.length}/3 個費率方案
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleCancel} variant="outlined">取消</Button>
        <Button onClick={handleConfirm} variant="contained" color="success" disabled={isPending}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : (isEditMode ? '確定更新' : '確定新增')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
