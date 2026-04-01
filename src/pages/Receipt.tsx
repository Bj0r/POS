// ============================================================
// FILE: src/pages/Receipt.tsx
//
// MIRRORS: resources/js/Pages/POS/Receipt.jsx
//
// DATA SOURCE:
//   GET /api/transactions/{id}/receipt
//
// FEATURES CARRIED OVER:
//   ✓ Store header (OCMPC, Sudipen La Union)
//   ✓ Meta grid (Cashier, Date, Buyer Type, Member, Void Reason)
//   ✓ Items list with returned qty badge + refund amount
//   ✓ Totals section (Subtotal → Refunded → NET TOTAL)
//   ✓ Cash tendered + Change display
//   ✓ Status badge (Completed / Partial Return / Returned / Voided)
//   ✓ Share receipt (native share sheet via Web Share API)
//   ✓ New Sale button → /pos
//   ✓ My Transactions button → /transactions
//   ✓ Warm Earth palette throughout
//
// PRINT:
//   Mobile apps can't call window.print().  Instead, the Share
//   button uses the Web Share API which lets the user share the
//   receipt as text to any messaging app, or hand the phone to
//   the customer.  A proper PDF receipt can be added later with
//   Capacitor FileSystem + Share plugin.
// ============================================================

import React, { useState, useEffect } from 'react';
import { IonSpinner, IonRefresher, IonRefresherContent } from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import {
  ArrowUturnLeftIcon, XMarkIcon, CheckIcon,
  ExclamationTriangleIcon, ArrowUpTrayIcon,
  ClockIcon, ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../components/AppLayout';
import api from '../services/api';
import { W } from '../theme/warmEarth';

// ── Types ─────────────────────────────────────────────────────
interface ReceiptItem {
  id:            number;
  product_name:  string;
  unit:          string;
  selling_price: number;
  quantity:      number;
  returned_qty:  number;
  returnable_qty:number;
  subtotal:      number;
}

interface ReceiptData {
  id:            number;
  receipt_id:    string;
  cashier:       string;
  buyer_type:    string;
  member?:       { id: number; member_id: string; name: string };
  items:         ReceiptItem[];
  total_amount:  number;
  refund_total:  number;
  cash_tendered?: number;
  change_amount?: number;
  status:        string;
  void_reason?:  string;
  returned_at?:  string;
  created_at:    string;
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status, hasReturns }: { status: string; hasReturns: boolean }) {
  const cfg: Record<string, { bg: string; color: string; label: string; Icon: React.ElementType | null }> = {
    completed_partial: { bg: W.amberPale, color: W.amberText, label: 'Partial Return', Icon: ArrowUturnLeftIcon },
    completed:         { bg: W.greenPale, color: W.greenText, label: 'Completed',      Icon: CheckIcon           },
    returned:          { bg: W.amberPale, color: W.amberText, label: 'Returned',       Icon: ArrowUturnLeftIcon  },
    voided:            { bg: W.redPale,   color: W.red,       label: 'Voided',         Icon: XMarkIcon           },
  };
  const key = status === 'completed' && hasReturns ? 'completed_partial' : status;
  const c = cfg[key] ?? { bg: W.cardBgAlt, color: W.textMuted, label: status, Icon: null };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700,
      backgroundColor: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>
      {c.Icon && <c.Icon style={{ width: 13, height: 13 }} />}
      {c.label}
    </span>
  );
}

