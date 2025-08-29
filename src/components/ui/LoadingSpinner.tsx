"use client";
import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  minHeight?: string;
  showImmediately?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = '載入中...', 
  size = 48, 
  minHeight = '60vh',
  showImmediately = false 
}) => {
  const [visible, setVisible] = React.useState(showImmediately);

  React.useEffect(() => {
    if (!showImmediately) {
      // 使用更短的延遲來快速顯示 loading 狀態
      const timer = setTimeout(() => setVisible(true), 16); // 約一個渲染幀
      return () => clearTimeout(timer);
    }
  }, [showImmediately]);

  if (!visible && !showImmediately) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight,
        }}
      >
        {/* 佔位符，防止佈局跳動 */}
        <div style={{ height: size + 20 }} />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight,
        gap: 2
      }}
    >
      <CircularProgress size={size} />
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingSpinner;
