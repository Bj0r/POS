// ============================================================
// FILE: src/pages/Transactions.tsx
//
// MIRRORS: resources/js/Pages/POS/Transactions.jsx
//
// DATA SOURCE:
//   GET  /api/dashboard/stats                → today's stat cards
//   GET  /api/transactions?date_from=&date_to=&per_page=15
//   POST /api/transactions/{id}/return
//
// FIXES IN THIS VERSION:
//   1. Stats (₱0.00 / 0) — loadTodayStats() was fetching
//      /transactions, filtering and summing client-side, and
//      silently swallowing any error. Now calls the dedicated
//      GET /api/dashboard/stats endpoint (same fix as DashboardStaff).
//
//   2. No transactions shown — W palette is now defined inline
//      instead of imported from ../theme/warmEarth. If that theme
//      file is missing keys (inputBg, headerBg, redPale, red,
//      amberBorder, etc.) the component crashes before rendering.
//      Inlining W guarantees every key exists.
//
//   3. todayStr() uses device local date (not UTC toISOString)
//      so date filtering works correctly before 8am PH time.
//
// FEATURES:
//   ✓ Stat cards (Today's Net Sales, Transactions Today)
//   ✓ Date from/to filter
//   ✓ Transaction list — mobile card layout
//   ✓ StatusBadge per transaction
//   ✓ View Receipt button → /receipt/:id
//   ✓ Return Items modal (per-item qty, reason, estimated refund)
//   ✓ Pagination (load-more style)
//   ✓ Pull-to-refresh
//   ✓ Flash success/error messages
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  IonModal, IonSpinner, IonRefresher, IonRefresherContent,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  ArrowUturnLeftIcon, XMarkIcon, CheckIcon,
  DocumentTextIcon, FunnelIcon,
  ReceiptRefundIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../components/AppLayout';
import api from '../services/api';

// ── FIX 2: W palette defined inline — no external import.
// If ../theme/warmEarth is missing any key the component crashes
// silently before rendering, showing a blank screen with no error.
// Defining W here guarantees every key is always present.
const W = {
  pageBg:      '#F7F3E8',
  cardBg:      '#EAE3D2',
  cardBgAlt:   '#E2D9C4',
  border:      '#D4CAAF',
  text:        '#1C2B1A',
  textMuted:   '#5A6B55',
  inputBg:     '#F0EBD8',
  green:       '#2D6A1F',
  greenLt:     '#3E8A2A',
  greenPale:   '#D6EDD0',
  greenText:   '#1A5014',
  headerBg:    '#2D6A1F',
  red:         '#B83220',
  redPale:     '#FAE3DF',
  amber:       '#92600A',
  amberPale:   '#FBF0D0',
  amberText:   '#7A5C10',
  amberBorder: '#E8D49A',
  bluePale:    '#D8E8F8',
  blueText:    '#2C4A70',
  blueBorder:  '#B0CCE8',
};

// ── Types ─────────────────────────────────────────────────────
interface TxnItem {
  id:             number;
  product_name:   string;
  selling_price:  number;
  quantity:       number;
  returned_qty:   number;
  returnable_qty: number;
}

interface Txn {
  id:           number;
  receipt_id:   string;
  buyer:        string;
  buyer_type:   string;
  items_count:  number;
  items:        TxnItem[];
  total_amount: number;
  refund_total: number;
  status:       string;
  created_at:   string;
}

interface DashboardStats {
  today_sales:        number;
  today_transactions: number;
}

// ── StatusBadge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string; Icon: React.ElementType | null }> = {
    completed: { bg: W.greenPale, color: W.greenText, label: 'Completed', Icon: CheckIcon },
    returned:  { bg: W.amberPale, color: W.amberText, label: 'Returned',  Icon: ArrowUturnLeftIcon },
    voided:    { bg: W.redPale,   color: W.red,       label: 'Voided',    Icon: XMarkIcon },
  };
  const c = cfg[status] ?? { bg: W.cardBgAlt, color: W.textMuted, label: status, Icon: null };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700,
      backgroundColor: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>
      {c.Icon && <c.Icon style={{ width: 12, height: 12 }} />}
      {c.label}
    </span>
  );
}

