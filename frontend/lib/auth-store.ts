"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "./types";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  hydrated: boolean;
  setSession: (user: User, tokens: AuthTokens) => void;
  setUser: (user: User) => void;
  clear: () => void;
  setHydrated: (value: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      hydrated: false,
      setSession: (user, tokens) => set({ user, tokens }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, tokens: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "seir-auth",
      partialize: (state) => ({ user: state.user, tokens: state.tokens }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function isLoggedIn(): boolean {
  return Boolean(useAuth.getState().tokens?.access_token);
}
