// ============================================================
// FILE: src/pages/Login.tsx
//
// UPDATED TO MATCH Register.tsx layout:
//   ✓ Same outer shell / card / header pattern as Register
//   ✓ Uses W (warmEarth) theme tokens — consistent with Register
//   ✓ Uses Heroicons (not IonIcon) for field icons — matches Register
//   ✓ "Create account" link at the bottom — mirrors Register's "Sign in"
//   ✓ All existing Login features preserved:
//       - Lockout after MAX_ATTEMPTS (3) failures — 60s countdown
//       - Progress bar during lockout
//       - "N attempts remaining" amber warning
//       - Inline forgot-password + forgot-sent views
//       - Forgot password calls POST /api/forgot-password
//       - Pending approval (403) → redirect /pending
//       - Enter key submits the active form
//       - Mount + view-switch transitions
//
// RESET PASSWORD — HOW IT WORKS IN HYBRID (Ionic + Laravel):
//   POST /api/forgot-password delegates to Laravel's built-in
//   Password::sendResetLink().  The email contains a link to
//   your web app (APP_URL/reset-password/{token}).  The user
//   taps the link, their phone browser opens the web app, they
//   reset the password there, then return to the Ionic app and
//   log in normally.  No special Ionic handling is required.
//   This is confirmed working as long as:
//     1. APP_URL in .env points to your web domain
//     2. routes/auth.php has the reset-password routes (it does)
//     3. Mail is configured (MAIL_* in .env)
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useHistory, Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import { W } from '../theme/warmEarth';

// ── Constants ─────────────────────────────────────────────────────────────────
const LOCKOUT_SECONDS = 60;
const MAX_ATTEMPTS    = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMMSS(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Shared styles (mirrors Register.tsx) ─────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: W.textMuted, textTransform: 'uppercase',
  letterSpacing: 0.4, marginBottom: 5,
};

const inputStyle = (hasError = false): React.CSSProperties => ({
  width: '100%', padding: '11px 12px 11px 38px',
  borderRadius: 12, fontSize: 13,
  border: `1px solid ${hasError ? '#EBBDB8' : W.border}`,
  backgroundColor: hasError ? '#FAE3DF' : W.inputBg,
  color: W.text, boxSizing: 'border-box', colorScheme: 'light',
  outline: 'none',
});

// ── View modes ────────────────────────────────────────────────────────────────
type View = 'login' | 'forgot' | 'forgot-sent';

