// ============================================================
// FILE: src/pages/NewSale.tsx
//
// FIXES:
//   1. Member search — wrapped in try/catch that shows a local
//      error message instead of letting the error bubble up to
//      the global 401 interceptor.  A failed member search no
//      longer logs the user out.
//
//   2. Product search — same fix.  Network errors and 4xx
//      responses are shown as inline messages.
//
//   3. Barcode lookup — same fix.
//
//   4. Added a local `searchError` state so the user sees
//      "Search failed — try again" instead of being kicked out.
//
//   5. Finalize — catches errors and shows an alert without
//      triggering logout.
//
//   6. All api.get() calls inside useEffect debounce timers
//      now check if the component is still mounted before
//      setting state (prevents React state-update-on-unmounted
//      component warnings).
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IonModal, IonSpinner, IonIcon } from '@ionic/react';
import {
  searchOutline, barcodeOutline, personOutline, peopleOutline,
  cartOutline, checkmarkCircle, closeOutline, cameraOutline,
} from 'ionicons/icons';
import BarcodeScanner from '../components/BarcodeScanner';
import { useHistory } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../services/api';
import { W } from '../theme/warmEarth';

// ── Types ─────────────────────────────────────────────────────
interface Product {
  id:             number;
  name:           string;
  category:       string;
  unit:           string;
  selling_price:  number;
  stock_quantity: number;
  barcode?:       string;
}

interface Member { id: number; member_id: string; name: string; }

interface CartItem {
  product_id: number;
  name:       string;
  unit:       string;
  price:      number;
  stock:      number;
  quantity:   number;
}

// ── Step bar ──────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const steps = ['Buyer Type', 'Items & Checkout'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {steps.map((label, i) => {
        const idx    = i + 1;
        const done   = step > idx;
        const active = step === idx;
        return (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            flex: i > 0 ? 1 : undefined,
          }}>
            {i > 0 && (
              <div style={{
                height: 1, flex: 1,
                backgroundColor: done || active ? W.green : W.border,
              }} />
            )}
            <div style={{
              width: 24, height: 24, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
              backgroundColor: done || active ? W.green : W.border,
              color: done || active ? '#fff' : W.textMuted,
              boxShadow: active ? '0 2px 6px rgba(45,106,31,0.28)' : 'none',
            }}>
              {done ? '✓' : idx}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600,
              whiteSpace: 'nowrap',
              color: active ? W.text : done ? W.greenText : W.textMuted,
            }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stock badge ───────────────────────────────────────────────
