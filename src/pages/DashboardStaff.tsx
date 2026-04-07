// ============================================================
// FILE: src/pages/DashboardStaff.tsx
// REDESIGN: Compact, no-scroll layout — everything fits the screen.
// All logic preserved; only spacing/sizing adjusted.
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

interface DashboardStats {
  today_sales:        number;
  today_transactions: number;
}

// ── Stat icon box — compact 28×28 ─────────────────────────────
function StatIconBox({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 5px',
    }}>
      <IonIcon icon={icon} style={{ fontSize: 15, color }} />
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    completed: { bg: W.greenPale, color: W.greenText, label: '✓ Done'     },
    returned:  { bg: W.amberPale, color: W.amberText, label: '↩ Return'   },
    voided:    { bg: W.redPale,   color: W.red,       label: '✕ Void'     },
  };
  const c = cfg[status] ?? { bg: W.cardBgAlt, color: W.textMuted, label: status };
  return (
    <span style={{
      display: 'inline-block', borderRadius: 20,
      padding: '2px 6px', fontSize: 10, fontWeight: 700,
      backgroundColor: c.bg, color: c.color,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DashboardStaff() {
  const { user }  = useAuth();
  const history   = useHistory();

  const [recent,        setRecent]        = useState<TxnSummary[]>([]);
  const [stats,         setStats]         = useState<DashboardStats>({ today_sales: 0, today_transactions: 0 });
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingStats,  setLoadingStats]  = useState(true);
  const [errorRecent,   setErrorRecent]   = useState('');
  const [errorStats,    setErrorStats]    = useState('');

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    setErrorRecent('');
    try {
      const res = await api.get<{ data: TxnSummary[] }>('/transactions?per_page=20');
      setRecent((res.data.data ?? []).slice(0, 8));
    } catch {
      setErrorRecent('Could not load recent transactions.');
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setErrorStats('');
    try {
      const res = await api.get<DashboardStats>('/dashboard/stats');
      setStats({
        today_sales:        Number(res.data.today_sales        ?? 0),
        today_transactions: Number(res.data.today_transactions ?? 0),
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Could not load today\'s stats.';
      setErrorStats(msg);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.allSettled([loadRecent(), loadStats()]);
  }, [loadRecent, loadStats]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async (e: any) => {
    await loadAll();
    e.detail.complete();
  };

  const card: React.CSSProperties = {
    backgroundColor: W.cardBg, borderRadius: 14,
    boxShadow: '0 2px 10px rgba(28,43,26,0.08)',
    border: `1px solid ${W.border}`, overflow: 'hidden',
  };

  return (
    <>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <AppLayout title="Dashboard">

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingText="Loading…" />
        </IonRefresher>

        {/* ── Full-height flex column — fills viewport, no page scroll ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          // height:100% works because IonContent is already sized
          // to the exact remaining space above the tab bar.
          height: '100%',
          gap: 8,
        }}>

          {/* ── Welcome banner ──────────────────────────────────── */}
          <div style={{
            borderRadius: 14, padding: '10px 14px', color: 'white', flexShrink: 0,
            background: `linear-gradient(135deg, ${W.green}, ${W.greenLt})`,
            boxShadow: '0 3px 16px rgba(45,106,31,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Welcome back
              </p>
              <h2 style={{ margin: '1px 0 2px', fontSize: 16, fontWeight: 900, lineHeight: 1.2 }}>
                {user?.name ?? '…'}
              </h2>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.72)' }}>
                {new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => history.push('/pos')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                borderRadius: 10, padding: '7px 13px',
                backgroundColor: W.cardBg, color: W.greenText,
                border: 'none', fontWeight: 800, fontSize: 11, cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              New Sale →
            </button>
          </div>

          {/* ── Stat cards ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>

            <div style={{
              borderRadius: 14, padding: '10px', textAlign: 'center',
              backgroundColor: W.greenPale, border: '1px solid #B2D9A8',
              boxShadow: '0 3px 14px rgba(45,106,31,0.09)',
            }}>
              <StatIconBox icon={cashOutline} color={W.greenText} bg="rgba(255,255,255,0.55)" />
              {loadingStats ? (
                <IonSpinner name="dots" style={{ color: W.green, width: 18, height: 18 }} />
              ) : errorStats ? (
                <p style={{ margin: 0, fontSize: 10, color: W.red }}>—</p>
              ) : (
                <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: W.greenText, lineHeight: 1 }}>
                  ₱{stats.today_sales.toFixed(2)}
                </p>
              )}
              <p style={{ margin: '3px 0 0', fontSize: 10, color: W.textMuted, fontWeight: 600 }}>Today's Sales</p>
            </div>

            <div style={{
              borderRadius: 14, padding: '10px', textAlign: 'center',
              backgroundColor: W.bluePale, border: '1px solid #B0CCE8',
              boxShadow: '0 3px 14px rgba(44,74,112,0.07)',
            }}>
              <StatIconBox icon={cartOutline} color={W.blueText} bg="rgba(255,255,255,0.55)" />
              {loadingStats ? (
                <IonSpinner name="dots" style={{ color: W.blueText, width: 18, height: 18 }} />
              ) : errorStats ? (
                <p style={{ margin: 0, fontSize: 10, color: W.red }}>—</p>
              ) : (
                <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: W.blueText, lineHeight: 1 }}>
                  {stats.today_transactions}
                </p>
              )}
              <p style={{ margin: '3px 0 0', fontSize: 10, color: W.textMuted, fontWeight: 600 }}>Transactions Today</p>
            </div>
          </div>

          {/* ── Stats error banner ──────────────────────────────── */}
          {errorStats && (
            <div style={{
              padding: '8px 12px', borderRadius: 10, flexShrink: 0,
              backgroundColor: W.redPale, border: `1px solid ${W.red}`,
              fontSize: 11, color: W.red, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ flex: 1 }}>Stats error: {errorStats}</span>
              <button onClick={loadStats} style={{
                padding: '2px 8px', borderRadius: 7,
                border: `1px solid ${W.red}`, backgroundColor: 'transparent',
                color: W.red, fontSize: 10, cursor: 'pointer', flexShrink: 0,
              }}>Retry</button>
            </div>
          )}

          {/* ── Recent transactions — flex:1, fills all remaining space ── */}
          <div style={{
            ...card, flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', marginBottom: 0,
          }}>

            {/* Fixed header */}
            <div style={{
              padding: '8px 12px', borderBottom: `1px solid ${W.border}`,
              backgroundColor: W.cardBgAlt, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: W.text }}>Recent Transactions</span>
              <button
                onClick={() => history.push('/transactions')}
                style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 700, color: W.green, cursor: 'pointer' }}
              >
                View all →
              </button>
            </div>

            {/* Loading */}
            {loadingRecent && (
              <div style={{ padding: '28px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                <IonSpinner name="crescent" style={{ color: W.green }} />
              </div>
            )}

            {/* Error */}
            {!loadingRecent && errorRecent && (
              <div style={{ padding: '16px', textAlign: 'center', flexShrink: 0 }}>
                <p style={{ fontSize: 11, color: W.red, margin: 0 }}>{errorRecent}</p>
                <button onClick={loadRecent} style={{
                  marginTop: 8, padding: '6px 14px', borderRadius: 8,
                  border: `1px solid ${W.border}`, backgroundColor: W.cardBgAlt,
                  color: W.textMuted, fontSize: 11, cursor: 'pointer',
                }}>Retry</button>
              </div>
            )}

            {/* Empty */}
            {!loadingRecent && !errorRecent && recent.length === 0 && (
              <div style={{ padding: '28px', textAlign: 'center', flexShrink: 0 }}>
                <p style={{ fontSize: 12, color: W.textMuted }}>No transactions recorded yet.</p>
              </div>
            )}

            {/* Table */}
            {!loadingRecent && !errorRecent && recent.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

                {/* Column headers — fixed */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1.3fr auto',
                  padding: '6px 12px', backgroundColor: W.green, gap: 6, flexShrink: 0,
                }}>
                  {['RECEIPT', 'BUYER', 'TOTAL', 'STATUS', ''].map((h, i) => (
                    <span key={i} style={{
                      fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.9)',
                      letterSpacing: 0.6, textAlign: i >= 2 ? 'center' : 'left',
                    }}>{h}</span>
                  ))}
                </div>

                {/* Scrollable rows */}
                <div
                  className="no-scrollbar"
                  style={{ flex: 1, overflowY: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' } as React.CSSProperties}
                >
                  {recent.map(txn => (
                    <div key={txn.id} style={{
                      display: 'grid', gridTemplateColumns: '2fr 2fr 1.2fr 1.3fr auto',
                      padding: '8px 12px', borderBottom: `1px solid ${W.border}`,
                      backgroundColor: W.cardBg, alignItems: 'center', gap: 6,
                    }}>
                      {/* Receipt + date */}
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: W.greenText }}>
                          {txn.receipt_id}
                        </span>
                        <p style={{ margin: '1px 0 0', fontSize: 9, color: W.textMuted }}>
                          {txn.created_at ? new Date(txn.created_at).toLocaleDateString('en-PH') : '—'}
                        </p>
                      </div>
                      {/* Buyer */}
                      <span style={{ fontSize: 11, fontWeight: 600, color: W.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {txn.buyer}
                      </span>
                      {/* Amount */}
                      <span style={{ fontSize: 12, fontWeight: 800, color: W.text, textAlign: 'center' }}>
                        ₱{txn.total_amount.toFixed(2)}
                      </span>
                      {/* Status */}
                      <div style={{ textAlign: 'center' }}>
                        <StatusBadge status={txn.status} />
                      </div>
                      {/* Receipt button */}
                      <button
                        onClick={() => history.push(`/receipt/${txn.id}`)}
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          backgroundColor: W.greenPale, border: '1px solid #B2D9A8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        <IonIcon icon={receiptOutline} style={{ fontSize: 14, color: W.greenText }} />
                      </button>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>

        </div>{/* end full-height column */}

      </AppLayout>
    </>
  );
}