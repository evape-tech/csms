import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Typography
} from '@mui/material';

interface Props {
  open: boolean;
  reportId?: number | null;
  initialValue?: string | null;
  title?: string;
  onClose: () => void;
  onConfirm: (resolution: string) => Promise<void> | void;
}

export default function ResolutionDialog({
  open,
  reportId,
  initialValue,
  title = '輸入解決方案',
  onClose,
  onConfirm
}: Props) {
  const [value, setValue] = useState(initialValue ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? '');
      setSubmitting(false);
    }
  }, [open, initialValue]);

  const handleConfirm = async () => {
    if (!reportId) return;
    setSubmitting(true);
    try {
      await onConfirm(value.trim());
    } catch (err) {
      // onConfirm 可以自行處理錯誤；在此保留以便清理 submitting flag
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => { if (!submitting) onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1 }}>
          請輸入本次處理的解決方案或備註。
        </Typography>
        <TextField
          value={value}
          onChange={(e) => setValue(e.target.value)}
          multiline
          minRows={4}
          maxRows={8}
          fullWidth
          placeholder="例如：更換充電模組、重啟控制器、更新韌體等說明..."
          disabled={submitting}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>取消</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          disabled={submitting || value.trim().length === 0}
          startIcon={submitting ? <CircularProgress size={16} /> : null}
        >
          確認完成
        </Button>
      </DialogActions>
    </Dialog>
  );
}