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
  email: string;
  password?: string;
  role: string;
  name?: string;
  account?: string;
  phone?: string;
  status?: string;
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
            label="姓名"
            name="name"
            fullWidth
            defaultValue={editingUser?.name || ''}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            label="帳號"
            name="account"
            fullWidth
            defaultValue={editingUser?.account || ''}
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
          <FormControl fullWidth margin="dense" sx={{ mb: 1 }}>
            <InputLabel id="status-label">狀態</InputLabel>
            <Select
              labelId="status-label"
              name="status"
              defaultValue={editingUser?.status || 'active'}
              label="狀態"
            >
              <MenuItem value="active">啟用</MenuItem>
              <MenuItem value="disabled">停用</MenuItem>
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
