// ============================================================
// FILE: src/contexts/useAuth.ts
//
// WHY THIS FILE EXISTS:
//   Vite Fast Refresh requires a file to export ONLY React
//   components OR only hooks/values — not both.
//
//   AuthContext.tsx exports AuthProvider (a component).
//   This file exports useAuth (a hook). Keeping them separate
//   prevents the "Could not Fast Refresh" warning and avoids
//   the full-page reload that was triggering a /me race on
//   every dev save.
//
// NOTE: AuthContext.tsx must export both AuthContext and
//   AuthContextType for this file to compile. Those exports
//   were added in the fixed AuthContext.tsx.
// ============================================================

import { useContext } from 'react';
import { AuthContext, AuthContextType } from './AuthContext';

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}