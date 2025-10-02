"use client";
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Stack,
  CircularProgress
} from '@mui/material';

const typeOptions = [
  { label: '例行維護', value: 'ROUTINE' },
  { label: '故障維修', value: 'REPAIR' },
  { label: '設備升級', value: 'UPGRADE' },
  { label: '檢查', value: 'INSPECTION' },
  { label: '清潔', value: 'CLEANING' },
  { label: '其他', value: 'OTHER' },
];

const priorityOptions = [
  { label: '低', value: 'LOW' },
  { label: '一般', value: 'NORMAL' },
  { label: '高', value: 'HIGH' },
  { label: '緊急', value: 'URGENT' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate?: (record: any) => void;
}

export default function CreateMaintenanceDialog({ open, onClose, onCreate }: Props) {
  const [cpid, setCpid] = useState('');
  const [cpsn, setCpsn] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('ROUTINE');
  const [priority, setPriority] = useState('NORMAL');
  const [description, setDescription] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [cpOptions, setCpOptions] = useState<Array<{ cpid: string; cpsn: string }>>([]);
  const [technicianOptions, setTechnicianOptions] = useState<Array<{ value: string; label: string; description?: string }>>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadOptions = async () => {
      setOptionsLoading(true);
      setOptionsError(null);

      try {
        const [cpRes, techRes] = await Promise.all([
          fetch('/api/guns', { cache: 'no-store' }),
          fetch('/api/users?role=admin', { cache: 'no-store' })
        ]);

        if (!cancelled) {
          if (!cpRes.ok) {
            throw new Error('充電設備資料載入失敗');
          }

          const cpData = await cpRes.json();
          const cpList = Array.isArray(cpData)
            ? cpData
                .map((item) => ({
                  cpid: item?.cpid ?? '',
                  cpsn: item?.cpsn ?? ''
                }))
                .filter((item) => item.cpid || item.cpsn)
            : [];
          setCpOptions(cpList);

          if (!techRes.ok) {
            if (techRes.status === 403) {
              throw new Error('無法載入維護人員名單，請確認權限');
            }
            throw new Error('維護人員資料載入失敗');
          }

          const techJson = await techRes.json();
          const techData = Array.isArray(techJson?.data) ? techJson.data : [];
          const techOptions = techData
            .filter((user: any) => user && (user.first_name || user.last_name || user.email || user.uuid))
            .map((user: any) => {
              const uuid = typeof user.uuid === 'string' && user.uuid.length > 0 ? user.uuid : '';
              if (!uuid) return null;
              const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
              const label = fullName || user.email || `管理員 #${user.id}`;
              return {
                value: uuid,
                label,
                description: user.email || undefined
              };
            })
            .filter((option: any) => Boolean(option && option.value)) as Array<{
              value: string;
              label: string;
              description?: string;
            }>;

          setTechnicianOptions(techOptions);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Load maintenance dialog options error', err);
          setOptionsError(err.message || '載入選項失敗');
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const cpidOptions = useMemo(() => {
    const unique = new Set<string>();
    cpOptions.forEach((item) => {
      if (item.cpid) {
        unique.add(item.cpid);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [cpOptions]);

  const cpsnOptions = useMemo(() => {
    const filtered = cpOptions
      .filter((item) => {
        if (!item.cpsn) return false;
        if (!cpid) return true;
        return item.cpid === cpid;
      })
      .map((item) => item.cpsn);

    return Array.from(new Set(filtered)).sort((a, b) => a.localeCompare(b));
  }, [cpOptions, cpid]);

  useEffect(() => {
    if (!cpsn) return;
    if (!cpsnOptions.includes(cpsn)) {
      setCpsn('');
    }
  }, [cpsn, cpsnOptions]);

  useEffect(() => {
    if (!technicianId) return;
    if (!technicianOptions.some((option) => option.value === technicianId)) {
      setTechnicianId('');
    }
  }, [technicianId, technicianOptions]);

  const handleCreate = async () => {
    setError(null);
    if (!cpid) return setError('請填寫 CPID');

    setLoading(true);
    try {
      const body: any = {
        cpid,
        cpsn,
        maintenance_type: maintenanceType,
        priority,
        description,
        technician_id: technicianId || null,
        technician_name:
          technicianOptions.find((option) => option.value === technicianId)?.label || null,
      };

      const res = await fetch('/api/maintenance-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
  onCreate && onCreate(data.data);
        onClose();
      } else {
        setError(data.message || '建立失敗');
      }
    } catch (err: any) {
      console.error('Create maintenance error', err);
      setError(err.message || '建立失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>建立維護工單</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="CPID"
            value={cpid}
            onChange={(e) => setCpid(e.target.value)}
            fullWidth
            size="small"
            disabled={optionsLoading}
            helperText={cpid ? undefined : '請選擇充電樁編號'}
          >
            {cpidOptions.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="CPSN"
            value={cpsn}
            onChange={(e) => setCpsn(e.target.value)}
            fullWidth
            size="small"
            disabled={optionsLoading || (!cpid && cpsnOptions.length === 0)}
            helperText={cpsnOptions.length === 0 ? '請先選擇 CPID' : undefined}
          >
            {cpsnOptions.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="維護類型"
            value={maintenanceType}
            onChange={(e) => setMaintenanceType(e.target.value)}
            fullWidth
            size="small"
          >
            {typeOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="優先度"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            fullWidth
            size="small"
          >
            {priorityOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="說明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            size="small"
          />

          <TextField
            select
            label="維護人員"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            fullWidth
            size="small"
            disabled={optionsLoading}
            helperText={technicianId ? undefined : '請選擇維護人員'}
          >
            {technicianOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{option.label}</span>
                  {option.description && (
                    <span style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.54)' }}>
                      {option.description}
                    </span>
                  )}
                </Box>
              </MenuItem>
            ))}
          </TextField>


          {error && (
            <Box sx={{ color: 'error.main', fontSize: '0.85rem' }}>{error}</Box>
          )}
          {optionsError && (
            <Box sx={{ color: 'error.main', fontSize: '0.85rem' }}>{optionsError}</Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>取消</Button>
        <Button onClick={handleCreate} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={18} /> : '建立'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