// ── Component ─────────────────────────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth();
  const history   = useHistory();

  // ── View state ────────────────────────────────────────────────────────────
  const [view,        setView]        = useState<View>('login');
  const [viewMounted, setViewMounted] = useState(true);

  const switchView = (next: View) => {
    setViewMounted(false);
    setError('');
    setTimeout(() => { setView(next); setViewMounted(true); }, 180);
  };

  // ── Login fields ──────────────────────────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // ── Forgot-password field ─────────────────────────────────────────────────
  const [fpEmail, setFpEmail] = useState('');

  // ── Shared ────────────────────────────────────────────────────────────────
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  // ── Lockout — persisted in localStorage ──────────────────────────────────
  const [failedAttempts, setFailedAttempts] = useState<number>(() =>
    parseInt(localStorage.getItem('login_attempts') ?? '0', 10),
  );
  const [lockoutEnds, setLockoutEnds] = useState<number | null>(() => {
    const ts = localStorage.getItem('lockout_until');
    return ts ? parseInt(ts, 10) : null;
  });
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLockedOut = !!lockoutEnds && Date.now() < lockoutEnds;

  // ── Countdown tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lockoutEnds) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((lockoutEnds - Date.now()) / 1000));
      setCountdown(rem);
      if (rem <= 0) {
        setLockoutEnds(null);
        setFailedAttempts(0);
        localStorage.removeItem('lockout_until');
        localStorage.removeItem('login_attempts');
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lockoutEnds]);

  // ── Mount fade-in ─────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (isLockedOut || busy) return;
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      setFailedAttempts(0);
      localStorage.removeItem('login_attempts');
      localStorage.removeItem('lockout_until');
      history.replace('/dashboard');
    } catch (e: any) {
      const status  = e?.response?.status;
      const message = e?.response?.data?.message ?? 'Login failed. Please try again.';
      if (status === 403) { history.replace('/pending'); return; }
      if (status === 401 || status === 422) {
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        localStorage.setItem('login_attempts', String(next));
        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockoutEnds(until);
          localStorage.setItem('lockout_until', String(until));
        }
      }
      setError(message);
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  const handleForgotPassword = async () => {
    if (busy) return;
    const target = fpEmail.trim() || email.trim();
    if (!target) { setError('Enter your email address first.'); return; }
    setBusy(true);
    setError('');
    try {
      await api.post('/forgot-password', { email: target });
      switchView('forgot-sent');
    } catch {
      setError('Could not send reset link. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonContent style={{ '--background': W.pageBg } as any}>
        <div style={{
          minHeight:      '100vh',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '24px 20px',
          opacity:        mounted ? 1 : 0,
          transition:     'opacity 0.35s ease',
        }}>
          <div style={{
            width:    '100%',
            maxWidth: 440,
            opacity:  viewMounted ? 1 : 0,
            transform: viewMounted ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.18s ease, transform 0.18s ease',
          }}>

            {/* ── Header (icon + title) — mirrors Register ───────── */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
                boxShadow: '0 8px 24px rgba(45,106,31,0.28)',
              }}>
                <ArrowRightStartOnRectangleIcon style={{ width: 28, height: 28, color: '#fff' }} />
              </div>

              {view === 'login' && (
                <>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: W.text }}>
                    Welcome back
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: W.textMuted }}>
                    Sign in to your cooperative account.
                  </p>
                </>
              )}
              {view === 'forgot' && (
                <>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: W.text }}>
                    Forgot password?
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: W.textMuted }}>
                    Enter your email and we'll send a reset link.
                  </p>
                </>
              )}
              {view === 'forgot-sent' && (
                <>
                  <CheckCircleIcon style={{
                    width: 48, height: 48, color: W.green,
                    display: 'block', margin: '0 auto 10px',
                  }} />
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: W.text }}>
                    Check your email
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: W.textMuted }}>
                    A reset link has been sent if that address is registered.
                  </p>
                </>
              )}
            </div>

            {/* ── Card — mirrors Register ─────────────────────────── */}
            <div style={{
              backgroundColor: W.cardBg,
              borderRadius:    20,
              border:          `1px solid ${W.border}`,
              boxShadow:       '0 4px 24px rgba(28,43,26,0.10)',
              padding:         '24px 20px',
            }}>

              {/* ════════════════════════════════════════════════════ */}
              {/* LOGIN VIEW                                           */}
              {/* ════════════════════════════════════════════════════ */}
              {view === 'login' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Lockout banner */}
                  {isLockedOut && (
                    <div style={{
                      borderRadius: 12, padding: '12px 14px',
                      backgroundColor: '#FAE3DF', border: '1px solid #EBBDB8',
                    }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#B83220' }}>
                        Too many attempts
                      </p>
                      <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#B83220' }}>
                        Sign-in is temporarily disabled. Try again in{' '}
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMMSS(countdown)}</strong>.
                      </p>
                      <div style={{ height: 6, borderRadius: 3, background: '#EBBDB8', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3, background: '#B83220',
                          width: `${Math.min(100, (countdown / LOCKOUT_SECONDS) * 100)}%`,
                          transition: 'width 1s linear',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Attempts warning */}
                  {!isLockedOut && failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && (
                    <div style={{
                      borderRadius: 12, padding: '10px 14px',
                      backgroundColor: '#FFFBEB', border: '1px solid #F0D58A',
                    }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#92660A' }}>
                        Incorrect email or password.{' '}
                        <strong>
                          {MAX_ATTEMPTS - failedAttempts} attempt
                          {MAX_ATTEMPTS - failedAttempts !== 1 ? 's' : ''} remaining
                        </strong>{' '}
                        before a temporary lockout.
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && !isLockedOut && failedAttempts === 0 && (
                    <div style={{
                      borderRadius: 12, padding: '10px 14px',
                      backgroundColor: '#FAE3DF', border: '1px solid #EBBDB8',
                    }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#B83220' }}>{error}</p>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label htmlFor="login-email" style={labelStyle}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <EnvelopeIcon style={{
                        position: 'absolute', left: 12, top: '50%',
                        transform: 'translateY(-50%)', width: 15, height: 15,
                        color: W.textMuted, pointerEvents: 'none',
                      }} />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        disabled={isLockedOut}
                        style={inputStyle()}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 5,
                    }}>
                      <label htmlFor="login-password" style={{ ...labelStyle, marginBottom: 0 }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setFpEmail(email); switchView('forgot'); }}
                        style={{
                          background: 'none', border: 'none',
                          fontSize: 11, fontWeight: 700, color: W.green,
                          cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                          textDecoration: 'underline', textDecorationColor: 'transparent',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.textDecorationColor = W.green)}
                        onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <LockClosedIcon style={{
                        position: 'absolute', left: 12, top: '50%',
                        transform: 'translateY(-50%)', width: 15, height: 15,
                        color: W.textMuted, pointerEvents: 'none',
                      }} />
                      <input
                        id="login-password"
                        type={showPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        disabled={isLockedOut}
                        style={{ ...inputStyle(), paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        style={{
                          position: 'absolute', right: 12, top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, color: W.textMuted,
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPass
                          ? <EyeSlashIcon style={{ width: 15, height: 15 }} />
                          : <EyeIcon      style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                  </div>

                  {/* Approval reminder */}
                  <div style={{
                    borderRadius: 12, padding: '12px 14px',
                    backgroundColor: W.cardBgAlt, border: `1px solid ${W.border}`,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: W.textMuted, lineHeight: 1.55 }}>
                      <strong style={{ color: W.text }}>Reminder:</strong> Newly created staff accounts
                      require admin approval before sign-in is possible.
                    </p>
                  </div>

                  {/* Submit */}
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={busy || isLockedOut}
                    style={{
                      padding: '13px 22px', borderRadius: 12, border: 'none',
                      background: busy || isLockedOut
                        ? '#A8C4A2'
                        : `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
                      color: 'white', fontWeight: 800, fontSize: 14,
                      cursor: busy || isLockedOut ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: busy || isLockedOut ? 'none' : '0 4px 14px rgba(45,106,31,0.25)',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                  >
                    {busy && <IonSpinner name="crescent" style={{ width: 14, height: 14 }} />}
                    {busy
                      ? 'Signing in…'
                      : isLockedOut
                        ? `Locked — ${formatMMSS(countdown)}`
                        : 'Sign In'}
                  </button>

                </div>
              )}

              {/* ════════════════════════════════════════════════════ */}
              {/* FORGOT PASSWORD VIEW                                 */}
              {/* ════════════════════════════════════════════════════ */}
              {view === 'forgot' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {error && (
                    <div style={{
                      borderRadius: 12, padding: '10px 14px',
                      backgroundColor: '#FAE3DF', border: '1px solid #EBBDB8',
                    }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#B83220' }}>{error}</p>
                    </div>
                  )}

                  {/* Reset info note */}
                  <div style={{
                    borderRadius: 12, padding: '12px 14px',
                    backgroundColor: '#FEF3C7', border: '1px solid #FCD34D',
                  }}>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#92600A' }}>
                      <strong>How it works:</strong> We'll email you a reset link.
                      Tap the link — it opens in your browser — set your new password,
                      then return here to sign in.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="fp-email" style={labelStyle}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <EnvelopeIcon style={{
                        position: 'absolute', left: 12, top: '50%',
                        transform: 'translateY(-50%)', width: 15, height: 15,
                        color: W.textMuted, pointerEvents: 'none',
                      }} />
                      <input
                        id="fp-email"
                        type="email"
                        autoComplete="email"
                        placeholder="your@email.com"
                        value={fpEmail}
                        onChange={e => setFpEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                        disabled={busy}
                        style={inputStyle()}
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={busy}
                    style={{
                      padding: '13px 22px', borderRadius: 12, border: 'none',
                      background: busy
                        ? '#A8C4A2'
                        : `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
                      color: 'white', fontWeight: 800, fontSize: 14,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: busy ? 'none' : '0 4px 14px rgba(45,106,31,0.25)',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                  >
                    {busy && <IonSpinner name="crescent" style={{ width: 14, height: 14 }} />}
                    {busy ? 'Sending…' : 'Send Reset Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    style={{
                      background: 'none', border: 'none',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                      fontSize: 13, fontWeight: 600, color: W.textMuted,
                      cursor: 'pointer', padding: '8px 0',
                      fontFamily: 'inherit', width: '100%',
                    }}
                  >
                    <ArrowLeftIcon style={{ width: 15, height: 15 }} />
                    Back to Sign In
                  </button>

                </div>
              )}

              {/* ════════════════════════════════════════════════════ */}
              {/* RESET LINK SENT VIEW                                 */}
              {/* ════════════════════════════════════════════════════ */}
              {view === 'forgot-sent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  <div style={{
                    borderRadius: 12, border: '1px solid #B2D9A8',
                    backgroundColor: '#EDFAED', padding: '14px 16px',
                  }}>
                    <p style={{ margin: 0, fontSize: 13, color: W.greenText, lineHeight: 1.6 }}>
                      The reset link will open in your browser where you can set a new password.
                      Check your spam folder if it doesn't arrive within a few minutes.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setFpEmail(''); switchView('login'); }}
                    style={{
                      padding: '13px 22px', borderRadius: 12, border: 'none',
                      background: `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
                      color: 'white', fontWeight: 800, fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 14px rgba(45,106,31,0.25)',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                  >
                    Back to Sign In
                  </button>

                </div>
              )}

            </div>

            {/* ── Create account link — mirrors Register's "Sign in" link ── */}
            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: W.textMuted }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                style={{ fontWeight: 700, color: W.green, textDecoration: 'none' }}
              >
                Create account
              </Link>
            </p>

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}