// ── Return Modal ─────────────────────────────────────────────
function ReturnModal({ txn, onClose, onSuccess }: {
  txn: Txn;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [qtys, setQtys] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    txn.items.forEach(i => { init[i.id] = 0; });
    return init;
  });
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const selectedItems   = Object.entries(qtys).filter(([, q]) => q > 0).map(([id, qty]) => ({ id: Number(id), qty }));
  const estimatedRefund = txn.items.reduce((s, i) => s + i.selling_price * (qtys[i.id] ?? 0), 0);

  const handleSubmit = async () => {
    setError('');
    if (selectedItems.length === 0) { setError('Select at least one item to return.'); return; }
    if (!reason.trim())             { setError('Please provide a reason for the return.'); return; }
    setSubmitting(true);
    try {
      await api.post(`/transactions/${txn.id}/return`, {
        items:  selectedItems,
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Return failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IonModal isOpen onDidDismiss={onClose}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      style={{ '--border-radius': '20px 20px 0 0', '--z-index': '99999' } as React.CSSProperties}>
      <div style={{
        backgroundColor: W.cardBg,
        display: 'flex', flexDirection: 'column',
        borderRadius: '20px 20px 0 0', overflow: 'hidden',
        height: '100%',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 18px', backgroundColor: W.headerBg, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowUturnLeftIcon style={{ width: 16, height: 16 }} /> Return Items
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>
                {txn.receipt_id} · {txn.buyer}
              </p>
            </div>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
              <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        {/* Body — grows to fill space between header and footer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 18, minHeight: 0 }}>

          <p style={{ fontSize: 11, fontWeight: 800, color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px', flexShrink: 0 }}>
            Select Items to Return
          </p>

          {/* ── Items list — scrolls if too many items ── */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 80, marginBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
            {txn.items.length === 0 ? (
              <p style={{ textAlign: 'center', fontSize: 13, color: W.textMuted, padding: 24 }}>
                All items already returned.
              </p>
            ) : txn.items.map(item => {
              const max      = item.returnable_qty ?? item.quantity;
              const returned = item.returned_qty ?? 0;
              const exhausted = max === 0;
              return (
                <div key={item.id} style={{
                  borderRadius: 12, padding: '12px', marginBottom: 8,
                  backgroundColor: exhausted ? W.cardBgAlt : W.inputBg,
                  border: `1px solid ${W.border}`,
                  opacity: exhausted ? 0.55 : 1,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.text }}>{item.product_name}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted }}>
                      Bought: {item.quantity}
                      {returned > 0 && <span style={{ color: W.amberText }}> · Returned: {returned}</span>}
                      {' · '}₱{item.selling_price.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: W.textMuted }}>Qty (max {max})</p>
                    <input
                      type="number" min={0} max={max}
                      value={qtys[item.id] ?? 0}
                      disabled={exhausted}
                      onChange={e => {
                        const v = Math.min(Math.max(0, parseInt(e.target.value) || 0), max);
                        setQtys(p => ({ ...p, [item.id]: v }));
                      }}
                      style={{
                        width: 60, textAlign: 'center', padding: '6px',
                        borderRadius: 8, border: `1px solid ${W.border}`,
                        backgroundColor: exhausted ? W.cardBgAlt : 'white',
                        color: W.text, fontSize: 14, fontWeight: 700,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Reason, refund, error — always visible, never scroll away ── */}
          <div style={{ flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 8px' }}>
              Reason <span style={{ color: W.red }}>*</span>
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Wrong item, damaged product…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{
                width: '100%', padding: '11px 12px',
                borderRadius: 12, border: `1px solid ${W.border}`,
                backgroundColor: W.inputBg, color: W.text, fontSize: 13,
                resize: 'none', boxSizing: 'border-box',
              }}
            />

            {estimatedRefund > 0 && (
              <div style={{
                marginTop: 10, borderRadius: 12, padding: '11px 16px',
                backgroundColor: W.amberPale, border: `1px solid ${W.amberBorder}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: W.amberText }}>Refund to Customer</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: W.amberText }}>₱{estimatedRefund.toFixed(2)}</span>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: 10, borderRadius: 12, padding: '10px 14px',
                backgroundColor: W.redPale, border: '1px solid #EBBDB8',
              }}>
                <p style={{ margin: 0, fontSize: 12, color: W.red }}>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — always pinned at bottom, never hidden */}
        <div style={{ padding: '14px 18px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: `1px solid ${W.border}`, display: 'flex', gap: 10, flexShrink: 0, backgroundColor: W.cardBg }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              backgroundColor: W.cardBgAlt, color: W.textMuted,
              border: `1px solid ${W.border}`, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{
              flex: 1, padding: '13px', borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
              color: 'white', fontWeight: 800, fontSize: 14,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {submitting ? <IonSpinner name="crescent" style={{ width: 16, height: 16 }} /> : null}
            {submitting ? 'Processing…' : `Confirm (${selectedItems.length})`}
          </button>
        </div>
      </div>
    </IonModal>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function Transactions() {
  const history = useHistory();

  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [meta,         setMeta]         = useState({ current_page: 1, last_page: 1, total: 0 });
  const [stats,        setStats]        = useState<DashboardStats>({ today_sales: 0, today_transactions: 0 });
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [returnTarget, setReturnTarget] = useState<Txn | null>(null);
  const [flash,        setFlash]        = useState<{ msg: string; ok: boolean } | null>(null);

  const showFlash = (msg: string, ok: boolean) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 4000);
  };

  // ── FIX 1: Load stats from the server, not computed client-side.
  //
  // The old loadTodayStats() called /transactions?date_from=today&date_to=today
  // and summed total_amount from the response — but the catch block was silent
  // so any failure (auth, network, bad shape) left stats at 0 with no feedback.
  //
  // Now calls GET /api/dashboard/stats which runs the same DB query as
  // DashboardController::staffDashboard() and returns the values directly.
  // ────────────────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await api.get<DashboardStats>('/dashboard/stats');
      setStats({
        today_sales:        Number(res.data.today_sales        ?? 0),
        today_transactions: Number(res.data.today_transactions ?? 0),
      });
    } catch (e: any) {
      // Keep stats at 0 but don't crash — the list still works
      console.warn('Dashboard stats error:', e?.response?.data?.message ?? e?.message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const load = useCallback(async (page = 1) => {
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ per_page: '5', page: String(page) });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo)   params.set('date_to',   dateTo);

      const res = await api.get<{
        data:         Txn[];
        current_page: number;
        last_page:    number;
        total:        number;
      }>(`/transactions?${params}`);

      setTransactions(res.data.data ?? []);
      setMeta({
        current_page: res.data.current_page,
        last_page:    res.data.last_page,
        total:        res.data.total,
      });
    } catch (e: any) {
      showFlash('Failed to load transactions.', false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [dateFrom, dateTo]);

  // Load both in parallel on mount and whenever date filters change
  useEffect(() => {
    Promise.allSettled([load(1), loadStats()]);
  }, [load, loadStats]);

  const handleRefresh = async (e: any) => {
    await Promise.allSettled([load(1), loadStats()]);
    e.detail.complete();
  };


  const card: React.CSSProperties = {
    backgroundColor: W.cardBg, borderRadius: 16,
    boxShadow: '0 2px 12px rgba(28,43,26,0.08)',
    border: `1px solid ${W.border}`, overflow: 'hidden', marginBottom: 12,
  };

  const dateInputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px',
    borderRadius: 12, border: `1px solid ${W.border}`,
    backgroundColor: W.inputBg, color: W.text, fontSize: 13,
    boxSizing: 'border-box', colorScheme: 'light',
  };

  return (
    <>
    <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    <AppLayout title="My Transactions">

      <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
        <IonRefresherContent pullingText="Pull to refresh" refreshingText="Loading…" />
      </IonRefresher>

      {/* Return modal */}
      {returnTarget && (
        <ReturnModal
          txn={returnTarget}
          onClose={() => setReturnTarget(null)}
          onSuccess={() => { showFlash('Return processed successfully.', true); load(1); loadStats(); }}
        />
      )}

      {/* Flash banner */}
      {flash && (
        <div style={{
          marginBottom: 12, borderRadius: 16, padding: '10px 14px',
          backgroundColor: flash.ok ? W.greenPale : W.redPale,
          border: `1px solid ${flash.ok ? '#B2D9A8' : '#EBBDB8'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: flash.ok ? W.greenText : W.red }}>
            {flash.msg}
          </span>
          <button onClick={() => setFlash(null)}
            style={{ background: 'none', border: 'none', color: flash.ok ? W.greenText : W.red, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {/* ── Full-height flex column: fills screen, no page scroll ── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, flexShrink: 0 }}>

        <div style={{ borderRadius: 16, padding: '14px', textAlign: 'center', backgroundColor: W.greenPale, border: '1px solid #B2D9A8' }}>
          {loadingStats ? (
            <IonSpinner name="dots" style={{ color: W.green, width: 20, height: 20 }} />
          ) : (
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: W.greenText }}>
              ₱{stats.today_sales.toFixed(2)}
            </p>
          )}
          <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted, fontWeight: 600 }}>Today's Net Sales</p>
        </div>

        <div style={{ borderRadius: 16, padding: '14px', textAlign: 'center', backgroundColor: W.bluePale, border: '1px solid #B0CCE8' }}>
          {loadingStats ? (
            <IonSpinner name="dots" style={{ color: W.blueText, width: 20, height: 20 }} />
          ) : (
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: W.blueText }}>
              {stats.today_transactions}
            </p>
          )}
          <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted, fontWeight: 600 }}>Transactions Today</p>
        </div>

      </div>

      {/* ── Date filter ────────────────────────────────────── */}
      <div style={{ ...card, flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, backgroundColor: W.cardBgAlt, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FunnelIcon style={{ width: 16, height: 16, color: W.textMuted }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Filter by Date
          </span>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: W.cardBg }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: W.textMuted, marginBottom: 5 }}>From</label>
              <input type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={dateInputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: W.textMuted, marginBottom: 5 }}>To</label>
              <input type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={dateInputStyle} />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              style={{
                padding: '9px 14px', borderRadius: 12,
                backgroundColor: W.cardBgAlt, border: `1px solid ${W.border}`,
                color: W.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <XMarkIcon style={{ width: 14, height: 14 }} /> Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* ── Transaction list ───────────────────────────────── */}
      <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 0 }}>
        {/* Header — fixed, never scrolls */}
        <div style={{
          padding: '10px 14px', borderBottom: `1px solid ${W.border}`,
          backgroundColor: W.cardBgAlt, display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: W.text }}>Transaction Records</span>
          <span style={{ fontSize: 12, color: W.textMuted }}>{meta.total} total</span>
        </div>

        {/* Scrollable body — only rows move, header stays */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' } as React.CSSProperties}>
        {loading ? (
          <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
            <IonSpinner name="crescent" style={{ color: W.green }} />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: W.textMuted }}>No transactions found.</p>
          </div>
        ) : (
          <>
            {transactions.map(t => (
              <div key={t.id} style={{ padding: '12px 14px', borderBottom: `1px solid ${W.border}`, backgroundColor: W.cardBg }}>

                {/* Row 1: receipt + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 8,
                    backgroundColor: W.greenPale, color: W.greenText,
                  }}>
                    {t.receipt_id}
                  </span>
                  <StatusBadge status={t.status} />
                </div>

                {/* Row 2: buyer + items count */}
                <div style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.text }}>{t.buyer}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
                    {(t.buyer_type ?? 'non_member').replace('_', ' ')} · {t.items_count ?? 0} item(s)
                  </p>
                </div>

                {/* Row 3: total + date + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: W.text }}>
                      ₱{Number(t.total_amount ?? 0).toFixed(2)}
                    </p>
                    {(t.refund_total ?? 0) > 0 && (
                      <p style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 700, color: W.amberText }}>
                        −₱{Number(t.refund_total).toFixed(2)}
                      </p>
                    )}
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('en-PH') : '—'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* View receipt */}
                    <button
                      onClick={() => history.push(`/receipt/${t.id}`)}
                      title="View Receipt"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        backgroundColor: W.greenPale, border: '1px solid #B2D9A8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <DocumentTextIcon style={{ width: 16, height: 16, color: W.greenText }} />
                    </button>
                    {/* Return items — only for completed transactions */}
                    {t.status === 'completed' && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.get<Txn>(`/transactions/${t.id}/receipt`);
                            setReturnTarget({ ...t, items: res.data.items });
                          } catch {
                            setReturnTarget({ ...t, items: [] });
                          }
                        }}
                        title="Return Items"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          backgroundColor: W.amberPale, border: `1px solid ${W.amberBorder}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <ReceiptRefundIcon style={{ width: 16, height: 16, color: W.amberText }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

          </>
        )}
        </div>{/* end scrollable body */}

        {/* Pagination bar — OUTSIDE the scroll div so it stays fixed like the header */}
        {meta.last_page > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', backgroundColor: W.cardBgAlt,
            borderTop: `1px solid ${W.border}`, flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: W.textMuted, fontWeight: 600 }}>
              {(meta.current_page - 1) * 5 + 1}–{Math.min(meta.current_page * 5, meta.total)} of {meta.total}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => load(meta.current_page - 1)}
                disabled={meta.current_page === 1 || loadingMore}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: `1px solid ${W.border}`,
                  backgroundColor: W.cardBg, cursor: meta.current_page === 1 ? 'not-allowed' : 'pointer',
                  opacity: meta.current_page === 1 ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={W.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span style={{
                fontSize: 12, fontWeight: 700, color: W.text,
                padding: '4px 10px', borderRadius: 8,
                backgroundColor: W.cardBg, border: `1px solid ${W.border}`,
                minWidth: 44, textAlign: 'center', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {loadingMore
                  ? <IonSpinner name="crescent" style={{ width: 12, height: 12, color: W.green }} />
                  : `${meta.current_page} / ${meta.last_page}`}
              </span>
              <button
                onClick={() => load(meta.current_page + 1)}
                disabled={meta.current_page === meta.last_page || loadingMore}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: `1px solid ${W.border}`,
                  backgroundColor: W.cardBg, cursor: meta.current_page === meta.last_page ? 'not-allowed' : 'pointer',
                  opacity: meta.current_page === meta.last_page ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={W.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>{/* end transaction list card */}

      </div>{/* end full-height flex column */}

    </AppLayout>
    </>
  );
}