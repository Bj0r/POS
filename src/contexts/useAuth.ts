// ============================================================
// FILE: src/contexts/useAuth.ts
//
// WHY THIS FILE EXISTS:
//   Vite Fast Refresh requires a file to export ONLY React
//   components OR only hooks/values — never both.
//
//   The original AuthContext.tsx exported both AuthProvider
//   (a component) and useAuth (a hook) from the same file.
//   This caused Vite to print:
//     "Could not Fast Refresh — useAuth export is incompatible"
//   ...and fall back to a full page reload on every save.
//
//   That full reload re-ran the AuthContext boot useEffect,
//   which fired a /me call that could race against localStorage
//   writes and trigger a spurious 401 → logout loop.
//
// FIX:
//   Move useAuth into this separate file. AuthContext.tsx now
//   only exports AuthProvider (a component). Vite can Fast
//   Refresh both files independently with no incompatibility.
//
// USAGE:
//   Replace every import of useAuth from AuthContext.tsx with:
//     import { useAuth } from '../contexts/useAuth';
//   (adjust relative path as needed for each file)
// ============================================================

import { useContext } from 'react';
import { AuthContext, AuthContextType } from './AuthContext';

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}