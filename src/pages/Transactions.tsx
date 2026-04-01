// ============================================================
// FILE: src/pages/Transactions.tsx
//
// MIRRORS: resources/js/Pages/POS/Transactions.jsx
//
// DATA SOURCE:
//   GET /api/transactions?date_from=&date_to=&per_page=15
//   POST /api/transactions/{id}/return
//
// FEATURES CARRIED OVER:
//   ✓ Stat cards (Today's Net Sales, Transactions Today)
//   ✓ Date from/to filter
//   ✓ Transaction list — mobile card layout (same as web mobile)
//   ✓ StatusBadge per transaction
//   ✓ View Receipt button → /receipt/:id
//   ✓ Return Items modal (same logic as web ReturnModal)
//     - Per-item qty input (0 to returnable_qty max)
//     - Reason textarea
//     - Estimated refund display
//   ✓ Pagination (load-more style — more natural on mobile)
//   ✓ Pull-to-refresh
//   ✓ Flash success/error messages
//   ✓ Warm Earth palette throughout
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
import { W } from '../theme/warmEarth';

// ── Types ─────────────────────────────────────────────────────
interface TxnItem {
  id:            number;
  product_name:  string;
  selling_price: number;
  quantity:      number;
  returned_qty:  number;
  returnable_qty:number;
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
function ReturnModal({ txn, onClose, onSuccess }: { txn: Txn; onClose: () => void; onSuccess: () => void }) {
  const [qtys, setQtys]     = useState<Record<number, number>>(() => {
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
    <IonModal isOpen onDidDismiss={onClose} initialBreakpoint={0.65} breakpoints={[0, 0.65]}
      style={{ '--border-radius': '24px 24px 0 0' } as React.CSSProperties}>
      <div style={{ backgroundColor: W.cardBg, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '24px 24px 0 0', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 18px', backgroundColor: W.headerBg, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowUturnLeftIcon style={{ width: 16, height: 16 }} /> Return Items</p>
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

        {/* Content — scrollable */}
        <div style={{ overflowY: 'auto', padding: 18 }}>

          {/* Items */}
          <p style={{ fontSize: 11, fontWeight: 800, color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px' }}>
            Select Items to Return
          </p>

          {txn.items.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 13, color: W.textMuted, padding: 24 }}>All items already returned.</p>
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

          {/* Reason */}
          <p style={{ fontSize: 11, fontWeight: 800, color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 8px' }}>
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

          {/* Estimated refund */}
          {estimatedRefund > 0 && (
            <div style={{
              marginTop: 12, borderRadius: 12, padding: '12px 16px',
              backgroundColor: W.amberPale, border: `1px solid ${W.amberBorder}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: W.amberText }}>Refund to Customer</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: W.amberText }}>₱{estimatedRefund.toFixed(2)}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 12, borderRadius: 12, padding: '10px 14px',
              backgroundColor: W.redPale, border: '1px solid #EBBDB8',
            }}>
              <p style={{ margin: 0, fontSize: 12, color: W.red }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${W.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
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
  const [stats,        setStats]        = useState({ today_total: 0, today_count: 0 });
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [returnTarget, setReturnTarget] = useState<Txn | null>(null);
  const [flash,        setFlash]        = useState<{ msg: string; ok: boolean } | null>(null);

  const showFlash = (msg: string, ok: boolean) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 4000);
  };

  const load = useCallback(async (page = 1, append = false) => {
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ per_page: '15', page: String(page) });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo)   params.set('date_to',   dateTo);

      const res = await api.get<{
        data: Txn[];
        current_page: number;
        last_page: number;
        total: number;
      }>(`/transactions?${params}`);

      if (append) {
        setTransactions(prev => [...prev, ...res.data.data]);
      } else {
        setTransactions(res.data.data);
      }
      setMeta({ current_page: res.data.current_page, last_page: res.data.last_page, total: res.data.total });

      // Compute today's stats from first page
      if (page === 1) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayTxns = res.data.data.filter(t =>
          t.created_at?.startsWith(todayStr) &&
          (t.status === 'completed' || t.status === 'returned')
        );
        setStats({
          today_total: todayTxns.reduce((s, t) => s + t.total_amount, 0),
          today_count: todayTxns.length,
        });
      }
    } catch (e) {
      showFlash('Failed to load transactions.', false);
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(1); }, [load]);

  const handleRefresh = async (e: any) => { await load(1); e.detail.complete(); };

  const handleLoadMore = () => {
    if (meta.current_page < meta.last_page && !loadingMore) {
      load(meta.current_page + 1, true);
    }
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
    <AppLayout title="My Transactions">
      <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
        <IonRefresherContent pullingText="Pull to refresh" refreshingText="Loading…" />
      </IonRefresher>

      {/* Return modal */}
      {returnTarget && (
        <ReturnModal
          txn={returnTarget}
          onClose={() => setReturnTarget(null)}
          onSuccess={() => { showFlash('Return processed successfully.', true); load(1); }}
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

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ borderRadius: 16, padding: '14px', textAlign: 'center', backgroundColor: W.greenPale, border: '1px solid #B2D9A8' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: W.greenText }}>
            ₱{stats.today_total.toFixed(2)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted, fontWeight: 600 }}>Today's Net Sales</p>
        </div>
        <div style={{ borderRadius: 16, padding: '14px', textAlign: 'center', backgroundColor: W.bluePale, border: '1px solid #B0CCE8' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: W.blueText }}>
            {stats.today_count}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted, fontWeight: 600 }}>Transactions Today</p>
        </div>
      </div>

      {/* ── Date filter ────────────────────────────────────── */}
      <div style={card}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${W.border}`, backgroundColor: W.cardBgAlt, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FunnelIcon style={{ width: 16, height: 16, color: W.textMuted }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Filter by Date</span>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: W.cardBg }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: W.textMuted, marginBottom: 5 }}>From</label>
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); }}
                style={dateInputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: W.textMuted, marginBottom: 5 }}>To</label>
              <input type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); }}
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
      <div style={card}>
        <div style={{
          padding: '10px 14px', borderBottom: `1px solid ${W.border}`,
          backgroundColor: W.cardBgAlt, display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: W.text }}>Transaction Records</span>
          <span style={{ fontSize: 12, color: W.textMuted }}>{meta.total} total</span>
        </div>

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
                {/* Row 2: buyer + type + items */}
                <div style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.text }}>{t.buyer}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
                    {(t.buyer_type ?? 'non_member').replace('_', ' ')} · {t.items_count ?? 0} item(s)
                  </p>
                </div>
                {/* Row 3: total + date + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: W.text }}>₱{t.total_amount.toFixed(2)}</p>
                    {(t.refund_total ?? 0) > 0 && (
                      <p style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 700, color: W.amberText }}>
                        −₱{t.refund_total.toFixed(2)}
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
                    {/* Return items */}
                    {t.status === 'completed' && (
                      <button
                        onClick={async () => {
                          // Fetch full item details for the return modal
                          try {
                            const res = await api.get<Txn>(`/transactions/${t.id}/receipt`);
                            setReturnTarget({ ...t, items: res.data.items });
                          } catch {
                            setReturnTarget(t);
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

            {/* Load more */}
            {meta.current_page < meta.last_page && (
              <div style={{ padding: '14px', textAlign: 'center', backgroundColor: W.cardBgAlt, borderTop: `1px solid ${W.border}` }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '10px 24px', borderRadius: 12,
                    backgroundColor: W.cardBg, border: `1px solid ${W.border}`,
                    color: W.textMuted, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {loadingMore ? <IonSpinner name="crescent" style={{ width: 14, height: 14, color: W.green }} /> : null}
                  {loadingMore ? 'Loading…' : `Load More (${meta.total - transactions.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}