// ============================================================
// FILE: src/pages/DashboardStaff.tsx
//
// CHANGES:
//   1. Receipt button now uses IonIcon receiptOutline — same
//      style as NavIconBox in AppLayout (no emoji).
//   2. Added IonRefresher directly (header removed from layout).
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { IonSpinner, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/react';
import { cashOutline, cartOutline, receiptOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import { W } from '../theme/warmEarth';

// ── Types ─────────────────────────────────────────────────────
interface TxnSummary {
  id:           number;
  receipt_id:   string;
  buyer:        string;
  buyer_type:   string;
  items_count:  number;
  total_amount: number;
  refund_total: number;
  status:       string;
  created_at:   string;
}

// ── Stat icon box — same shape as NavIconBox in AppLayout ─────
function StatIconBox({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 8px',
    }}>
      <IonIcon icon={icon} style={{ fontSize: 20, color }} />
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    completed: { bg: W.greenPale, color: W.greenText, label: '✓ Completed' },
    returned:  { bg: W.amberPale, color: W.amberText, label: '↩ Returned'  },
    voided:    { bg: W.redPale,   color: W.red,       label: '✕ Voided'    },
  };
  const c = cfg[status] ?? { bg: W.cardBgAlt, color: W.textMuted, label: status };
  return (
    <span style={{
      display: 'inline-block', borderRadius: 20,
      padding: '2px 8px', fontSize: 11, fontWeight: 700,
      backgroundColor: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Main ──────────────────────────────────────────────────────
export default function DashboardStaff() {
  const { user }  = useAuth();
  const history   = useHistory();

  const [recent,        setRecent]        = useState<TxnSummary[]>([]);
  const [todaySales,    setTodaySales]    = useState(0);
  const [todayCount,    setTodayCount]    = useState(0);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingStats,  setLoadingStats]  = useState(true);
  const [errorRecent,   setErrorRecent]   = useState('');

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    setErrorRecent('');
    try {
      const res = await api.get<{ data: TxnSummary[] }>('/transactions?per_page=10');
      setRecent((res.data.data ?? []).slice(0, 5));
    } catch {
      setErrorRecent('Could not load recent transactions.');
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const loadTodayStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const today = todayStr();
      const res = await api.get<{ data: TxnSummary[] }>(
        `/transactions?per_page=50&date_from=${today}&date_to=${today}`
      );
      const d = (res.data.data ?? []).filter(
        t => t.status === 'completed' || t.status === 'returned'
      );
      setTodaySales(d.reduce((s, t) => s + t.total_amount, 0));
      setTodayCount(d.length);
    } catch {
      // non-fatal
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.allSettled([loadRecent(), loadTodayStats()]);
  }, [loadRecent, loadTodayStats]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async (e: any) => {
    await loadAll();
    e.detail.complete();
  };

  const card: React.CSSProperties = {
    backgroundColor: W.cardBg, borderRadius: 16,
    boxShadow: '0 2px 12px rgba(28,43,26,0.08)',
    border: `1px solid ${W.border}`, overflow: 'hidden', marginBottom: 12,
  };

  return (
    <>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <AppLayout title="Dashboard">

        {/* Pull to refresh — must be direct child of IonContent */}
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingText="Loading…" />
        </IonRefresher>

        {/* ── Welcome banner ──────────────────────────────── */}
        <div style={{
          borderRadius: 16, padding: '16px', marginBottom: 12, color: 'white',
          background: `linear-gradient(135deg, ${W.green}, ${W.greenLt})`,
          boxShadow: '0 4px 20px rgba(45,106,31,0.25)',
        }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Welcome back
          </p>
          <h2 style={{ margin: '2px 0 4px', fontSize: 18, fontWeight: 900 }}>{user?.name ?? '…'}</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <button
            onClick={() => history.push('/pos')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              borderRadius: 10, padding: '7px 14px',
              backgroundColor: W.cardBg, color: W.greenText,
              border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}
          >
            Start New Sale →
          </button>
        </div>

        {/* ── Stat cards ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

          <div style={{
            borderRadius: 16, padding: '14px', textAlign: 'center',
            backgroundColor: W.greenPale, border: '1px solid #B2D9A8',
            boxShadow: '0 4px 20px rgba(45,106,31,0.10)',
          }}>
            <StatIconBox icon={cashOutline} color={W.greenText} bg="rgba(255,255,255,0.55)" />
            {loadingStats
              ? <IonSpinner name="dots" style={{ color: W.green, width: 20, height: 20 }} />
              : <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: W.greenText }}>₱{todaySales.toFixed(2)}</p>
            }
            <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted, fontWeight: 600 }}>Today's Sales</p>
          </div>

          <div style={{
            borderRadius: 16, padding: '14px', textAlign: 'center',
            backgroundColor: W.bluePale, border: '1px solid #B0CCE8',
            boxShadow: '0 4px 20px rgba(44,74,112,0.08)',
          }}>
            <StatIconBox icon={cartOutline} color={W.blueText} bg="rgba(255,255,255,0.55)" />
            {loadingStats
              ? <IonSpinner name="dots" style={{ color: W.blueText, width: 20, height: 20 }} />
              : <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: W.blueText }}>{todayCount}</p>
            }
            <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted, fontWeight: 600 }}>Transactions Today</p>
          </div>
        </div>

        {/* ── Recent transactions ─────────────────────────── */}
        <div style={card}>
          <div style={{
            padding: '10px 14px', borderBottom: `1px solid ${W.border}`,
            backgroundColor: W.cardBgAlt,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: W.text }}>Recent Transactions</span>
            <button
              onClick={() => history.push('/transactions')}
              style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: W.green, cursor: 'pointer' }}
            >
              View all →
            </button>
          </div>

          {loadingRecent && (
            <div style={{ padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
              <IonSpinner name="crescent" style={{ color: W.green }} />
            </div>
          )}

          {!loadingRecent && errorRecent && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: W.red, margin: 0 }}>{errorRecent}</p>
              <button onClick={loadRecent} style={{
                marginTop: 10, padding: '8px 16px', borderRadius: 10,
                border: `1px solid ${W.border}`, backgroundColor: W.cardBgAlt,
                color: W.textMuted, fontSize: 12, cursor: 'pointer',
              }}>Retry</button>
            </div>
          )}

          {!loadingRecent && !errorRecent && recent.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: W.textMuted }}>No transactions recorded yet.</p>
            </div>
          )}

          {!loadingRecent && !errorRecent && recent.length > 0 && (
            <div className="no-scrollbar" style={{ overflowY: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none', maxHeight: 400 } as React.CSSProperties}>

              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1.4fr auto',
                padding: '8px 14px', backgroundColor: W.green, gap: 8,
              }}>
                {['RECEIPT', 'BUYER', 'TOTAL', 'STATUS', ''].map((h, i) => (
                  <span key={i} style={{
                    fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)',
                    letterSpacing: 0.5, textAlign: i >= 2 ? 'center' : 'left',
                  }}>{h}</span>
                ))}
              </div>

              {recent.map(txn => (
                <div key={txn.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1.4fr auto',
                  padding: '10px 14px', borderBottom: `1px solid ${W.border}`,
                  backgroundColor: W.cardBg, alignItems: 'center', gap: 8,
                }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: W.greenText }}>
                      {txn.receipt_id}
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: W.textMuted }}>
                      {txn.created_at ? new Date(txn.created_at).toLocaleDateString('en-PH') : '—'}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: W.text }}>{txn.buyer}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: W.text, textAlign: 'center' }}>
                    ₱{txn.total_amount.toFixed(2)}
                  </span>
                  <div style={{ textAlign: 'center' }}>
                    <StatusBadge status={txn.status} />
                  </div>

                  {/* ── Receipt icon button — matches NavIconBox style ── */}
                  <button
                    onClick={() => history.push(`/receipt/${txn.id}`)}
                    style={{
                      width: 34, height: 34, borderRadius: 10,
                      backgroundColor: W.greenPale,
                      border: '1px solid #B2D9A8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={receiptOutline} style={{ fontSize: 18, color: W.greenText }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </AppLayout>
    </>
  );
}