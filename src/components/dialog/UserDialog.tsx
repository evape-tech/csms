import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';

interface User {
  id: number;
  uuid?: string;
  email: string;
  password?: string;
  role: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  date_of_birth?: string;
  email_verified?: boolean;
  account_status?: string;
  last_login_at?: string;
  login_count?: number;
  failed_login_attempts?: number;
  lockout_until?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: globalThis.FormData) => Promise<void>;
  editingUser: User | null;
}

export default function UserDialog({
  open,
  onClose,
  onSubmit,
  editingUser
}: UserDialogProps) {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {editingUser ? '編輯用戶' : '新增用戶'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="名"
            name="first_name"
            fullWidth
            defaultValue={editingUser?.first_name || ''}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            label="姓"
            name="last_name"
            fullWidth
            defaultValue={editingUser?.last_name || ''}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Email"
            name="email"
            type="email"
            fullWidth
            defaultValue={editingUser?.email || ''}
            required
            sx={{ mb: 2 }}
          />
          {!editingUser && (
            <TextField
              margin="dense"
              label="密碼"
              name="password"
              type="password"
              fullWidth
              required
              sx={{ mb: 2 }}
            />
          )}
          <TextField
            margin="dense"
            label="電話"
            name="phone"
            fullWidth
            defaultValue={editingUser?.phone || ''}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="生日"
            name="date_of_birth"
            type="date"
            fullWidth
            defaultValue={editingUser?.date_of_birth ? editingUser.date_of_birth.split('T')[0] : ''}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel id="role-label">權限</InputLabel>
            <Select
              labelId="role-label"
              name="role"
              defaultValue={editingUser?.role || 'user'}
              label="權限"
              required
            >
              <MenuItem value="admin">管理員</MenuItem>
              <MenuItem value="user">一般用戶</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel id="account-status-label">帳戶狀態</InputLabel>
            <Select
              labelId="account-status-label"
              name="account_status"
              defaultValue={editingUser?.account_status || 'ACTIVE'}
              label="帳戶狀態"
            >
              <MenuItem value="ACTIVE">啟用</MenuItem>
              <MenuItem value="SUSPENDED">暫停</MenuItem>
              <MenuItem value="BLOCKED">封鎖</MenuItem>
              <MenuItem value="PENDING">待審核</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" sx={{ mb: 1 }}>
            <InputLabel id="email-verified-label">Email驗證狀態</InputLabel>
            <Select
              labelId="email-verified-label"
              name="email_verified"
              defaultValue={editingUser?.email_verified ? 'true' : 'false'}
              label="Email驗證狀態"
            >
              <MenuItem value="true">已驗證</MenuItem>
              <MenuItem value="false">未驗證</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button type="submit" variant="contained">
            {editingUser ? '更新' : '新增'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
