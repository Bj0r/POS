// ============================================================
// FILE: src/components/AppLayout.tsx
//
// DEFINITIVE FIX: Stop using dvh math entirely.
//
// The tab bar is rendered as a normal div at the bottom of
// IonPage (not position:fixed). IonPage is a flex column,
// so IonContent gets exactly the remaining height — no calc,
// no CSS variables, no guessing.
//
// Pages that need "fill remaining height" (DashboardStaff,
// Transactions) just use height:100% on their inner container
// because IonContent's scroll element already IS that height.
// ============================================================

import React, { useState } from 'react';
import {
  IonPage, IonContent,
  IonTabBar, IonTabButton, IonIcon, IonLabel,
} from '@ionic/react';
import {
  homeOutline, cartOutline, ellipsisHorizontalOutline,
  timeOutline, settingsOutline, logOutOutline, closeOutline,
} from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { W } from '../theme/warmEarth';

interface AppLayoutProps {
  title:      string;
  children:   React.ReactNode;
  scrollY?:   boolean;
  onRefresh?: (complete: () => void) => Promise<void>;
}

// ── Small icon box ─────────────────────────────────────────────
function NavIconBox({
  icon, active = false, danger = false,
}: { icon: string; active?: boolean; danger?: boolean }) {
  const bg    = danger ? W.redPale  : active ? W.greenPale : 'rgba(28,43,26,0.06)';
  const color = danger ? W.red      : active ? W.green     : W.textMuted;
  return (
    <span style={{
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <IonIcon icon={icon} style={{ fontSize: 18, color }} />
    </span>
  );
}

export default function AppLayout({
  title, children, scrollY = true,
}: AppLayoutProps) {
  const { user, logout } = useAuth();
  const history          = useHistory();
  const location         = useLocation();

  const [showMore,   setShowMore]   = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const initial  = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  const handleLogout = async () => {
    await logout();
    history.replace('/login');
  };

  const closeMore = () => setShowMore(false);

  return (
    // IonPage is display:flex flex-direction:column height:100%
    // Its children stack vertically and share the full screen height.
    <IonPage>

      {/* ── IonContent fills ALL space between top and tab bar ── */}
      {/*
        flex:1 + min-height:0 makes it grow to fill the gap
        between the top of the screen and the tab bar below.
        No height calc needed — Ionic handles this natively.
      */}
      <IonContent
        scrollY={scrollY}
        style={{
          '--background': W.pageBg,
          '--overflow': scrollY ? 'auto' : 'hidden',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        } as any}
      >
        <div style={{ padding: '16px', height: scrollY ? undefined : '100%', boxSizing: 'border-box' }}>
          {children}
        </div>
      </IonContent>

      {/* ── Tab bar — normal flow, NOT position:fixed ─────────── */}
      {/*
        Sitting in normal document flow at the bottom of IonPage
        means IonContent is automatically sized to NOT overlap it.
        safe-area-inset-bottom pads below the tappable strip so
        the home indicator bar is covered on gesture-nav devices.
      */}
      <div style={{
        flexShrink: 0,
        backgroundColor: W.cardBg,
        borderTop: `1px solid ${W.border}`,
        paddingBottom: 0,
      }}>
        <IonTabBar style={{
          '--background':     W.cardBg,
          '--border':         'none',
          '--color':          W.textMuted,
          '--color-selected': W.green,
          height: 56,
          display: 'flex',
        } as any}>

          <IonTabButton
            tab="dashboard"
            selected={isActive('/dashboard')}
            onClick={() => history.push('/dashboard')}
          >
            <IonIcon icon={homeOutline} />
            <IonLabel style={{ fontSize: 10, fontWeight: 700 }}>Dashboard</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="pos"
            selected={isActive('/pos')}
            onClick={() => history.push('/pos')}
          >
            <IonIcon icon={cartOutline} />
            <IonLabel style={{ fontSize: 10, fontWeight: 700 }}>Sales</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="more"
            selected={showMore}
            onClick={() => setShowMore(prev => !prev)}
          >
            <IonIcon icon={showMore ? closeOutline : ellipsisHorizontalOutline} />
            <IonLabel style={{ fontSize: 10, fontWeight: 700 }}>
              {showMore ? 'Close' : 'More'}
            </IonLabel>
          </IonTabButton>

        </IonTabBar>
      </div>

      {/* ── "More" bottom sheet ─────────────────────────────── */}
      {showMore && (
        <>
          <div
            onClick={closeMore}
            style={{
              position: 'fixed', inset: 0, zIndex: 900,
              backgroundColor: 'rgba(28,43,26,0.40)',
            }}
          />
          <div style={{
            position: 'fixed', left: 10, right: 10,
            // sits above the tab bar: 56px strip + safe area + gap
            bottom: 64,
            zIndex: 901,
            backgroundColor: '#EAE3D2',
            borderRadius: 20,
            boxShadow: '0 -4px 32px rgba(28,43,26,0.18)',
            border: `1px solid ${W.border}`,
            animation: 'sheetUp 0.22s ease-out',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px 14px',
              borderBottom: `1px solid ${W.border}`,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3E8A2A, #2D6A1F)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 17, flexShrink: 0,
              }}>
                {initial}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: W.text }}>
                  {user?.name}
                </p>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: W.textMuted }}>
                  Staff Account
                </p>
              </div>
            </div>

            {/* Items */}
            <div style={{ padding: '8px 10px 12px' }}>
              <button
                onClick={() => { closeMore(); history.push('/transactions'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 10px', borderRadius: 12,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: W.text, fontSize: 14, fontWeight: 500, textAlign: 'left',
                }}
              >
                <NavIconBox icon={timeOutline} active={isActive('/transactions')} />
                My Transactions
              </button>

              <button
                onClick={() => { closeMore(); history.push('/profile'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 10px', borderRadius: 12,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: W.text, fontSize: 14, fontWeight: 500, textAlign: 'left',
                }}
              >
                <NavIconBox icon={settingsOutline} />
                Profile Settings
              </button>

              <div style={{ borderTop: `1px solid ${W.border}`, margin: '4px 0' }} />

              <button
                onClick={() => { closeMore(); setTimeout(() => setShowLogout(true), 250); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 10px', borderRadius: 12,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: W.red, fontSize: 14, fontWeight: 700, textAlign: 'left',
                }}
              >
                <NavIconBox icon={logOutOutline} danger />
                Sign Out
              </button>
            </div>
          </div>

          <style>{`
            @keyframes sheetUp {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>
        </>
      )}

      {/* ── Logout confirmation modal ────────────────────────── */}
      {showLogout && (
        <>
          <div
            onClick={() => setShowLogout(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              backgroundColor: 'rgba(28,43,26,0.45)',
            }}
          />

          <div style={{
            position: 'fixed', zIndex: 1001,
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(92vw, 340px)',
            backgroundColor: W.cardBg,
            borderRadius: 20,
            boxShadow: '0 8px 40px rgba(28,43,26,0.22)',
            border: `1px solid ${W.border}`,
            padding: '28px 24px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            animation: 'fadeScaleIn 0.18s ease-out',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              backgroundColor: W.redPale,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <IonIcon icon={logOutOutline} style={{ fontSize: 30, color: W.red }} />
            </div>

            <p style={{
              margin: '0 0 8px', fontSize: 17, fontWeight: 800,
              color: W.text, textAlign: 'center',
            }}>
              Sign out of OCMPC?
            </p>

            <p style={{
              margin: '0 0 24px', fontSize: 13,
              color: W.textMuted, textAlign: 'center', lineHeight: 1.5,
            }}>
              You will be redirected to the login page.
            </p>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                onClick={() => setShowLogout(false)}
                style={{
                  flex: 1, padding: '13px',
                  borderRadius: 12,
                  border: `1.5px solid ${W.border}`,
                  backgroundColor: W.cardBg,
                  color: W.text, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, padding: '13px',
                  borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #C0392B, #96281B)',
                  color: '#fff', fontWeight: 800, fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(150,40,27,0.30)',
                }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeScaleIn {
              from { transform: translate(-50%, -50%) scale(0.93); opacity: 0; }
              to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
            }
          `}</style>
        </>
      )}

    </IonPage>
  );
}