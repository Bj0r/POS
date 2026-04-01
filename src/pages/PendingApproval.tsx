// ============================================================
// FILE: src/pages/PendingApproval.tsx
//
// MIRRORS: resources/js/Pages/Auth/PendingApproval.jsx
//
// WHEN SHOWN:
//   - After login attempt returns 403 (account_pending)
//   - Login.tsx calls history.replace('/pending')
//
// FEATURES CARRIED OVER:
//   ✓ Big envelope icon + clock badge (same layout)
//   ✓ Three-step "What happens next" list
//   ✓ Warm Earth palette (gold/green/blue step icons)
//   ✓ Mount fade-up transition
//   ✓ "Back to Sign In" button
// ============================================================

import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import {
  mailOutline, searchOutline, checkmarkCircleOutline,
  timeOutline, hourglassOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { W } from '../theme/warmEarth';

export default function PendingApproval() {
  const history  = useHistory();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 20); return () => clearTimeout(t); }, []);

  const steps = [
    {
      icon:  mailOutline,
      bg:    W.bluePale,
      title: 'Check your email',
      desc:  'We sent a confirmation to your registered address.',
    },
    {
      icon:  searchOutline,
      bg:    W.goldBg,
      title: 'Admin Review',
      desc:  'An administrator will verify your account details.',
    },
    {
      icon:  checkmarkCircleOutline,
      bg:    W.greenPale,
      title: 'Final Approval',
      desc:  "Once approved, you'll receive a secure sign-in link.",
    },
  ];

  return (
    <IonPage>
      <IonContent style={{ '--background': '#F7F3E8' } as any}>
        <div style={{
          minHeight: '100vh', display: 'flex',
          flexDirection: 'column', justifyContent: 'center',
          padding: '32px 20px',
          opacity:   mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>

          {/* ── Main icon ─────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 20,
                backgroundColor: W.greenPale, border: `1px solid ${W.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IonIcon icon={mailOutline} style={{ fontSize: 38, color: W.green }} />
              </div>
              {/* Clock badge */}
              <div style={{
                position: 'absolute', bottom: -8, right: -8,
                width: 30, height: 30, borderRadius: 8,
                backgroundColor: W.goldBg, border: `2px solid ${W.goldBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IonIcon icon={timeOutline} style={{ fontSize: 16, color: W.goldTextDark }} />
              </div>
            </div>
          </div>

          {/* ── Heading ───────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontWeight: 900, fontSize: 22, color: W.text }}>
              Account Not Yet Active
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: W.textMuted }}>
              Your account is pending administrator approval
            </p>
          </div>

          {/* ── Gold status banner ────────────────────────────── */}
          <div style={{
            marginBottom: 24, borderRadius: 14,
            backgroundColor: W.goldBg, border: `1px solid ${W.goldBorder}`,
            padding: '14px 16px',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: W.goldText, lineHeight: 1.6 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: W.goldTextDark }}>
                <IonIcon icon={hourglassOutline} style={{ fontSize: 14 }} /> Awaiting Approval
              </strong>
              An administrator has not yet approved your account.
              Please wait for your approval email notification.
            </p>
          </div>

          {/* ── Steps card ────────────────────────────────────── */}
          <div style={{
            marginBottom: 24, borderRadius: 16, overflow: 'hidden',
            border: `1px solid ${W.border}`,
          }}>
            <div style={{
              backgroundColor: W.cardBgAlt, padding: '10px 16px',
              borderBottom: `1px solid ${W.border}`,
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: W.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
                What happens next
              </p>
            </div>

            {steps.map((step, i) => (
              <div key={step.title} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 16px',
                backgroundColor: W.cardBg,
                borderTop: i > 0 ? `1px solid ${W.border}` : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  backgroundColor: step.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IonIcon icon={step.icon} style={{ fontSize: 18, color: W.text }} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: W.text }}>{step.title}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: W.textMuted }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Back to login ─────────────────────────────────── */}
          <button
            onClick={() => history.replace('/login')}
            style={{
              width: '100%', padding: '15px',
              borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
              color: 'white', fontWeight: 800, fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45,106,31,0.3)',
            }}
          >
            Back to Sign In
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: W.textMuted }}>
            Didn't receive an email?{' '}
            <span style={{ color: W.goldTextDark, fontWeight: 600 }}>Check your spam folder.</span>
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
}