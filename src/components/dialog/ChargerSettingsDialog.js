import React, { useState, useEffect, useTransition } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField, MenuItem, Stack, Alert, CircularProgress } from '@mui/material';
import { updateGunAction } from '../../actions/gunActions';

export default function ChargerSettingsDialog({ open, onClose, charger, onSave }) {
  const [cpid, setCpid] = useState('');
  const [cpsn, setCpsn] = useState('');
  const [type, setType] = useState('');
  const [maxPower, setMaxPower] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState(null);
  
  // 使用 useTransition 來處理 server action
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (charger) {
      setCpid(charger.cpid ?? '');
      setCpsn(charger.cpsn ?? '');
      setType(charger.type ?? charger.ACDC ?? '');
      // normalize maxPower if stored as number in kW or watts
      setMaxPower(charger.maxPower ?? charger.max_kw ?? (charger.power ? Number((charger.power/1000).toFixed(1)) : ''));
      setDesc(charger.desc ?? '');
      setError(null);
    }
  }, [charger, open]);

  const handleCancel = () => {
    setError(null);
    onClose && onClose();
  };

  const handleSave = async () => {
    if (!charger || !charger.id) return;
    
    setError(null);
    
    startTransition(async () => {
      try {
        // 建立 FormData
        const formData = new FormData();
        formData.append('id', charger.id);
        formData.append('cpid', cpid || '');
        formData.append('cpsn', cpsn || '');
        formData.append('acdc', type || '');
        if (maxPower) formData.append('max_kw', maxPower);
        formData.append('guns_memo1', desc || '');
        
        // 呼叫 server action
        const result = await updateGunAction(formData);
        
        if (result.success) {
          // 成功：建立回傳給 onSave 的 updated 物件
          const updatedData = {
            id: charger.id,
            ...charger,
            cpid: cpid || null,
            cpsn: cpsn || null,
            type: type || null,
            acdc: type || null,
            maxPower: maxPower ? Number(maxPower) : null,
            max_kw: maxPower ? Number(maxPower) : null,
            desc: desc || null,
            guns_memo1: desc || null,
            updatedAt: new Date().toISOString(),
          };
          
          if (onSave) onSave(updatedData);
          onClose && onClose();
        } else {
          // 失敗：顯示錯誤訊息
          setError(result.error);
        }
        
      } catch (err) {
        console.error('Failed to update charger', err);
        setError(err?.message || '更新失敗');
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>充電樁設置</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="充電樁編號 (CPID)" value={cpid} onChange={(e) => setCpid(e.target.value)} fullWidth />
          <TextField label="樁序號 (CPSN)" value={cpsn} onChange={(e) => setCpsn(e.target.value)} fullWidth />
          <TextField select label="電流型態" value={type} onChange={(e) => setType(e.target.value)} fullWidth>
            <MenuItem value="">請選擇</MenuItem>
            <MenuItem value="AC">AC</MenuItem>
            <MenuItem value="DC">DC</MenuItem>
          </TextField>
          <TextField label="最大功率 (kW)" type="number" value={maxPower} onChange={(e) => setMaxPower(e.target.value)} fullWidth />
          <TextField label="描述" value={desc} onChange={(e) => setDesc(e.target.value)} multiline rows={3} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleCancel} variant="outlined">取消</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={isPending}>
          {isPending ? <CircularProgress size={18} color="inherit" /> : '儲存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