// ── MetaRow ───────────────────────────────────────────────────
function MetaRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: W.textMuted, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor ?? W.text, fontWeight: 700, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function Receipt() {
  const { id }   = useParams<{ id: string }>();
  const history  = useHistory();

  const [receipt,  setReceipt]  = useState<ReceiptData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<ReceiptData>(`/transactions/${id}/receipt`);
      setReceipt(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not load receipt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleRefresh = async (e: any) => { await load(); e.detail.complete(); };

  // ── Share receipt as text ────────────────────────────────
  const handleShare = async () => {
    if (!receipt) return;
    const t = receipt;
    const lines = [
      `OCMPC — Sudipen, La Union`,
      `Receipt: ${t.receipt_id}`,
      `Date: ${new Date(t.created_at).toLocaleString('en-PH')}`,
      `Cashier: ${t.cashier}`,
      `Buyer: ${t.buyer_type === 'member' && t.member ? t.member.name : 'Walk-in Customer'}`,
      '',
      '─── ITEMS ───',
      ...t.items.map(i =>
        `${i.product_name} x${i.quantity} × ₱${i.selling_price.toFixed(2)} = ₱${i.subtotal.toFixed(2)}`
        + (i.returned_qty > 0 ? ` (${i.returned_qty} returned)` : '')
      ),
      '',
      `TOTAL: ₱${t.total_amount.toFixed(2)}`,
      t.cash_tendered != null ? `Cash: ₱${t.cash_tendered.toFixed(2)}` : '',
      t.change_amount  != null ? `Change: ₱${t.change_amount.toFixed(2)}` : '',
      '',
      'Thank you for your purchase!',
    ].filter(Boolean).join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: `Receipt ${t.receipt_id}`, text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        alert('Receipt copied to clipboard!');
      }
    } catch {}
  };

  if (loading) {
    return (
      <AppLayout title="Receipt">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <IonSpinner name="crescent" style={{ color: W.green }} />
        </div>
      </AppLayout>
    );
  }

  if (error || !receipt) {
    return (
      <AppLayout title="Receipt">
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <ExclamationTriangleIcon style={{ width: 36, height: 36, color: W.red, margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, color: W.red }}>{error || 'Receipt not found.'}</p>
          <button onClick={() => history.goBack()}
            style={{ marginTop: 16, padding: '12px 24px', borderRadius: 12, backgroundColor: W.green, color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            Go Back
          </button>
        </div>
      </AppLayout>
    );
  }

  const t           = receipt;
  const refundTotal = t.items.reduce((s, i) => s + i.selling_price * (i.returned_qty ?? 0), 0);
  const grossTotal  = t.total_amount + refundTotal;
  const hasReturns  = refundTotal > 0;

  const card: React.CSSProperties = {
    backgroundColor: W.cardBg, borderRadius: 16,
    boxShadow: '0 2px 12px rgba(28,43,26,0.08)',
    border: `1px solid ${W.border}`, overflow: 'hidden', marginBottom: 12,
  };

  return (
    <AppLayout title={`Receipt ${t.receipt_id}`}>
      <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
        <IonRefresherContent />
      </IonRefresher>

      {/* Receipt ID + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: W.textMuted }}>Receipt</p>
          <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: W.text }}>{t.receipt_id}</p>
        </div>
        <StatusBadge status={t.status} hasReturns={hasReturns} />
      </div>

      {/* Receipt card */}
      <div style={card}>
        {/* Store header */}
        <div style={{ textAlign: 'center', padding: '14px 16px', borderBottom: `1px dashed ${W.borderDash}`, backgroundColor: W.cardBg }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: 1, color: W.text }}>OCMPC</p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: W.textMuted }}>Sudipen, La Union</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>Cooperative Store</p>
        </div>

        {/* Meta */}
        <div style={{ padding: '14px 16px', borderBottom: `1px dashed ${W.borderDash}`, backgroundColor: W.cardBg }}>
          <MetaRow label="Cashier"    value={t.cashier} />
          <MetaRow label="Date & Time" value={new Date(t.created_at).toLocaleString('en-PH')} />
          <MetaRow label="Buyer Type"  value={(t.buyer_type ?? '').replace('_', ' ')} />
          {t.member && <>
            <MetaRow label="Member"    value={t.member.name}      valueColor={W.greenText} />
            <MetaRow label="Member ID" value={t.member.member_id} />
          </>}
          {t.status === 'voided' && t.void_reason && (
            <MetaRow label="Void Reason" value={t.void_reason} valueColor={W.red} />
          )}
        </div>

        {/* Items */}
        <div style={{ padding: '14px 16px', backgroundColor: W.cardBg }}>
          <div style={{
            borderRadius: 8, padding: '6px 12px', marginBottom: 12,
            backgroundColor: W.headerBg,
          }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Items Purchased
            </p>
          </div>

          {t.items.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 12, color: W.textMuted, padding: '16px 0' }}>No items recorded.</p>
          ) : t.items.map((item, i) => {
            const returned  = item.returned_qty ?? 0;
            const activeQty = item.quantity - returned;
            const refund    = item.selling_price * returned;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.text }}>{item.product_name}</p>
                  <p style={{ margin: '2px 0', fontSize: 11, color: W.textMuted }}>
                    {item.quantity} {item.unit} × ₱{item.selling_price.toFixed(2)}
                  </p>
                  {returned > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                      borderRadius: 20, padding: '2px 8px',
                      fontSize: 10, fontWeight: 700,
                      backgroundColor: W.amberPale, color: W.amberText,
                    }}>
                      <ArrowUturnLeftIcon style={{ width: 10, height: 10 }} />
                      {returned} returned · −₱{refund.toFixed(2)}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: W.text }}>₱{item.subtotal.toFixed(2)}</p>
                  {returned > 0 && activeQty > 0 && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: W.amberText }}>₱{(item.selling_price * activeQty).toFixed(2)} net</p>
                  )}
                  {returned > 0 && activeQty === 0 && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: W.amberText }}>fully returned</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div style={{ padding: '14px 16px', borderTop: `1px dashed ${W.borderDash}`, backgroundColor: W.cardBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: W.textMuted }}>Subtotal ({t.items.length} item{t.items.length !== 1 ? 's' : ''})</span>
            <span style={{ fontSize: 12, color: W.textMuted }}>₱{grossTotal.toFixed(2)}</span>
          </div>
          {hasReturns && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: W.amberText, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ArrowUturnLeftIcon style={{ width: 12, height: 12 }} /> Refunded
              </span>
              <span style={{ fontSize: 12, color: W.amberText, fontWeight: 700 }}>−₱{refundTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 10, marginTop: 6, borderTop: `1px solid ${W.border}`,
          }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: W.text }}>
              {hasReturns ? 'NET TOTAL' : 'TOTAL'}
            </span>
            <span style={{ fontSize: 24, fontWeight: 900, color: hasReturns ? W.amberText : W.greenText }}>
              ₱{t.total_amount.toFixed(2)}
            </span>
          </div>

          {/* Cash + Change */}
          {t.cash_tendered != null && (
            <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid #B2D9A8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: W.cardBgAlt, borderBottom: `1px solid ${W.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: W.textMuted }}>Cash Tendered</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: W.text }}>₱{t.cash_tendered.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: W.greenPale }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: W.greenText }}>Change</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: W.greenText }}>₱{(t.change_amount ?? 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', textAlign: 'center', backgroundColor: W.cardBgAlt, borderTop: `1px solid ${W.border}` }}>
          <p style={{ margin: 0, fontSize: 12, color: W.textMuted }}>Thank you for your purchase!</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>OCMPC — Sudipen, La Union</p>
        </div>
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        style={{
          width: '100%', padding: '14px',
          borderRadius: 12, border: `1px solid ${W.border}`,
          backgroundColor: W.cardBg, color: W.text,
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 12,
        }}
      >
        <ArrowUpTrayIcon style={{ width: 18, height: 18 }} /> Share Receipt
      </button>

      {/* Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 16 }}>
        <button
          onClick={() => history.push('/transactions')}
          style={{
            padding: '13px', borderRadius: 12, border: `1px solid ${W.border}`,
            backgroundColor: W.cardBg, color: W.text, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ClockIcon style={{ width: 17, height: 17 }} /> My Transactions
        </button>
        <button
          onClick={() => history.push('/pos')}
          style={{
            padding: '13px', borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
            color: 'white', fontWeight: 800, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 14px rgba(45,106,31,0.3)',
          }}
        >
          <ShoppingCartIcon style={{ width: 17, height: 17 }} /> New Sale
        </button>
      </div>
    </AppLayout>
  );
}