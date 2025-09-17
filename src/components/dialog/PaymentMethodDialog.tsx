import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
} from '@mui/material';

interface PaymentMethod {
  id: number;
  name: string;
  code?: string;
  status: number;
  config?: any;
  createdAt: string;
  updatedAt: string;
}

interface PaymentMethodDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: globalThis.FormData) => Promise<void>;
  editingChannel: PaymentMethod | null;
}

export default function PaymentMethodDialog({
  open,
  onClose,
  onSubmit,
  editingChannel
}: PaymentMethodDialogProps) {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {editingChannel ? '編輯支付方式' : '新增支付方式'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="支付方式名稱"
            name="name"
            fullWidth
            defaultValue={editingChannel?.name || ''}
            required
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            label="代碼"
            name="code"
            fullWidth
            defaultValue={editingChannel?.code || ''}
            required
            helperText="唯一識別碼，用於系統內部識別"
            disabled={!!editingChannel}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            margin="dense"
            label="狀態"
            name="status"
            fullWidth
            defaultValue={editingChannel?.status || 1}
            sx={{ mb: 1 }}
          >
            <MenuItem value={1}>啟用</MenuItem>
            <MenuItem value={0}>停用</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button type="submit" variant="contained">
            {editingChannel ? '更新' : '新增'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
