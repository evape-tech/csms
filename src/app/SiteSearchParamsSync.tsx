"use client";
import { Suspense, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSiteStore } from '../stores/siteStore';

/**
 * Syncs the selected site from SiteContext to the URL searchParams (?stationId=X).
 * This enables Server Components to read the selected site from searchParams.
 * Place this inside the SiteProvider in ClientLayout.
 */
function SiteSearchParamsSyncInner() {
  const selectedSiteId = useSiteStore((s) => s.selectedSite?.id ?? null);
  const loading = useSiteStore((s) => s.loading);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevSiteIdRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    // Skip during initial load
    if (loading) return;
    // Skip pages that don't need site filtering (login, home)
    if (pathname === '/' || pathname === '/login') return;
    
    const currentParam = searchParams.get('stationId');
    const currentParamNum = currentParam ? parseInt(currentParam, 10) : null;

    // Only update URL if site changed and differs from current param
    if (selectedSiteId !== null && selectedSiteId !== currentParamNum) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('stationId', String(selectedSiteId));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }

    prevSiteIdRef.current = selectedSiteId;
  }, [selectedSiteId, loading, pathname, searchParams, router]);

  return null;
}

export default function SiteSearchParamsSync() {
  return (
    <Suspense fallback={null}>
      <SiteSearchParamsSyncInner />
    </Suspense>
  );
}
