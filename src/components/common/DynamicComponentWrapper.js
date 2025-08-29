"use client";
import React, { Suspense } from 'react';
import { Skeleton } from '@mui/material';
import dynamic from 'next/dynamic';

/**
 * 創建動態載入的組件包裝器
 * @param {function} importFunction - 返回 import() 的函數
 * @param {Object} skeletonProps - Skeleton 組件的屬性
 * @param {Object} dynamicOptions - dynamic() 的選項
 * @returns {React.Component} 動態載入的組件
 */
export function createDynamicComponent(importFunction, skeletonProps = {}, dynamicOptions = {}) {
  const defaultSkeletonProps = {
    variant: "rectangular",
    width: "100%",
    height: 200,
    animation: "wave",
    sx: { borderRadius: 1 }
  };

  const defaultDynamicOptions = {
    ssr: false
  };

  const LoadingComponent = () => (
    <Skeleton {...defaultSkeletonProps} {...skeletonProps} />
  );

  // Ensure importFunction is a valid function
  if (typeof importFunction !== 'function') {
    console.error('Invalid importFunction provided to createDynamicComponent:', importFunction);
    return () => <div>Error: Invalid import function</div>;
  }

  return dynamic(importFunction, {
    loading: LoadingComponent,
    ...defaultDynamicOptions,
    ...dynamicOptions
  });
}

/**
 * 動態組件包裝器 - 用於包裝已存在的組件
 * @param {React.Component} Component - 要包裝的組件
 * @param {Object} skeletonProps - Skeleton 組件的屬性
 * @returns {React.Component} 包裝後的組件
 */
export function DynamicComponentWrapper({ Component, skeletonProps = {}, children, ...props }) {
  const defaultSkeletonProps = {
    variant: "rectangular",
    width: "100%",
    height: 200,
    animation: "wave",
    sx: { borderRadius: 1 }
  };

  return (
    <Suspense fallback={<Skeleton {...defaultSkeletonProps} {...skeletonProps} />}>
      {Component ? <Component {...props} /> : children}
    </Suspense>
  );
}

export default DynamicComponentWrapper;
