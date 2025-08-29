"use client";
import React, { Suspense } from 'react';
import { Skeleton } from '@mui/material';

/**
 * Higher-Order Component for adding dynamic loading with Skeleton
 * @param {React.Component} WrappedComponent - 要包裝的組件
 * @param {Object} skeletonProps - Skeleton 組件的屬性
 * @returns {React.Component} 帶有動態載入功能的組件
 */
export function withDynamicLoading(WrappedComponent, skeletonProps = {}) {
  const defaultSkeletonProps = {
    variant: "rectangular",
    width: "100%",
    height: 200,
    animation: "wave",
    sx: { borderRadius: 1 }
  };

  const finalSkeletonProps = { ...defaultSkeletonProps, ...skeletonProps };

  const DynamicComponent = React.forwardRef((props, ref) => {
    return (
      <Suspense fallback={<Skeleton {...finalSkeletonProps} />}>
        <WrappedComponent ref={ref} {...props} />
      </Suspense>
    );
  });

  // 設置顯示名稱方便除錯
  DynamicComponent.displayName = `withDynamicLoading(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return DynamicComponent;
}

/**
 * 創建自包含動態載入的組件 Hook
 * @param {Object} skeletonProps - Skeleton 組件的屬性  
 * @returns {Object} 包含載入狀態控制的工具
 */
export function useDynamicLoading(skeletonProps = {}) {
  const [isLoading, setIsLoading] = React.useState(true);
  
  const defaultSkeletonProps = {
    variant: "rectangular",
    width: "100%", 
    height: 200,
    animation: "wave",
    sx: { borderRadius: 1 }
  };

  const finalSkeletonProps = { ...defaultSkeletonProps, ...skeletonProps };

  const LoadingSkeleton = () => <Skeleton {...finalSkeletonProps} />;

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  const startLoading = React.useCallback(() => {
    setIsLoading(true);
  }, []);

  return {
    isLoading,
    stopLoading,
    startLoading,
    LoadingSkeleton
  };
}

export default withDynamicLoading;
