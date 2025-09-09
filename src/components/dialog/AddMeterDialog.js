"use client";
import React, { useState, useTransition } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, MenuItem, Stack, Alert, CircularProgress } from '@mui/material';
import { createMeterAction } from '../../actions/meterActions';

export default function AddMeterDialog({ open, onClose, onAdd, stations }) {
  // 狀態管理
  const [stationId, setStationId] = useState('');
  const [meterNo, setMeterNo] = useState('');
  const [emsMode, setEmsMode] = useState('static');
  const [maxPowerKw, setMaxPowerKw] = useState('480');
  const [billingMode, setBillingMode] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [saveError, setSaveError] = useState(null);

  // 使用 useTransition 來處理 server action
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    // reset
    setStationId(''); setMeterNo(''); setEmsMode('static'); setMaxPowerKw('480'); setBillingMode(''); setOwnerId('');
    setSaveError(null);
    onClose && onClose();
  };

  const handleConfirm = async () => {
    setSaveError(null);

    // 驗證必填字段
    if (!stationId) {
      setSaveError('請選擇站點');
      return;
    }
    if (!meterNo) {
      setSaveError('請輸入電表編號');
      return;
    }

    startTransition(async () => {
      try {
        // 建立 FormData
        const formData = new FormData();
        formData.append('station_id', stationId);
        formData.append('meter_no', meterNo);
        formData.append('ems_mode', emsMode);
        formData.append('max_power_kw', maxPowerKw);
        if (billingMode) formData.append('billing_mode', billingMode);
        if (ownerId) formData.append('owner_id', ownerId);

        // 呼叫 server action
        const result = await createMeterAction(formData);

        if (result.success) {
          // 成功：通知父組件並關閉對話框
          if (onAdd) onAdd(result.data);
          else console.log('AddMeterDialog submit', result.data);

          handleCancel(); // 重置表單並關閉
        } else {
          // 失敗：顯示錯誤訊息
          setSaveError(result.error);
        }

      } catch (err) {
        console.error('Failed to save meter', err);
        setSaveError(err?.message || '儲存失敗');
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>新增電表</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <TextField
            select
            label="所屬站點"
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            fullWidth
            required
          >
            <MenuItem value="">請選擇站點</MenuItem>
            {stations && stations.map((station) => (
              <MenuItem key={station.id} value={station.id}>
                {station.name} ({station.station_code})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="電表編號"
            value={meterNo}
            onChange={(e) => setMeterNo(e.target.value)}
            fullWidth
            required
            placeholder="例如: METER-001"
          />
          <TextField
            select
            label="EMS模式"
            value={emsMode}
            onChange={(e) => setEmsMode(e.target.value)}
            fullWidth
          >
            <MenuItem value="static">靜態</MenuItem>
            <MenuItem value="dynamic">動態</MenuItem>
          </TextField>
          <TextField
            label="最大功率 (kW)"
            type="number"
            value={maxPowerKw}
            onChange={(e) => setMaxPowerKw(e.target.value)}
            fullWidth
            inputProps={{ min: 0, step: 0.1 }}
          />
          <TextField
            select
            label="計費模式"
            value={billingMode}
            onChange={(e) => setBillingMode(e.target.value)}
            fullWidth
          >
            <MenuItem value="">請選擇</MenuItem>
            <MenuItem value="independent">independent (獨立計費)</MenuItem>
            <MenuItem value="shared">shared (共享計費)</MenuItem>
            <MenuItem value="split">split (分攤計費)</MenuItem>
          </TextField>
          <TextField
            label="業主ID"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            fullWidth
            placeholder="業主識別碼"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleCancel} variant="outlined">取消</Button>
        <Button onClick={handleConfirm} variant="contained" color="success" disabled={isPending}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : '確定新增'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
