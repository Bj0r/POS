// ============================================================
// FILE: src/services/api.ts
//
// CHANGE FROM PREVIOUS VERSION:
//   The 401 interceptor now checks whether a Sanctum token was
//   actually present in localStorage BEFORE dispatching the
//   'auth:unauthorized' event.
//
// WHY THIS MATTERS:
//   The old interceptor fired on ANY 401 response, including:
//     - A /me call that raced before the token was written
//     - A retry on a page that loaded before login completed
//     - Any unauthenticated request made before login
//
//   In those cases there is no token → the user is not
//   "logged out", they were never logged in. Dispatching
//   auth:unauthorized cleared the user state unnecessarily,
//   which caused the symptom:
//     "select member → no member found → redirected to login"
//
//   The fix: only treat a 401 as "session expired" if a token
//   was present. If there was no token, just reject the error
//   normally and let the calling code handle it.
//
// UNCHANGED:
//   - axios instance config (baseURL, headers, timeout)
//   - Request interceptor (attaches Bearer token)
//   - localStorage key names (must match AuthContext.tsx)
// ============================================================

import axios from 'axios';

const API_BASE = 'https://ocmpc.sousounofreiren.io/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
  timeout: 15000,
});

// ── Request interceptor — attach Sanctum Bearer token ────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sanctum_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — signal 401 via event, not reload ──
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only treat this as "session expired" if we actually had
      // a token. A 401 with no token means the request was
      // intentionally unauthenticated — don't log the user out.
      const hadToken = Boolean(localStorage.getItem('sanctum_token'));

      if (hadToken) {
        // Clear storage first so any retry won't send the dead token
        localStorage.removeItem('sanctum_token');
        localStorage.removeItem('auth_user');

        // Dispatch event — AuthContext listens and calls setUser(null),
        // which causes PrivateRoute to redirect without a page reload.
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    return Promise.reject(error);
  }
);

export default api;