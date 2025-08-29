"use client";
import React, { useState, useTransition } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, MenuItem, Stack, Alert, CircularProgress } from '@mui/material';
import { createGunAction } from '../../actions/gunActions';

export default function AddChargerDialog({ open, onClose, onAdd }) {
  // 狀態管理
  const [cpid, setCpid] = useState('');
  const [connector, setConnector] = useState('');
  const [cpsn, setCpsn] = useState('');
  const [type, setType] = useState('');
  const [maxPower, setMaxPower] = useState('');
  const [desc, setDesc] = useState('');
  const [saveError, setSaveError] = useState(null);
  
  // 使用 useTransition 來處理 server action
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    // reset
    setCpid(''); setConnector(''); setCpsn(''); setType(''); setMaxPower(''); setDesc('');
    setSaveError(null);
    onClose && onClose();
  };

  const handleConfirm = async () => {
    setSaveError(null);
    
    startTransition(async () => {
      try {
        // 建立 FormData
        const formData = new FormData();
        if (cpid) formData.append('cpid', cpid);
        if (connector) formData.append('connector', connector);
        if (cpsn) formData.append('cpsn', cpsn);
        if (type) formData.append('acdc', type);
        if (maxPower) formData.append('max_kw', maxPower);
        if (desc) formData.append('guns_memo1', desc);
        
        // 呼叫 server action
        const result = await createGunAction(formData);
        
        if (result.success) {
          // 成功：通知父組件並關閉對話框
          if (onAdd) onAdd(result.data);
          else console.log('AddChargerDialog submit', result.data);
          
          handleCancel(); // 重置表單並關閉
        } else {
          // 失敗：顯示錯誤訊息
          setSaveError(result.error);
        }
        
      } catch (err) {
        console.error('Failed to save charger', err);
        setSaveError(err?.message || '儲存失敗');
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>新增充電樁</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <TextField label="充電樁編號(CPID)" value={cpid} onChange={(e) => setCpid(e.target.value)} fullWidth />
          <TextField label="Connector(gun)" value={connector} onChange={(e) => setConnector(e.target.value)} fullWidth />
          <TextField label="樁序號(CPSN)" value={cpsn} onChange={(e) => setCpsn(e.target.value)} fullWidth />
          <TextField select label="電流型態 (AC/DC)" value={type} onChange={(e) => setType(e.target.value)} fullWidth>
            <MenuItem value="">請選擇</MenuItem>
            <MenuItem value="AC">AC</MenuItem>
            <MenuItem value="DC">DC</MenuItem>
          </TextField>
          <TextField label="最大功率 (kW)" type="number" value={maxPower} onChange={(e) => setMaxPower(e.target.value)} fullWidth />
          <TextField label="描述(desc)" value={desc} onChange={(e) => setDesc(e.target.value)} multiline rows={4} fullWidth />
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
