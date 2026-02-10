"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Site interface based on the stations schema
export interface Site {
  id: number;
  station_code: string;
  name: string | null;
  address: string | null;
  floor: string | null;
  operator_id: string | null;
  tariff_id?: number | null;
  updated_at: string;
  meters?: any[];
  tariff?: any;
}

interface SiteContextValue {
  /** All available sites */
  sites: Site[];
  /** Currently selected site (null = loading or no sites) */
  selectedSite: Site | null;
  /** Convenience: selectedSite?.id or null */
  selectedSiteId: number | null;
  /** Display name for the selected site */
  selectedSiteName: string;
  /** Whether initial site data is loading */
  loading: boolean;
  /** Error message if site fetch failed */
  error: string | null;
  /** Select a site and persist to localStorage */
  selectSite: (site: Site) => void;
  /** Refresh sites list from API */
  refreshSites: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | null>(null);

const STORAGE_KEY = 'csms_selected_site_id';

/**
 * Read persisted site ID from localStorage.
 * Returns null if nothing stored or not parseable.
 */
function getPersistedSiteId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const id = parseInt(raw, 10);
    return Number.isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

/**
 * Persist selected site ID to localStorage + cookie (so middleware can read it).
 */
function persistSiteId(id: number | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = `${STORAGE_KEY}=; path=/; max-age=0`;
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
      document.cookie = `${STORAGE_KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  } catch {
    // localStorage unavailable (e.g. private browsing full)
  }
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/stations');
      if (!response.ok) {
        throw new Error(`Failed to fetch sites: ${response.status}`);
      }

      const data: Site[] = await response.json();
      setSites(data);

      // Determine which site to select
      const persistedId = getPersistedSiteId();
      const persisted = persistedId !== null
        ? data.find((s) => s.id === persistedId) ?? null
        : null;

      if (persisted) {
        setSelectedSite(persisted);
      } else if (data.length > 0) {
        setSelectedSite(data[0]);
        persistSiteId(data[0].id);
      } else {
        setSelectedSite(null);
      }
    } catch (err) {
      console.error('Failed to fetch sites:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch sites on mount
  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const selectSite = useCallback((site: Site) => {
    setSelectedSite(site);
    persistSiteId(site.id);
  }, []);

  const refreshSites = useCallback(async () => {
    await fetchSites();
  }, [fetchSites]);

  const selectedSiteId = selectedSite?.id ?? null;

  const selectedSiteName = useMemo(() => {
    if (!selectedSite) return '載入中...';
    return selectedSite.name || selectedSite.station_code || '未命名站點';
  }, [selectedSite]);

  const value = useMemo<SiteContextValue>(() => ({
    sites,
    selectedSite,
    selectedSiteId,
    selectedSiteName,
    loading,
    error,
    selectSite,
    refreshSites,
  }), [sites, selectedSite, selectedSiteId, selectedSiteName, loading, error, selectSite, refreshSites]);

  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  );
}

/**
 * Hook to access full site context.
 */
export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error('useSite() must be used within a <SiteProvider>');
  }
  return ctx;
}

/**
 * Convenience hook returning just the selected site ID (or null).
 */
export function useSiteId(): number | null {
  return useSite().selectedSiteId;
}
