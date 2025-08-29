import React from 'react';
import { Box, Typography } from '@mui/material';
import AnimatedNumber from './AnimatedNumber';

/**
 * CircularProgressWithLabel
 * @param {number} value - 百分比 (0-100)
 * @param {string} label - 標籤文字
 * @param {string} color - 圓環顏色
 * @param {number} quantity - 數量
 * @param {boolean} animated - 是否啟用動畫
 */
export default function CircularProgressWithLabel({ value, label, color, quantity, animated = true }) {
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // 動畫狀態
  const [animatedValue, setAnimatedValue] = React.useState(animated ? 0 : value);
  React.useEffect(() => {
    if (!animated) {
      setAnimatedValue(value);
      return;
    }
    let frame;
    let start;
    const duration = 700; // ms
    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const current = value * progress;
      setAnimatedValue(current);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, animated]);

  const offset = circumference - (animatedValue / 100) * circumference;

  return (
    <Box sx={{ textAlign: 'center', mx: 2 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e0e0e0"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: animated ? 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' : 'none' }}
          />
        </svg>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.8,
            padding: '12px',
            boxSizing: 'border-box',
          }}
        >
          <Typography variant="h5" component="div" sx={{ color: color, fontWeight: 'bold', fontSize: '1.8rem', lineHeight: 1.2 }}>
            <AnimatedNumber value={quantity} />
          </Typography>
          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', fontSize: '1.6rem', lineHeight: 1.2 }}>
            <AnimatedNumber value={Math.round(animatedValue)} />%
          </Typography>
        </Box>
      </Box>
      <Typography variant="body1" component="div" sx={{ fontWeight: 'bold', fontSize: '1rem', mt: 1.5, color: 'text.primary' }}>
        {label}
      </Typography>
    </Box>
  );
}
