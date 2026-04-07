// ============================================================
// FILE: src/services/api.ts
//
// CHANGES FROM PREVIOUS VERSION:
//   API_BASE now reads from VITE_API_BASE_URL instead of being
//   hardcoded to http://127.0.0.1:8000/api.
//
// HOW TO CONFIGURE — create these files in your Ionic root:
//
//   .env.development        ← used by `ionic serve`
//     VITE_API_BASE_URL=http://127.0.0.1:8000/api
//
//   .env.production         ← used by `ionic build --prod`
//     VITE_API_BASE_URL=https://ocmpc.sousounofreiren.io/api
//
// Vite automatically picks the right file based on the build
// mode. Capacitor native builds (APK/IPA) always use production.
//
// TOKEN STORAGE KEYS (must match AuthContext.tsx):
//   'sanctum_token' — the Sanctum Bearer token
//   'auth_user'     — cached user object (JSON)
// ============================================================

import axios from 'axios';

// Vite only exposes variables prefixed with VITE_ to the client bundle.
const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!API_BASE) {
  console.warn(
    '[api.ts] VITE_API_BASE_URL is not set in your .env file.\n' +
    'Add it to .env.development (local) and .env.production (deployed).\n' +
    'Falling back to http://127.0.0.1:8000/api — local dev only.'
  );
}

const api = axios.create({
  baseURL: API_BASE ?? 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
  timeout: 15000,
});

// ── Request interceptor — attach Sanctum Bearer token ─────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sanctum_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — signal 401 via event, not reload ───
//
// Only treats a 401 as "session expired" if we had a stored token.
// A 401 with no token means the request was intentionally
// unauthenticated — we should NOT log the user out in that case.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = Boolean(localStorage.getItem('sanctum_token'));

      if (hadToken) {
        // Clear storage first so retries don't re-send the dead token
        localStorage.removeItem('sanctum_token');
        localStorage.removeItem('auth_user');

        // AuthContext listens to this and calls setUser(null),
        // causing PrivateRoute to redirect to /login without a reload.
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    return Promise.reject(error);
  },
);

export default api;