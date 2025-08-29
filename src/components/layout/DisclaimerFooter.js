import React from 'react';
import { Typography, Box } from '@mui/material';

export default function DisclaimerFooter() {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        zIndex: 1000,
        py: 2,
        px: 3
      }}
    >
      
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        * 本頁所有數據僅為範例，實際可串接 API 或資料庫取得。
      </Typography>
    </Box>
  );
} 