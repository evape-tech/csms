"use client";
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  OutlinedInput
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonIcon from '@mui/icons-material/Person';

interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  user: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
}

export default function ResetPasswordDialog({ 
  open, 
  onClose, 
  onSubmit, 
  user 
}: ResetPasswordDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    // 驗證密碼
    if (!password || password.length < 6) {
      setError('密碼長度至少需要6個字符');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('密碼確認不匹配');
      setLoading(false);
      return;
    }

    try {
      // 添加用戶ID到表單數據
      formData.append('userId', user?.id || '');
      await onSubmit(formData);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重設密碼失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const displayName = (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : '') ||
    user?.email || '未知用戶';

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        }
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ 
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <LockResetIcon color="primary" />
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              重設用戶密碼
            </Typography>
            <Typography variant="body2" color="text.secondary">
              為用戶設定新的登入密碼
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          
          {/* 用戶資訊顯示 */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'background.default', 
            borderRadius: 2, 
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <PersonIcon color="primary" />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                目標用戶
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
          </Box>

          {/* 新密碼輸入 */}
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel htmlFor="password">新密碼</InputLabel>
            <OutlinedInput
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              label="新密碼"
              required
              autoFocus
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              }
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1 }}>
              密碼長度至少需要6個字符
            </Typography>
          </FormControl>

          {/* 確認密碼 */}
          <FormControl fullWidth margin="dense" sx={{ mb: 1 }}>
            <InputLabel htmlFor="confirmPassword">確認新密碼</InputLabel>
            <OutlinedInput
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              label="確認新密碼"
              required
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={handleClose}
            sx={{ 
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            取消
          </Button>
          <Button 
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ 
              borderRadius: 2,
              px: 4,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            {loading ? '重設中...' : '確認重設'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
