"use client";
import React, { useEffect, useState, useMemo } from 'react';

/**
 * AnimatedNumber
 * @param {number} value - 目標數值
 * @param {number} duration - 動畫時長 (ms)
 * @param {number} decimals - 小數位數 (預設根據 value 自動判斷)
 */
export default function AnimatedNumber({ value, duration = 800, decimals }) {
  const [displayValue, setDisplayValue] = useState(0);

  // 提前計算小數位數，避免每幀都算
  const fixedDecimals = useMemo(() => {
    if (typeof decimals === 'number') return decimals;
    return Number.isInteger(value) ? 0 : value.toString().split('.')[1]?.length || 2;
  }, [value, decimals]);

  useEffect(() => {
    let start = displayValue;  // 從目前顯示值開始動畫
    let startTime;
    let raf;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const current = start + (value - start) * progress;

      // 節流更新：每 2 幀才 setState，一般眼睛看不出差別
      if (Math.floor(progress * 60) % 2 === 0) {
        setDisplayValue(Number(current.toFixed(fixedDecimals)));
      }

      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, fixedDecimals]);

  return <>{displayValue}</>;
}
