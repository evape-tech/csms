"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  userId: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
}

interface UserStore {
  // State
  currentUser: User | null;
  loading: boolean;
  error: string | null;

  // Actions
  setCurrentUser: (user: User | null) => void;
  fetchCurrentUser: () => Promise<void>;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      // Initial state
      currentUser: null,
      loading: false,
      error: null,

      // Actions
      setCurrentUser: (user: User | null) => set({ currentUser: user, error: null }),
      
      fetchCurrentUser: async () => {
        set({ loading: true, error: null });
        try {
          const response = await fetch('/api/auth/me');
          if (!response.ok) {
            if (response.status === 401) {
              set({ currentUser: null, loading: false, error: null });
              return;
            }
            throw new Error(`Failed to fetch current user: ${response.statusText}`);
          }
          const data = await response.json();
          set({ currentUser: data, loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user';
          set({ error: errorMessage, loading: false });
          console.error('Failed to fetch current user:', error);
        }
      },

      clearUser: () => set({ currentUser: null, error: null }),

      setLoading: (loading: boolean) => set({ loading }),

      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'csms-user-store',
      partialize: (state) => ({
        currentUser: state.currentUser,
      }),
    }
  )
);

// Derived hook for getting user display name
export function useUserDisplayName(): string {
  const currentUser = useUserStore((state) => state.currentUser);
  if (!currentUser) return '';
  
  if (currentUser.firstName && currentUser.lastName) {
    return `${currentUser.firstName} ${currentUser.lastName}`;
  }
  if (currentUser.firstName) return currentUser.firstName;
  if (currentUser.lastName) return currentUser.lastName;
  return currentUser.email;
}

// Derived hook for getting user email
export function useUserEmail(): string {
  const currentUser = useUserStore((state) => state.currentUser);
  return currentUser?.email || '';
}

// Derived hook for getting user role
export function useUserRole(): string {
  const currentUser = useUserStore((state) => state.currentUser);
  return currentUser?.role || '';
}
