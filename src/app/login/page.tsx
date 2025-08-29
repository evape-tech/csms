"use client";
import React, { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Typography, Box, TextField, Button, Alert, CircularProgress, Avatar, FormControlLabel, Checkbox, Divider, Stack } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { loginAction } from '../../actions/authActions';

export default function LoginPage() {
  const searchParams = useSearchParams();
  // 預設填入測試帳號密碼
  const [email, setEmail] = useState('evape@gmail.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState<string | null>(null);
  
  // 使用 useTransition 來處理 server action
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);
        
        // 從 URL 參數取得重定向路徑
        const next = searchParams.get('next') || '/dashboard';
        formData.append('next', next);
        
        const result = await loginAction(formData);
        
        // 如果有錯誤，顯示錯誤訊息
        if (result && !result.success) {
          setError(result.error);
        }
        // 如果成功，server action 會自動重定向，不需要額外處理
        
      } catch (err: unknown) {
        console.error('Login failed', err);
        const errorMessage = err instanceof Error ? err.message : '登入失敗';
        setError(errorMessage);
      }
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'transparent', p: 0 }}>
      {/* Two-column card: left for branding/image, right for login form. Left is hidden on small screens. */}
      <Card sx={{ width: '100%', maxWidth: 1000, display: 'flex', boxShadow: 3, borderRadius: 3, mx: 2 }}>
        {/* Left panel: branding / gorilla image placeholder */}
        <Box
          sx={{
            flex: 1,
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #dbe86f 0%, #e0a83a 100%)',
            borderRadius: '8px 0 0 8px',
            p: 4,
            minWidth: 360,
          }}
        >
          <img 
            src="/logo-C5OQK4Wr.svg" 
            alt="EMS Logo" 
            style={{
              width: '80%',
              maxWidth: 420,
              height: 'auto',
              borderRadius: 8,
            }}
          />
        </Box>

        {/* Right panel: login form */}
        <Box sx={{ flex: 1, p: { xs: 3, md: 6 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 420 }}>
            <Stack spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                <LockOutlinedIcon />
              </Avatar>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
                EMS 能源管理系統
              </Typography>
              <Typography variant="body2" color="text.secondary">請使用您的帳號登入以存取系統</Typography>
            </Stack>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth autoFocus />
              <TextField label="密碼" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />

              {/* Quick-fill button for default credentials */}
              <Button variant="text" onClick={() => { setEmail('evape@gmail.com'); setPassword('123456'); }} sx={{ alignSelf: 'flex-end' }}>
                使用範例帳密
              </Button>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormControlLabel control={<Checkbox />} label="記住我" />
                <a href="#" style={{ fontSize: 14 }}>忘記密碼？</a>
              </Box>

              <Button type="submit" variant="contained" color="primary" disabled={isPending} fullWidth sx={{ py: 1.25 }}>
                {isPending ? <CircularProgress size={18} color="inherit" /> : '登入'}
              </Button>

              <Divider sx={{ my: 1 }}>或</Divider>

              <Button variant="outlined" fullWidth startIcon={<LockOutlinedIcon />}>
                使用其他方式登入
              </Button>
            </Box>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
