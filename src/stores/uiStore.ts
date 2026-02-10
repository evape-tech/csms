"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────────────
interface UIState {
  /** Whether the sidebar drawer is expanded */
  drawerOpen: boolean;
  /** Whether dark mode is enabled */
  darkMode: boolean;
  /** Whether the site selection dialog is open */
  siteDialogOpen: boolean;
}

interface UIActions {
  /** Toggle drawer open/closed */
  toggleDrawer: () => void;
  /** Set drawer state explicitly */
  setDrawerOpen: (open: boolean) => void;
  /** Toggle dark/light mode */
  toggleDarkMode: () => void;
  /** Set dark mode explicitly */
  setDarkMode: (dark: boolean) => void;
  /** Open the site selection dialog */
  openSiteDialog: () => void;
  /** Close the site selection dialog */
  closeSiteDialog: () => void;
  /** Toggle site dialog */
  toggleSiteDialog: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────
export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      // --- state ---
      drawerOpen: true,
      darkMode: false,
      siteDialogOpen: false,

      // --- actions ---
      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
      setDrawerOpen: (open) => set({ drawerOpen: open }),

      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setDarkMode: (dark) => set({ darkMode: dark }),

      openSiteDialog: () => set({ siteDialogOpen: true }),
      closeSiteDialog: () => set({ siteDialogOpen: false }),
      toggleSiteDialog: () => set((s) => ({ siteDialogOpen: !s.siteDialogOpen })),
    }),
    {
      name: 'csms-ui-store', // localStorage key
      // Only persist user preferences, not transient dialog state
      partialize: (state) => ({
        drawerOpen: state.drawerOpen,
        darkMode: state.darkMode,
      }),
    },
  ),
);

// ─── Derived selectors ───────────────────────────────────────────────
export const useDrawerOpen = () => useUIStore((s) => s.drawerOpen);
export const useDarkMode = () => useUIStore((s) => s.darkMode);
export const useSiteDialogOpen = () => useUIStore((s) => s.siteDialogOpen);
