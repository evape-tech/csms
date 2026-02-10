"use client";

import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  /** Auto-dismiss duration in ms (default 4000). Set 0 to keep until manually dismissed. */
  duration?: number;
}

interface NotificationState {
  /** Stack of active notifications (newest last) */
  notifications: Notification[];
}

interface NotificationActions {
  /** Show a notification */
  notify: (message: string, severity?: NotificationSeverity, duration?: number) => void;
  /** Convenience: show success */
  success: (message: string, duration?: number) => void;
  /** Convenience: show error */
  error: (message: string, duration?: number) => void;
  /** Convenience: show warning */
  warning: (message: string, duration?: number) => void;
  /** Convenience: show info */
  info: (message: string, duration?: number) => void;
  /** Dismiss a notification by id */
  dismiss: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────
let _counter = 0;
function generateId(): string {
  return `notif_${Date.now()}_${++_counter}`;
}

// ─── Store ───────────────────────────────────────────────────────────
export const useNotificationStore = create<NotificationState & NotificationActions>()(
  (set) => ({
    // --- state ---
    notifications: [],

    // --- actions ---
    notify: (message, severity = 'info', duration = 4000) => {
      const id = generateId();
      set((s) => ({
        notifications: [...s.notifications, { id, message, severity, duration }],
      }));

      // Auto-dismiss
      if (duration > 0) {
        setTimeout(() => {
          set((s) => ({
            notifications: s.notifications.filter((n) => n.id !== id),
          }));
        }, duration);
      }
    },

    success: (message, duration) => {
      useNotificationStore.getState().notify(message, 'success', duration);
    },
    error: (message, duration) => {
      useNotificationStore.getState().notify(message, 'error', duration ?? 6000);
    },
    warning: (message, duration) => {
      useNotificationStore.getState().notify(message, 'warning', duration);
    },
    info: (message, duration) => {
      useNotificationStore.getState().notify(message, 'info', duration);
    },

    dismiss: (id) =>
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      })),

    clearAll: () => set({ notifications: [] }),
  }),
);