function StockBadge({ qty, reorder = 5 }: { qty: number; reorder?: number }) {
  const cfg = qty <= 0
    ? { label: 'Out',      bg: W.redPale,   color: W.red       }
    : qty <= reorder
      ? { label: 'Low',    bg: W.amberPale, color: W.amberText }
      : { label: 'In Stock', bg: W.greenPale, color: W.greenText };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 20,
      padding: '2px 7px',
      backgroundColor: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

// ── BarcodeToast ──────────────────────────────────────────────
interface BarcodeToastState { status: 'found' | 'notfound' | 'outofstock'; text: string; }
function BarcodeToast({ state }: { state: BarcodeToastState | null }) {
  if (!state) return null;
  const cfg = {
    found:      { bg: W.greenPale, border: '#B2D9A8', color: W.greenText },
    notfound:   { bg: W.redPale,   border: '#EBBDB8', color: W.red       },
    outofstock: { bg: W.amberPale, border: '#E8D49A', color: W.amberText },
  }[state.status];
  return (
    <div style={{
      borderRadius: 12, padding: '10px 14px', marginBottom: 10,
      fontSize: 12, fontWeight: 700,
      backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <IonIcon icon={cameraOutline} style={{ fontSize: 14, flexShrink: 0 }} />
      {state.text}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function NewSale() {
  const history = useHistory();

  // ── Step / buyer state ────────────────────────────────────
  const [step,      setStep]      = useState(1);
  const [buyerType, setBuyerType] = useState<'non_member' | 'member' | null>(null);
  const [memberQ,   setMemberQ]   = useState('');
  const [members,   setMembers]   = useState<Member[]>([]);
  const [member,    setMember]    = useState<Member | null>(null);
  const [memberErr, setMemberErr] = useState('');

  // ── Product search state ──────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [products,     setProducts]     = useState<Product[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [searchErr,    setSearchErr]    = useState('');
  const [showScanner,  setShowScanner]  = useState(false);
  const [barcodeToast, setBarcodeToast] = useState<BarcodeToastState | null>(null);

  // ── Cart / payment state ──────────────────────────────────
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [showPayment,  setShowPayment]  = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  const [paymentErr,   setPaymentErr]   = useState('');

  // Refs for debounce timers
  const memberTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted      = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ── Member search debounce ────────────────────────────────
  useEffect(() => {
    if (memberTimer.current) clearTimeout(memberTimer.current);
    setMemberErr('');

    if (!memberQ.trim()) {
      setMembers([]);
      return;
    }

    memberTimer.current = setTimeout(async () => {
      try {
        const r = await api.get<Member[]>(
          `/members/search?q=${encodeURIComponent(memberQ)}`
        );
        if (mounted.current) setMembers(r.data ?? []);
      } catch (err: any) {
        if (!mounted.current) return;
        // Show an inline error for ALL failures including 401 —
        // do NOT let a 401 here silently trigger the global logout
        // interceptor. The user is already logged in; a 401 on search
        // is a transient token hiccup, not a real session expiry.
        setMemberErr('Member search failed. Please try again.');
        setMembers([]);
      }
    }, 300);
  }, [memberQ]);

  // ── Product search debounce ───────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchErr('');

    if (!search.trim()) {
      setProducts([]);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api.get<Product[]>(
          `/products/search?q=${encodeURIComponent(search)}`
        );
        if (mounted.current) {
          setProducts(r.data ?? []);
          setSearching(false);
        }
      } catch (err: any) {
        if (!mounted.current) return;
        // Show inline error for ALL failures including 401
        setSearchErr('Product search failed. Please try again.');
        setProducts([]);
        setSearching(false);
      }
    }, 300);
  }, [search]);

  // ── Derived values ────────────────────────────────────────
  const canProceed = buyerType === 'non_member' || (buyerType === 'member' && !!member);
  const total      = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  // ── Cart helpers ──────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id);
      if (ex) {
        if (ex.quantity >= product.stock_quantity) return prev;
        return prev.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name:       product.name,
        unit:       product.unit,
        price:      product.selling_price,
        stock:      product.stock_quantity,
        quantity:   1,
      }];
    });
    setSearch('');
    setProducts([]);
  }, []);

  const updateQty = (id: number, delta: number) =>
    setCart(prev =>
      prev.map(i =>
        i.product_id === id
          ? { ...i, quantity: Math.max(1, Math.min(i.stock, i.quantity + delta)) }
          : i
      )
    );

  const removeItem = (id: number) =>
    setCart(prev => prev.filter(i => i.product_id !== id));

  const resetStep1 = () => {
    setStep(1);
    setBuyerType(null);
    setMember(null);
    setMemberQ('');
    setMembers([]);
    setMemberErr('');
    setCart([]);
    setSearch('');
    setProducts([]);
    setSearchErr('');
    setShowScanner(false);
    setBarcodeToast(null);
  };

  // ── Barcode scan detected ─────────────────────────────────
  const handleBarcodeDetected = async (barcode: string) => {
    setShowScanner(false);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    try {
      const res  = await api.get<Product>(`/products/barcode/${encodeURIComponent(barcode)}`);
      addToCart(res.data);
      setBarcodeToast({ status: 'found', text: `${res.data.name} added!` });
    } catch (err: any) {
      const body   = err?.response?.data;
      const status = err?.response?.status;
      if (status === 404) {
        setBarcodeToast({ status: 'notfound', text: `No product: ${barcode}` });
      } else if (status === 422 && body?.out_of_stock) {
        setBarcodeToast({ status: 'outofstock', text: `${body?.product?.name ?? 'Product'} is out of stock.` });
      } else {
        setBarcodeToast({ status: 'notfound', text: body?.message ?? 'Lookup failed.' });
      }
    } finally {
      toastTimer.current = setTimeout(() => setBarcodeToast(null), 3500);
    }
  };

  // ── Finalize sale ─────────────────────────────────────────
  const handleFinalize = async () => {
    const cashNum   = parseFloat(cashTendered) || 0;
    if (cashNum < total) return;

    setSubmitting(true);
    setShowPayment(false);
    setPaymentErr('');

    try {
      const res = await api.post<{ transaction_id: number; receipt_id: string }>(
        '/pos/finalize',
        {
          items:         cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
          buyer_type:    buyerType,
          member_id:     member?.id ?? null,
          cash_tendered: cashNum,
          change_amount: parseFloat((cashNum - total).toFixed(2)),
        }
      );
      history.push(`/receipt/${res.data.transaction_id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Sale failed. Please try again.';
      setPaymentErr(msg);
      setSubmitting(false);
      setShowPayment(true); // Re-open modal to show the error
    }
  };

  // ── Payment modal derived values ──────────────────────────
  const cashNum    = parseFloat(cashTendered) || 0;
  const changeAmt  = cashNum - total;
  const sufficient = cashNum >= total;
  const quickAmts  = [
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500,
  ].filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4);

  // ── Shared styles ─────────────────────────────────────────
  const noScrollbar: React.CSSProperties = {
    overflowY: 'auto',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  };

  const card: React.CSSProperties = {
    backgroundColor: W.cardBg, borderRadius: 14,
    boxShadow: '0 2px 10px rgba(28,43,26,0.07)',
    border: `1px solid ${W.border}`,
    overflow: 'hidden', marginBottom: 12,
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 36px',
    borderRadius: 12, border: `1px solid ${W.border}`,
    backgroundColor: W.inputBg, color: W.text,
    fontSize: 13, boxSizing: 'border-box',
  };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
    <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
            <AppLayout title="New Sale">

      <StepBar step={step} />

      {/* ══════════════════════════════════════════════════════
          STEP 1 — Buyer Type
      ══════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div style={card}>
          <div style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${W.border}`,
            backgroundColor: W.cardBgAlt,
          }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: W.text }}>
              Who is this sale for?
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: W.textMuted }}>
              Select buyer type to continue
            </p>
          </div>

          {/* Buyer type cards */}
          <div style={{
            padding: 12,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          }}>
            {[
              { key: 'non_member' as const, label: 'Non-Member', sub: 'Walk-in customer', icon: personOutline },
              { key: 'member'     as const, label: 'Member',     sub: 'Coop member',      icon: peopleOutline },
            ].map(({ key, label, sub, icon }) => (
              <button
                key={key}
                onClick={() => {
                  setBuyerType(key);
                  if (key === 'non_member') {
                    setMember(null);
                    setMemberQ('');
                    setMemberErr('');
                  }
                }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 10,
                  borderRadius: 16,
                  border: `2px solid ${buyerType === key ? W.green : W.border}`,
                  padding: '16px 8px',
                  backgroundColor: buyerType === key ? W.greenPale : W.cardBg,
                  boxShadow: buyerType === key ? '0 3px 12px rgba(45,106,31,0.15)' : 'none',
                  cursor: 'pointer', position: 'relative',
                }}
              >
                {buyerType === key && (
                  <IonIcon icon={checkmarkCircle} style={{ position: 'absolute', top: 8, right: 8, fontSize: 16, color: W.green }} />
                )}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: buyerType === key ? W.greenPale : W.border,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <IonIcon icon={icon} style={{ fontSize: 22, color: buyerType === key ? W.greenText : W.textMuted }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{
                    margin: 0, fontSize: 12, fontWeight: 800,
                    color: buyerType === key ? W.greenText : W.text,
                  }}>
                    {label}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: W.textMuted }}>
                    {sub}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Member search */}
          {buyerType === 'member' && (
            <div style={{ padding: '0 12px 12px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: W.textMuted, marginBottom: 8 }}>
                Search member by name or ID
              </p>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <IonIcon icon={searchOutline} style={{
                  position: 'absolute', left: 11,
                  top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: W.textMuted,
                }} />
                <input
                  type="text"
                  placeholder="e.g. Juan dela Cruz…"
                  value={member ? member.name : memberQ}
                  onChange={e => {
                    setMemberQ(e.target.value);
                    setMember(null);
                  }}
                  style={searchInputStyle}
                />
                {(memberQ || member) && (
                  <button
                    onClick={() => {
                      setMember(null);
                      setMemberQ('');
                      setMembers([]);
                      setMemberErr('');
                    }}
                    style={{
                      position: 'absolute', right: 10,
                      top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', color: W.textMuted,
                    }}
                  >
                    <IonIcon icon={closeOutline} style={{ fontSize: 18 }} />
                  </button>
                )}
              </div>

              {/* Member search error */}
              {memberErr && (
                <p style={{ fontSize: 12, color: W.red, marginBottom: 8 }}>{memberErr}</p>
              )}

              {/* Member dropdown */}
              {members.length > 0 && !member && (
                <div className="no-scrollbar" style={{
                  borderRadius: 12,
                  border: `1px solid ${W.border}`,
                  backgroundColor: W.cardBg, marginBottom: 8,
                  maxHeight: 200, ...noScrollbar,
                }}>
                  {members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMember(m);
                        setMemberQ('');
                        setMembers([]);
                      }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '10px 12px',
                        borderBottom: `1px solid ${W.border}`,
                        backgroundColor: 'transparent',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.text }}>
                        {m.name}
                      </p>
                      <p style={{
                        margin: '2px 0 0', fontSize: 11,
                        fontFamily: 'monospace', color: W.textMuted,
                      }}>
                        ID: {m.member_id}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {memberQ.trim() && members.length === 0 && !member && !memberErr && (
                <p style={{ fontSize: 12, color: W.textMuted, marginTop: 4 }}>
                  No members found.
                </p>
              )}

              {/* Selected member chip */}
              {member && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  borderRadius: 12, padding: '10px 12px',
                  backgroundColor: W.greenPale, border: '1px solid #B2D9A8',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                    backgroundColor: W.green, color: 'white',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 800, fontSize: 13,
                  }}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 700,
                      color: W.greenText,
                    }}>
                      {member.name}
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontSize: 11,
                      fontFamily: 'monospace', color: W.green,
                    }}>
                      ID: {member.member_id}
                    </p>
                  </div>
                  <IonIcon icon={checkmarkCircle} style={{ fontSize: 20, color: W.green, flexShrink: 0 }} />
                </div>
              )}
            </div>
          )}

          {/* Continue button */}
          <div style={{ padding: '0 12px 12px' }}>
            <button
              onClick={() => canProceed && setStep(2)}
              disabled={!canProceed}
              style={{
                width: '100%', padding: '13px',
                borderRadius: 12, border: 'none',
                background: canProceed
                  ? `linear-gradient(135deg,${W.greenLt},${W.green})`
                  : W.border,
                color: canProceed ? '#fff' : W.textMuted,
                fontWeight: 800, fontSize: 14,
                cursor: canProceed ? 'pointer' : 'not-allowed',
                boxShadow: canProceed ? '0 4px 12px rgba(45,106,31,0.28)' : 'none',
              }}
            >
              {buyerType === 'non_member' && 'Continue as Non-Member →'}
              {buyerType === 'member' && !member && 'Select a member first'}
              {buyerType === 'member' && member && `Continue — ${member.name} →`}
              {!buyerType && 'Select buyer type'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 2 — Add Items + Cart
      ══════════════════════════════════════════════════════ */}
      {step === 2 && (
        <>
          {/* Buyer banner */}
          <div style={{
            borderRadius: 12, padding: '10px 12px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: buyerType === 'member' ? W.greenPale : W.cardBgAlt,
            border: `1px solid ${buyerType === 'member' ? '#B2D9A8' : W.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IonIcon
                icon={buyerType === 'member' ? peopleOutline : personOutline}
                style={{ fontSize: 20, color: buyerType === 'member' ? W.greenText : W.textMuted }}
              />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.text }}>
                  {buyerType === 'member' ? member?.name : 'Walk-in (Non-Member)'}
                </p>
                {buyerType === 'member' && member && (
                  <p style={{
                    margin: '2px 0 0', fontSize: 11,
                    fontFamily: 'monospace', color: W.green,
                  }}>
                    ID: {member.member_id}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={resetStep1}
              style={{
                background: 'none', border: 'none',
                fontSize: 12, color: W.textMuted, cursor: 'pointer',
              }}
            >
              ← Change
            </button>
          </div>

          {/* Barcode toast */}
          <BarcodeToast state={barcodeToast} />

          {/* Search + Scanner card */}
          <div style={card}>
            {/* Card header with Scan toggle button */}
            <div style={{
              padding: '10px 12px',
              borderBottom: `1px solid ${W.border}`,
              backgroundColor: W.cardBgAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <p style={{
                margin: 0, fontSize: 11, fontWeight: 800,
                color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                Add Products
              </p>
              <button
                onClick={() => setShowScanner(s => !s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderRadius: 10, padding: '6px 12px',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  border: showScanner ? 'none' : '1px solid #B2D9A8',
                  ...(showScanner
                    ? { background: `linear-gradient(135deg,${W.greenLt},${W.green})`, color: '#fff', boxShadow: '0 2px 8px rgba(45,106,31,0.22)' }
                    : { backgroundColor: W.greenPale, color: W.greenText }),
                }}
              >
                <IonIcon icon={cameraOutline} style={{ fontSize: 14 }} />
                {showScanner ? 'Close' : 'Scan'}
              </button>
            </div>

            {/* Inline scanner panel */}
            {showScanner && (
              <div style={{ height: 260, backgroundColor: '#000' }}>
                <BarcodeScanner
                  onDetected={handleBarcodeDetected}
                  onClose={() => setShowScanner(false)}
                />
              </div>
            )}

            {/* Text search input */}
            <div style={{ padding: 12 }}>
              <div style={{ position: 'relative' }}>
                <IonIcon icon={searchOutline} style={{
                  position: 'absolute', left: 11,
                  top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: W.textMuted,
                }} />
                <input
                  type="text"
                  placeholder="Product name or category…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={searchInputStyle}
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setProducts([]); setSearchErr(''); }}
                    style={{
                      position: 'absolute', right: 10,
                      top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', color: W.textMuted,
                    }}
                  >
                    <IonIcon icon={closeOutline} style={{ fontSize: 18 }} />
                  </button>
                )}
              </div>

              {/* Search error */}
              {searchErr && (
                <p style={{ fontSize: 12, color: W.red, margin: '6px 0 0' }}>{searchErr}</p>
              )}
            </div>
          </div>

          {/* Search results */}
          {(searching || products.length > 0) && (
            <div style={card}>
              <div style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${W.border}`,
                backgroundColor: W.cardBgAlt,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <p style={{
                  margin: 0, fontSize: 11, fontWeight: 800,
                  color: W.textMuted, textTransform: 'uppercase',
                }}>
                  Results
                </p>
                {!searching && (
                  <span style={{ fontSize: 11, color: W.textMuted }}>
                    {products.length} found
                  </span>
                )}
              </div>
              {searching ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <IonSpinner name="crescent" style={{ color: W.green }} />
                </div>
              ) : (
                <div className="no-scrollbar" style={{ maxHeight: 240, ...noScrollbar }}>
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => p.stock_quantity > 0 && addToCart(p)}
                      disabled={p.stock_quantity <= 0}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '10px 12px',
                        borderBottom: `1px solid ${W.border}`,
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: p.stock_quantity > 0 ? 'pointer' : 'not-allowed',
                        opacity: p.stock_quantity <= 0 ? 0.5 : 1,
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <p style={{
                          margin: 0, fontSize: 13,
                          fontWeight: 700, color: W.text,
                        }}>
                          {p.name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
                          {p.unit} · Stock: {p.stock_quantity}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{
                          margin: 0, fontSize: 13,
                          fontWeight: 800, color: W.greenText,
                        }}>
                          ₱{p.selling_price.toFixed(2)}
                        </p>
                        <StockBadge qty={p.stock_quantity} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state — shown when no search and scanner is closed */}
          {!searching && products.length === 0 && !search && !showScanner && (
            <div style={{
              borderRadius: 14, marginBottom: 12,
              backgroundColor: W.cardBg, border: `1px solid ${W.border}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 'clamp(24px, 5vw, 40px) clamp(12px, 4vw, 32px)',
              minHeight: 'clamp(100px, 18vw, 140px)',
            }}>
              <div style={{
                width: 'clamp(44px, 10vw, 64px)', height: 'clamp(44px, 10vw, 64px)',
                borderRadius: '50%',
                backgroundColor: W.cardBgAlt,
                border: `1px solid ${W.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 'clamp(8px, 2vw, 14px)',
              }}>
                <IonIcon icon={searchOutline} style={{ fontSize: 'clamp(20px, 4vw, 28px)', color: W.textMuted }} />
              </div>
              <p style={{ fontSize: 'clamp(12px, 2vw, 14px)', color: W.textMuted, margin: 0, textAlign: 'center' }}>
                Search or scan a barcode to add products
              </p>
            </div>
          )}

          {/* Cart */}
          <div style={{ ...card, minHeight: 200 }}>
            {/* Cart header */}
            <div style={{
              padding: '10px 12px',
              borderBottom: `1px solid ${W.border}`,
              backgroundColor: W.cardBgAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IonIcon icon={cartOutline} style={{ fontSize: 18, color: W.text }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: W.text }}>Cart</span>
                {cart.length > 0 && (
                  <span style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: W.green, color: 'white',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  style={{
                    background: 'none', border: 'none',
                    fontSize: 12, color: W.red,
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Cart items */}
            {cart.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 'clamp(28px, 6vw, 48px) clamp(12px, 4vw, 32px)',
                minHeight: 'clamp(120px, 20vw, 160px)',
              }}>
                <div style={{
                  width: 'clamp(48px, 11vw, 72px)', height: 'clamp(48px, 11vw, 72px)',
                  borderRadius: '50%',
                  backgroundColor: W.cardBgAlt,
                  border: `1px solid ${W.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 'clamp(10px, 2vw, 16px)',
                }}>
                  <IonIcon icon={cartOutline} style={{ fontSize: 'clamp(22px, 5vw, 32px)', color: W.textMuted }} />
                </div>
                <p style={{ fontSize: 'clamp(12px, 2vw, 14px)', color: W.textMuted, fontWeight: 600, margin: 0, textAlign: 'center' }}>
                  Cart is empty
                </p>
                <p style={{ fontSize: 'clamp(11px, 1.8vw, 13px)', color: W.textMuted, margin: 'clamp(3px, 1vw, 6px) 0 0', textAlign: 'center' }}>
                  Search or scan a product above
                </p>
              </div>
            ) : (
              <>
                <div className="no-scrollbar" style={{ maxHeight: 300, ...noScrollbar }}>
                {cart.map(item => (
                  <div
                    key={item.product_id}
                    style={{ padding: '10px 12px', borderBottom: `1px solid ${W.border}` }}
                  >
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', marginBottom: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: 13,
                          fontWeight: 700, color: W.text,
                        }}>
                          {item.name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
                          ₱{item.price.toFixed(2)} / {item.unit}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', paddingLeft: 8,
                          display: 'flex', alignItems: 'center', color: W.border,
                        }}
                      >
                        <IonIcon icon={closeOutline} style={{ fontSize: 18 }} />
                      </button>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => updateQty(item.product_id, -1)}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            backgroundColor: W.border, border: 'none',
                            cursor: 'pointer', fontSize: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >−</button>
                        <span style={{
                          fontSize: 14, fontWeight: 800,
                          color: W.text, minWidth: 24, textAlign: 'center',
                        }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.product_id, 1)}
                          disabled={item.quantity >= item.stock}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            backgroundColor: W.greenPale, border: 'none',
                            cursor: item.quantity < item.stock ? 'pointer' : 'not-allowed',
                            fontSize: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: item.quantity >= item.stock ? 0.4 : 1,
                          }}
                        >+</button>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: W.text }}>
                        ₱{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}

                </div>
                {/* Cart footer */}
                <div style={{
                  padding: 12,
                  backgroundColor: W.cardBgAlt,
                  borderTop: `1px solid ${W.border}`,
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 10,
                  }}>
                    <span style={{ fontSize: 12, color: W.textMuted }}>
                      {cart.reduce((s, i) => s + i.quantity, 0)} item(s)
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: W.greenText }}>
                      ₱{total.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (cart.length === 0 || submitting) return;
                      setCashTendered('');
                      setPaymentErr('');
                      setShowPayment(true);
                    }}
                    disabled={cart.length === 0 || submitting}
                    style={{
                      width: '100%', padding: '14px',
                      borderRadius: 12, border: 'none',
                      background: `linear-gradient(135deg,${W.greenLt},${W.green})`,
                      color: 'white', fontWeight: 800, fontSize: 15,
                      cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: cart.length === 0 ? 0.5 : 1,
                      boxShadow: cart.length > 0 ? '0 4px 12px rgba(45,106,31,0.28)' : 'none',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 8,
                    }}
                  >
                    {submitting
                      ? <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
                      : `Checkout  ₱${total.toFixed(2)}`
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          Payment Modal
      ══════════════════════════════════════════════════════ */}
      <IonModal
        isOpen={showPayment}
        onDidDismiss={() => setShowPayment(false)}
        initialBreakpoint={0.9}
        breakpoints={[0, 0.9]}
      >
        <div style={{
          padding: 20, backgroundColor: W.cardBg, minHeight: '100%',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 16,
          }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: W.text }}>
              Payment
            </p>
            <button
              onClick={() => setShowPayment(false)}
              style={{
                background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', color: W.textMuted,
              }}
            >
              <IonIcon icon={closeOutline} style={{ fontSize: 22 }} />
            </button>
          </div>

          {/* Payment error */}
          {paymentErr && (
            <div style={{
              borderRadius: 12, padding: '10px 14px', marginBottom: 14,
              backgroundColor: W.redPale, border: '1px solid #EBBDB8',
            }}>
              <p style={{ margin: 0, fontSize: 12, color: W.red }}>{paymentErr}</p>
            </div>
          )}

          {/* Total due */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            backgroundColor: W.greenPale, border: '1px solid #B2D9A8',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: W.greenText }}>
              Total Due
            </span>
            <span style={{ fontSize: 26, fontWeight: 900, color: W.greenText }}>
              ₱{total.toFixed(2)}
            </span>
          </div>

          {/* Cash tendered */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 700,
              color: W.text, marginBottom: 8,
            }}>
              Cash Tendered
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: 800, color: W.textMuted, fontSize: 14,
              }}>₱</span>
              <input
                type="number" min="0" step="0.01"
                placeholder={total.toFixed(2)}
                value={cashTendered}
                onChange={e => setCashTendered(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '14px 14px 14px 32px',
                  borderRadius: 12, border: `1px solid ${W.border}`,
                  backgroundColor: W.inputBg, color: W.text,
                  fontSize: 22, fontWeight: 900, textAlign: 'right',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Quick amounts */}
            {quickAmts.length > 0 && (
              <div style={{
                display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap',
              }}>
                {[...quickAmts, total]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map(amt => (
                    <button
                      key={amt}
                      onClick={() => setCashTendered(String(amt))}
                      style={{
                        borderRadius: 10, padding: '7px 12px',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        backgroundColor: cashNum === amt ? W.greenPale : W.cardBgAlt,
                        border: `1px solid ${cashNum === amt ? '#B2D9A8' : W.border}`,
                        color: cashNum === amt ? W.greenText : W.textMuted,
                      }}
                    >
                      {amt === total ? 'Exact' : `₱${amt.toLocaleString()}`}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Change display */}
          <div style={{
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            backgroundColor: !cashTendered ? W.cardBgAlt : sufficient ? W.greenPale : '#FAE3DF',
            border: `1px solid ${!cashTendered ? W.border : sufficient ? '#B2D9A8' : '#EBBDB8'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: !cashTendered ? W.textMuted : sufficient ? W.greenText : W.red,
              }}>
                {!cashTendered ? 'Change' : sufficient ? 'Change' : 'Insufficient'}
              </span>
              <span style={{
                fontSize: 26, fontWeight: 900,
                color: !cashTendered ? W.textMuted : sufficient ? W.greenText : W.red,
              }}>
                {!cashTendered
                  ? '—'
                  : sufficient
                    ? `₱${changeAmt.toFixed(2)}`
                    : `−₱${(total - cashNum).toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleFinalize}
            disabled={!sufficient || submitting}
            style={{
              width: '100%', padding: '15px',
              borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg,${W.greenLt},${W.green})`,
              color: 'white', fontWeight: 800, fontSize: 15,
              cursor: sufficient && !submitting ? 'pointer' : 'not-allowed',
              opacity: !sufficient || submitting ? 0.4 : 1,
              boxShadow: sufficient ? '0 4px 12px rgba(45,106,31,0.28)' : 'none',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}
          >
            {submitting
              ? <><IonSpinner name="crescent" style={{ width: 18, height: 18 }} /> Processing…</>
              : sufficient
                ? `Confirm  ·  Change ₱${changeAmt.toFixed(2)}`
                : 'Enter Cash Amount'
            }
          </button>
        </div>
      </IonModal>
    </AppLayout>
    </>
  );
}