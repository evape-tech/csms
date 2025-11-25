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
  Stack,
  Box,
  CircularProgress
} from '@mui/material';

const faultTypeOptions = [
  { label: '電力異常', value: 'POWER_FAILURE' },
  { label: '通訊錯誤', value: 'COMMUNICATION_ERROR' },
  { label: '硬體損壞', value: 'HARDWARE_DAMAGE' },
  { label: '軟體錯誤', value: 'SOFTWARE_ERROR' },
  { label: '過熱保護', value: 'OVERHEAT' },
  { label: '其他', value: 'OTHER' }
];

const severityOptions = [
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
  { label: '重大', value: 'CRITICAL' }
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  reporterId?: string;
  initialData?: {
    cpid?: string | null;
    cpsn?: string | null;
    connector_id?: number | null;
    fault_type?: string | null;
    severity?: string | null;
    description?: string | null;
  };
}

interface GunOption {
  cpid?: string | null;
  cpsn?: string | null;
  connector?: number | null;
}

export default function CreateFaultReportDialog({
  open,
  onClose,
  onSuccess,
  reporterId,
  initialData
}: Props) {
  const [cpOptions, setCpOptions] = useState<GunOption[]>([]);
  const [technicianOptions, setTechnicianOptions] = useState<Array<{ value: string; label: string; description?: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [cpid, setCpid] = useState(initialData?.cpid ?? '');
  const [cpsn, setCpsn] = useState(initialData?.cpsn ?? '');
  const [connectorId, setConnectorId] = useState(
    initialData?.connector_id ? String(initialData.connector_id) : ''
  );
  const [faultType, setFaultType] = useState(initialData?.fault_type ?? 'POWER_FAILURE');
  const [severity, setSeverity] = useState(initialData?.severity ?? 'MEDIUM');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (!open) return;

    setCpid(initialData?.cpid ?? '');
    setCpsn(initialData?.cpsn ?? '');
    setConnectorId(initialData?.connector_id ? String(initialData.connector_id) : '');
    setFaultType(initialData?.fault_type ?? 'POWER_FAILURE');
    setSeverity(initialData?.severity ?? 'MEDIUM');
    setDescription(initialData?.description ?? '');
    setAssignedTo('');
    setError(null);
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [gunsRes, adminsRes] = await Promise.all([
          fetch('/api/guns', { signal: controller.signal }),
          fetch('/api/users?role=admin', {
            signal: controller.signal,
            headers: { 'X-API-Key': 'admin-secret-key' }
          })
        ]);

        if (!gunsRes.ok) throw new Error('無法載入充電樁資料');
        const gunsData = await gunsRes.json();

        if (!adminsRes.ok) {
          if (adminsRes.status === 403) {
            throw new Error('無法載入維護人員名單，請確認權限');
          }
          throw new Error('無法載入維護人員資料');
        }
        const adminsJson = await adminsRes.json();

        if (cancelled) return;

        setCpOptions(
          Array.isArray(gunsData)
            ? gunsData.map((item: any) => ({
                cpid: item?.cpid ?? '',
                cpsn: item?.cpsn ?? '',
                connector: item?.connector ?? item?.connector_id ?? null
              }))
            : []
        );

        const adminOptions = Array.isArray(adminsJson?.data)
          ? adminsJson.data
              .filter((user: any) => user && (user.uuid || user.id))
              .map((user: any) => {
                const uuid = user.uuid || user.id;
                const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
                return {
                  value: uuid,
                  label: fullName || user.email || `管理員 #${user.id}`,
                  description: user.email || undefined
                };
              })
              .filter((opt: any) => opt?.value)
          : [];
        setTechnicianOptions(adminOptions);
      } catch (err: any) {
        if (!cancelled) {
          setOptionsError(err?.message || '資料載入失敗');
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open]);

  const cpidOptions = useMemo(() => {
    return Array.from(new Set(cpOptions.map((item) => item.cpid).filter(Boolean))).sort(
      (a, b) => (a || '').localeCompare(b || '')
    );
  }, [cpOptions]);

  const cpsnOptions = useMemo(() => {
    return cpOptions
      .filter((item) => {
        if (!item.cpsn) return false;
        if (!cpid) return true;
        return item.cpid === cpid;
      })
      .map((item) => item.cpsn)
      .filter(Boolean);
  }, [cpOptions, cpid]);

  const handleSubmit = async () => {
    if (!reporterId) {
      setError('無法識別回報者，請重新登入');
      return;
    }
    if (!cpid) {
    setError('請輸入 CPID');
    return;
  }
  if (!cpsn) {
    setError('請輸入 CPSN');
      return;
    }
    if (!faultType) {
      setError('請輸入故障類型');
      return;
    }
    if (!description.trim()) {
      setError('請輸入故障說明');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, any> = {
        cpid,
        cpsn,
        connector_id: connectorId ? Number(connectorId) : null,
        fault_type: faultType,
        severity,
        description: description.trim(),
        user_id: reporterId,
        assigned_to: assignedTo || null
      };

      const res = await fetch('/api/fault-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || data?.error || '建立故障回報失敗');
      }

      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || '建立故障回報失敗');
      console.error('Create fault report error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>建立故障回報單</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="CPID"
            value={cpid}
            onChange={(e) => setCpid(e.target.value)}
            size="small"
            fullWidth
            disabled={loadingOptions}
            helperText="必填，可輸入或從建議列表選取"
            inputProps={{ list: 'cpid-options' }}
          />
          <Box component="datalist" id="cpid-options">
            {cpidOptions.map((value) => (
              <option key={value || ''} value={value || ''} />
            ))}
          </Box>

          <TextField
            label="CPSN"
            value={cpsn}
            onChange={(e) => setCpsn(e.target.value)}
            size="small"
            fullWidth
            disabled={loadingOptions}
            helperText="必填，可輸入或從建議列表選取"
            inputProps={{ list: 'cpsn-options' }}
          />
          <Box component="datalist" id="cpsn-options">
            {cpsnOptions.map((value) => (
              <option key={value || ''} value={value || ''} />
            ))}
          </Box>

          <TextField
            label="連接器編號"
            value={connectorId}
            onChange={(e) => setConnectorId(e.target.value)}
            size="small"
            fullWidth
            type="number"
            placeholder="例如 1"
          />

          <TextField
            select
            label="故障類型"
            value={faultType}
            onChange={(e) => setFaultType(e.target.value)}
            size="small"
            fullWidth
          >
            {faultTypeOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="嚴重程度"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            size="small"
            fullWidth
          >
            {severityOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="指派維護人員 ID"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            size="small"
            fullWidth
            placeholder="可選填"
          />

          <TextField
            label="故障描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={3}
          />

          <TextField
            select
            label="指派維護人員"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            size="small"
            fullWidth
            disabled={loadingOptions}
            helperText={assignedTo ? undefined : '可選填'}
          >
            <MenuItem value="">
              <em>暫不指派</em>
            </MenuItem>
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
        <Button onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? <CircularProgress size={18} /> : '建立'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

