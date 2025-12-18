 'use client';
import React, { useState } from 'react';
 import {
   Box,
   Card,
   CardContent,
   CardHeader,
   Chip,
   Typography
 } from '@mui/material';
 import InfoIcon from '@mui/icons-material/Info';

export function EnvironmentConfigCard({
  environment,
  frontendUrl,
  backendUrl,
}: {
  environment: string;
  frontendUrl: string;
  backendUrl: string;
}) {
  // client side toggle
  const [visible, setVisible] = useState(true);

  // 只在開發環境顯示此組件（build-time NODE_ENV 或傳入的 environment）
  const isDev = (process.env.NODE_ENV === 'development') || environment === 'development';
  if (!isDev) return null;

   const envColor = environment === 'production' ? 'error' : 'warning';

  return (
     <Card sx={{ mb: 2, backgroundColor: '#f5f5f5' }}>
       <CardHeader
         title="🔧 環境配置 - 診斷"
         avatar={<InfoIcon />}
         subheader={`環境: ${environment.toUpperCase()}`}
       />
       <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>環境:</Typography>
          <Chip label={environment.toUpperCase()} color={envColor as any} />
          <Box sx={{ marginLeft: 'auto' }}>
            <button
              onClick={() => setVisible(!visible)}
              style={{ padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
            >
              {visible ? '隱藏' : '顯示'}
            </button>
          </Box>
        </Box>

        <Box sx={{ mb: 1 }}>
           <Typography variant="subtitle2">🔗 TAPPAY_FRONTEND_REDIRECT_URL</Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}><code>{visible ? frontendUrl : '已隱藏'}</code></Typography>
         </Box>

        <Box sx={{ mb: 1 }}>
           <Typography variant="subtitle2">🔗 TAPPAY_BACKEND_NOTIFY_URL</Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}><code>{visible ? backendUrl : '已隱藏'}</code></Typography>
         </Box>
       </CardContent>
     </Card>
   );
 }
