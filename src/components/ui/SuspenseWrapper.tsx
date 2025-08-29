"use client";
import React, { Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface SuspenseWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingMessage?: string;
}

export default function SuspenseWrapper({ 
  children, 
  fallback,
  loadingMessage = "載入中..." 
}: SuspenseWrapperProps) {
  const defaultFallback = fallback || <LoadingSpinner message={loadingMessage} />;
  
  return (
    <Suspense fallback={defaultFallback}>
      {children}
    </Suspense>
  );
}
