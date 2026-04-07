// ============================================================
// FILE: src/pages/Loading.tsx
// ============================================================

import React, { useEffect, useState } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import api from '../services/api';

// ── Config ────────────────────────────────────────────────────────────────────
const SITE_KEY       = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';
const REDIRECT_DELAY = 3000;

const IS_LOCAL =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';


// ── Local theme tokens ────────────────────────────────────────────────────────
const W = {
  pageBg:    '#F7F3E8',
  cardBg:    '#EAE3D2',
  border:    '#D4CAAF',
  text:      '#1C2B1A',
  textMuted: '#5A6B55',
  green:     '#2D6A1F',
  greenLt:   '#3E8A2A',
  greenPale: '#D6EDD0',
} as const;

declare global {
  interface Window { grecaptcha: any; }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Loading() {
  const history = useHistory();

  const [blocked,  setBlocked]  = useState(false);
  const [checking, setChecking] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // ── Dev bypass ─────────────────────────────────────────────────────────
    if (IS_LOCAL) {
      setChecking(false);

      const steps = 100, interval = REDIRECT_DELAY / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += 1;
        setProgress(current);
        if (current >= steps) { clearInterval(timer); history.replace('/login'); }
      }, interval);
      return () => clearInterval(timer);
    }

    // ── No site key ────────────────────────────────────────────────────────
    if (!SITE_KEY) {
      history.replace('/login');
      return;
    }

    // ── Verify token ───────────────────────────────────────────────────────
    const verify = async (recaptchaToken: string) => {
      try {
        await api.post('/recaptcha/verify', { recaptcha_token: recaptchaToken });
        setChecking(false);

        const steps = 100, interval = REDIRECT_DELAY / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += 1;
          setProgress(current);
          if (current >= steps) { clearInterval(timer); history.replace('/login'); }
        }, interval);
      } catch {
        setBlocked(true);
        setChecking(false);
      }
    };

    // ── Execute reCAPTCHA ──────────────────────────────────────────────────
    const execute = () => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(SITE_KEY, { action: 'homepage' })
          .then((token: string) => { verify(token); })
          .catch(() => { setBlocked(true); setChecking(false); });
      });
    };

    if (window.grecaptcha) { execute(); return; }

    const existing = document.querySelector('script[data-recaptcha]');
    if (existing) { execute(); return; }

    const script = document.createElement('script');
    script.src   = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.dataset['recaptcha'] = 'true';
    script.onload  = execute;
    script.onerror = () => { setBlocked(true); setChecking(false); };
    document.head.appendChild(script);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Access denied ──────────────────────────────────────────────────────────
  if (blocked) {
    return (
      <IonPage>
        <IonContent style={{ '--background': W.pageBg } as React.CSSProperties}>
          <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              borderRadius: 20, padding: '32px 40px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)', textAlign: 'center',
              backgroundColor: '#FEF2F2', border: '1px solid #FECACA', maxWidth: 320,
            }}>
              <div style={{ fontSize: 40 }}>🚫</div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#991B1B' }}>
                Access Denied
              </p>
              <p style={{ margin: 0, fontSize: 14, color: '#B91C1C', lineHeight: 1.6 }}>
                Our system detected unusual activity from this connection.
                Please try again later or contact support.
              </p>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Security check card ────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonContent style={{ '--background': W.pageBg } as React.CSSProperties}>
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          userSelect: 'none', position: 'relative',
        }}>

          {/* Dot-grid background */}
          <div style={{
            pointerEvents: 'none', position: 'absolute', inset: 0, opacity: 0.25,
            backgroundImage: `radial-gradient(circle, ${W.border} 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }} />

          {/* Card */}
          <div style={{
            position: 'relative', zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
            borderRadius: 28, padding: '32px 40px',
            backgroundColor: W.cardBg, border: `1px solid ${W.border}`,
            boxShadow: '0 20px 60px rgba(28,43,26,0.12)',
            minWidth: 300, maxWidth: 360, width: '100%', boxSizing: 'border-box',
          }}>

            {/* Logo */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              flexShrink: 0, border: `3px solid ${W.green}`,
              outline: `3px solid ${W.greenPale}`, outlineOffset: 2,
              boxShadow: `0 8px 32px rgba(45,106,31,0.30)`,
            }}>
              <picture>
                <source srcSet="/assets/COOP.png" type="image/png" />
                <img
                  src="/assets/COOP.png"
                  alt="OCMPC Logo"
                  width={80} height={80}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </picture>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginTop: -8 }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -0.5, color: W.text }}>
                OCMPC
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 500, color: W.textMuted }}>
                Sudipen, La Union
              </p>
            </div>

            {/* Divider */}
            <div style={{ width: '100%', height: 1, backgroundColor: W.border }} />

            {/* Status section */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 12, width: '100%',
            }}>
              {checking ? (
                <>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: `2px solid ${W.green}`, borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: W.text }}>
                    Verifying your connection…
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: W.textMuted, textAlign: 'center' }}>
                    Running a quick security check before proceeding.
                  </p>
                </>
              ) : (
                <>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    backgroundColor: W.greenPale,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M4 9l4 4 6-7" stroke={W.green} strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: W.green }}>
                    Connection verified
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: W.textMuted, textAlign: 'center' }}>
                    Redirecting you to sign in…
                  </p>
                  <div style={{
                    width: '100%', height: 4, borderRadius: 99,
                    backgroundColor: W.border, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 99, width: `${progress}%`,
                      background: `linear-gradient(to right, ${W.green}, ${W.greenLt})`,
                      transition: 'width 50ms linear',
                    }} />
                  </div>
                </>
              )}
            </div>

            {/* reCAPTCHA branding */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              borderRadius: 12, padding: '8px 16px', width: '100%',
              justifyContent: 'center', backgroundColor: W.pageBg,
              border: `1px solid ${W.border}`, boxSizing: 'border-box',
            }}>
              <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#4285F4" />
                <path d="M32 16a16 16 0 1 0 16 16A16 16 0 0 0 32 16zm0 28a12 12 0 1 1 12-12 12 12 0 0 1-12 12z" fill="white" />
                <circle cx="32" cy="32" r="5" fill="white" />
              </svg>
              <p style={{ margin: 0, fontSize: 11, color: W.textMuted }}>
                Protected by <span style={{ fontWeight: 600, color: W.text }}>reCAPTCHA</span>
              </p>
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: W.textMuted, textDecoration: 'underline' }}>Privacy</a>
              <span style={{ color: W.border }}>·</span>
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: W.textMuted, textDecoration: 'underline' }}>Terms</a>
            </div>

          </div>

          {/* Footer */}
          <p style={{
            position: 'absolute', bottom: 24, margin: 0,
            fontSize: 12, fontWeight: 500, color: W.textMuted,
          }}>
            Cooperative Management System
          </p>

        </div>
      </IonContent>
    </IonPage>
  );
}