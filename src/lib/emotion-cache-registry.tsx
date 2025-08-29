'use client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { useState } from 'react';

// 簡化的 Emotion cache registry，適用於 Next.js App Router
export default function EmotionCacheRegistry({
  options,
  children,
}: {
  options: Parameters<typeof createCache>[0];
  children: React.ReactNode;
}) {
  const [cache] = useState(() => {
    const cache = createCache(options);
    cache.compat = true;
    return cache;
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
