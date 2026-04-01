// ============================================================
// FILE: src/contexts/AuthContext.tsx
//
// CHANGES FROM PREVIOUS VERSION:
//   1. useAuth hook REMOVED from this file.
//      It now lives in src/contexts/useAuth.ts.
//
//      WHY: Vite Fast Refresh requires a file to export only
//      React components OR only hooks — not both. Mixing them
//      caused the repeated HMR invalidation:
//        "Could not Fast Refresh (useAuth export is incompatible)"
//      That triggered full page reloads on every save, which
//      re-ran the boot useEffect and caused race conditions
//      that led to spurious 401 → logout loops during dev.
//
//   2. AuthContext and AuthContextType are now EXPORTED so that
//      useAuth.ts can import AuthContext to call useContext().
//
//   3. No logic changes — login, logout, /me boot, and the
//      auth:unauthorized event listener are all unchanged.
//
// TOKEN STORAGE KEYS (must match api.ts exactly):
//   'sanctum_token' — the Sanctum Bearer token
//   'auth_user'     — cached user object (JSON)
// ============================================================

import React, {
  createContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────
export interface AuthUser {
  id:          number;
  name:        string;
  email:       string;
  role:        string;
  is_approved: boolean;
}

export interface AuthContextType {
  user:    AuthUser | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<void>;
  logout:  () => Promise<void>;
}

// ── Context (exported so useAuth.ts can import it) ─────────────
export const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Listen for 401 events from api.ts ─────────────────────
  // When api.ts gets a 401 on a request that had a token,
  // it dispatches 'auth:unauthorized'. We respond by clearing
  // user state, which causes PrivateRoute to redirect to /login
  // via React Router (no page reload, no race condition).
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // ── Boot: verify stored token on app start ─────────────────
  useEffect(() => {
    const token = localStorage.getItem('sanctum_token');

    if (!token) {
      setLoading(false);
      return;
    }

    // Restore cached user instantly — prevents spinner flash
    const cached = localStorage.getItem('auth_user');
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { /* ignore bad JSON */ }
    }

    // Verify token is still valid with the server
    api.get<AuthUser>('/me')
      .then(res => {
        setUser(res.data);
        localStorage.setItem('auth_user', JSON.stringify(res.data));
      })
      .catch(() => {
        // 401 is already handled by the interceptor + event listener above.
        // For other errors (network down etc.), keep cached user.
      })
      .finally(() => setLoading(false));
  }, []);

  // ── login() ──────────────────────────────────────────────
  // Stores token FIRST, then sets React state.
  // Uses login response user data directly — no second /me call.
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await api.post<{
      token: string;
      user:  AuthUser;
    }>('/login', { email, password });

    const { token, user: userData } = res.data;

    // Write to localStorage BEFORE updating state so that any
    // API call fired immediately after (e.g. dashboard load)
    // already has the Authorization header available.
    localStorage.setItem('sanctum_token', token);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  // ── logout() ─────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    try { await api.post('/logout'); } catch { /* ignore */ }
    localStorage.removeItem('sanctum_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}