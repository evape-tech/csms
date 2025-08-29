"use client";
import React from 'react';

interface AsyncDataFetcherProps<T> {
  fetchFn: () => Promise<T>;
  children: (data: T, loading: boolean, error: string | null) => React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AsyncDataFetcher<T>({ 
  fetchFn, 
  children, 
  fallback 
}: AsyncDataFetcherProps<T>) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    let mounted = true;
    
    // 立即開始渲染，然後異步獲取數據
    React.startTransition(() => {
      setLoading(true);
      setError(null);
    });
    
    // 延遲數據獲取，讓組件先渲染
    setTimeout(() => {
      if (!mounted) return;
      
      fetchFn()
        .then(result => {
          if (mounted) {
            React.startTransition(() => {
              setData(result);
              setLoading(false);
            });
          }
        })
        .catch(err => {
          if (mounted) {
            React.startTransition(() => {
              setError(err?.message || String(err));
              setLoading(false);
            });
          }
        });
    }, 0);
    
    return () => { mounted = false; };
  }, [fetchFn]);
  
  // 如果還沒有數據且提供了 fallback，顯示 fallback
  if (loading && data === null && fallback) {
    return <>{fallback}</>;
  }
  
  return <>{children(data as T, loading, error)}</>;
}
