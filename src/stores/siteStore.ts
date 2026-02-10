"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────────────
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

interface SiteState {
  /** All available sites */
  sites: Site[];
  /** Currently selected site (null = loading or no sites) */
  selectedSite: Site | null;
  /** Whether initial site data is loading */
  loading: boolean;
  /** Error message if site fetch failed */
  error: string | null;
  /** Whether the store has been hydrated from persistence */
  _hasHydrated: boolean;
}

interface SiteActions {
  /** Select a site and persist to cookie */
  selectSite: (site: Site) => void;
  /** Fetch sites list from API and auto-select */
  fetchSites: () => Promise<void>;
  /** Alias for fetchSites */
  refreshSites: () => Promise<void>;
  /** Mark hydration complete (internal) */
  setHasHydrated: (v: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const COOKIE_KEY = 'csms_selected_site_id';

function persistSiteIdCookie(id: number | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id === null) {
      document.cookie = `${COOKIE_KEY}=; path=/; max-age=0`;
    } else {
      document.cookie = `${COOKIE_KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  } catch {
    // cookie unavailable
  }
}

// ─── Store ───────────────────────────────────────────────────────────
export const useSiteStore = create<SiteState & SiteActions>()(
  persist(
    (set, get) => ({
      // --- state ---
      sites: [],
      selectedSite: null,
      loading: true,
      error: null,
      _hasHydrated: false,

      // --- actions ---
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      selectSite: (site) => {
        set({ selectedSite: site });
        persistSiteIdCookie(site.id);
      },

      fetchSites: async () => {
        try {
          set({ loading: true, error: null });

          const response = await fetch('/api/stations');
          if (!response.ok) {
            throw new Error(`Failed to fetch sites: ${response.status}`);
          }

          const data: Site[] = await response.json();
          const { selectedSite } = get();

          // Determine which site to keep selected
          let nextSite: Site | null = null;

          if (selectedSite) {
            // Try to match currently selected site in new data
            nextSite = data.find((s) => s.id === selectedSite.id) ?? null;
          }

          if (!nextSite && data.length > 0) {
            nextSite = data[0];
          }

          set({ sites: data, selectedSite: nextSite, loading: false });
          persistSiteIdCookie(nextSite?.id ?? null);
        } catch (err) {
          console.error('Failed to fetch sites:', err);
          set({
            error: err instanceof Error ? err.message : 'Failed to load sites',
            loading: false,
          });
        }
      },

      refreshSites: async () => {
        await get().fetchSites();
      },
    }),
    {
      name: 'csms-site-store', // localStorage key
      // Only persist the selected site id to keep storage light
      partialize: (state) => ({
        selectedSite: state.selectedSite,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// ─── Derived selectors (stable references for consumers) ─────────

/** Convenience: selectedSite?.id or null */
export const useSelectedSiteId = () =>
  useSiteStore((s) => s.selectedSite?.id ?? null);

/** Display name for the selected site */
export const useSelectedSiteName = () =>
  useSiteStore((s) => {
    if (!s.selectedSite) return '載入中...';
    return s.selectedSite.name || s.selectedSite.station_code || '未命名站點';
  });

// ─── Composite hooks ─────────────────────────────────────────────
export function useSite() {
  const sites = useSiteStore((s) => s.sites);
  const selectedSite = useSiteStore((s) => s.selectedSite);
  const selectedSiteId = useSiteStore((s) => s.selectedSite?.id ?? null);
  const selectedSiteName = useSelectedSiteName();
  const loading = useSiteStore((s) => s.loading);
  const error = useSiteStore((s) => s.error);
  const selectSite = useSiteStore((s) => s.selectSite);
  const refreshSites = useSiteStore((s) => s.refreshSites);

  return {
    sites,
    selectedSite,
    selectedSiteId,
    selectedSiteName,
    loading,
    error,
    selectSite,
    refreshSites,
  };
}


export function useSiteId(): number | null {
  return useSelectedSiteId();
}
