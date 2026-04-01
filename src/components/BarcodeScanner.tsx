// ============================================================
// FILE: src/components/BarcodeScanner.tsx
//
// Ported from resources/js/Components/BarcodeScanner.jsx
//
// ACCURACY OPTIMISATIONS (same as JSX source):
//   1. MULTI-FRAME CONFIRMATION — same barcode must appear 3
//      consecutive frames before onDetected fires.
//   2. CONFIRMATION FEEDBACK — "Confirming…" UI + progress bar.
//   3. FORMAT RESTRICTION — EAN_13, EAN_8, UPC_A, UPC_E, CODE_128.
//   4. TRY_HARDER hint — extra decode passes for angled barcodes.
//   5. HIGH-RES CONSTRAINTS — 1080p after stream starts.
//   6. CONTINUOUS AUTOFOCUS — applied via applyConstraints.
//
// Icons: IonIcon (ionicons) instead of Heroicons.
// Styles: inline instead of Tailwind classes.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  cameraOutline, closeOutline, refreshOutline, qrCodeOutline,
} from 'ionicons/icons';

const W = {
  green:     '#2D6A1F',
  greenLt:   '#3E8A2A',
  greenPale: '#D6EDD0',
  greenText: '#1A5014',
  red:       '#B83220',
  redPale:   '#FAE3DF',
};

// How many consecutive frames must return the same barcode.
const CONFIRM_FRAMES = 3;

interface VideoDevice { deviceId: string; label: string; }

interface Props {
  onDetected: (barcode: string) => void;
  onClose:    () => void;
}

type Status = 'init' | 'scanning' | 'confirming' | 'permission' | 'error';

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const readerRef   = useRef<any>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const [status,       setStatus]       = useState<Status>('init');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [cameras,      setCameras]      = useState<VideoDevice[]>([]);
  const [activeCamIdx, setActiveCamIdx] = useState(0);
  const [confirmPct,   setConfirmPct]   = useState(0);

  async function startWithCamera(camIdx: number | undefined) {
    setStatus('init');
    setErrorMsg('');
    setConfirmPct(0);

    try {
      const [
        { BrowserMultiFormatReader },
        { DecodeHintType, BarcodeFormat },
      ] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ]);

      try { controlsRef.current?.stop(); } catch {}

      // ── Format restriction ──────────────────────────────────
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      const devices: VideoDevice[] = await BrowserMultiFormatReader.listVideoInputDevices();

      if (!devices || devices.length === 0) {
        setStatus('error');
        setErrorMsg('No camera found on this device.');
        return;
      }

      setCameras(prev => prev.length === 0 ? devices : prev);

      const backIdx = devices.findIndex(d =>
        /back|rear|environment/i.test(d.label)
      );
      const useIdx = camIdx !== undefined ? camIdx : (backIdx >= 0 ? backIdx : 0);
      setActiveCamIdx(useIdx);

      setStatus('scanning');

      // ── Multi-frame confirmation state ──────────────────────
      const confirm = { lastText: null as string | null, matchCount: 0, fired: false };

      const controls = await reader.decodeFromVideoDevice(
        devices[useIdx].deviceId,
        videoRef.current!,
        (result: any, err: any) => {
          if (confirm.fired) return;

          if (result) {
            const text = result.getText();

            if (text === confirm.lastText) {
              confirm.matchCount++;
            } else {
              confirm.lastText   = text;
              confirm.matchCount = 1;
            }

            const pct = Math.min(
              Math.round((confirm.matchCount / CONFIRM_FRAMES) * 100),
              99
            );
            setConfirmPct(pct);

            if (confirm.matchCount === 1) {
              setStatus('confirming');
            }

            if (confirm.matchCount >= CONFIRM_FRAMES) {
              confirm.fired = true;
              setConfirmPct(100);
              setTimeout(() => { try { controls?.stop(); } catch {} }, 150);
              onDetected(text);
            }

          } else {
            // Partially decay streak on missed frame
            if (confirm.matchCount > 0) {
              confirm.matchCount = Math.max(0, confirm.matchCount - 1);
              const pct = Math.round((confirm.matchCount / CONFIRM_FRAMES) * 100);
              setConfirmPct(pct);
              if (confirm.matchCount === 0) {
                confirm.lastText = null;
                setStatus('scanning');
              }
            }
          }
        }
      );
      controlsRef.current = controls;

      // ── Apply 1080p + continuous autofocus after stream starts ─
      try {
        const stream = videoRef.current?.srcObject as MediaStream | null;
        if (stream) {
          const track = stream.getVideoTracks()[0];
          if (track) {
            const caps = (track as any).getCapabilities?.() ?? {};
            const c: any = {};
            if (caps.width)  c.width  = { ideal: 1920 };
            if (caps.height) c.height = { ideal: 1080 };
            if (caps.focusMode?.includes?.('continuous')) {
              c.focusMode = 'continuous';
            }
            if (Object.keys(c).length) await track.applyConstraints(c);
          }
        }
      } catch { /* best-effort */ }

    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setStatus('permission');
      } else {
        setStatus('error');
        setErrorMsg(e?.message ?? 'Camera could not be started.');
      }
    }
  }

  async function switchCamera() {
    try { controlsRef.current?.stop(); } catch {}
    const next = (activeCamIdx + 1) % (cameras.length || 1);
    await startWithCamera(next);
  }

  useEffect(() => {
    startWithCamera(undefined);
    return () => { try { controlsRef.current?.stop(); } catch {} };
  }, []);

  const isActive = status === 'scanning' || status === 'confirming';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#000' }}>

      {/* ── Dark header ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', flexShrink: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IonIcon icon={cameraOutline} style={{ fontSize: 16, color: W.greenLt }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Scan Barcode</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                borderRadius: 8, padding: '4px 10px',
                fontSize: 12, fontWeight: 600, color: '#fff', border: 'none', cursor: 'pointer',
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            >
              <IonIcon icon={refreshOutline} style={{ fontSize: 12 }} />
              Flip
            </button>
          )}
          <button
            onClick={() => { try { controlsRef.current?.stop(); } catch {} onClose(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', padding: 4,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <IonIcon icon={closeOutline} style={{ fontSize: 20 }} />
          </button>
        </div>
      </div>

      {/* ── Camera viewport ───────────────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', backgroundColor: '#000', minHeight: 220 }}>

        {/* Video feed */}
        <video
          ref={videoRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            display: isActive ? 'block' : 'none',
          }}
          playsInline muted autoPlay
        />

        {/* Reticle — corners + scan line */}
        {isActive && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ position: 'relative', width: 290, height: 96 }}>

              {/* Corner brackets */}
              {([
                { top: 0,    left: 0,    borderTop: '3px solid',    borderLeft: '3px solid',  borderRadius: '5px 0 0 0' },
                { top: 0,    right: 0,   borderTop: '3px solid',    borderRight: '3px solid', borderRadius: '0 5px 0 0' },
                { bottom: 0, left: 0,    borderBottom: '3px solid', borderLeft: '3px solid',  borderRadius: '0 0 0 5px' },
                { bottom: 0, right: 0,   borderBottom: '3px solid', borderRight: '3px solid', borderRadius: '0 0 5px 0' },
              ] as React.CSSProperties[]).map((s, i) => (
                <div key={i} style={{
                  position: 'absolute', width: 22, height: 22,
                  borderColor: status === 'confirming' ? '#7FD45A' : W.greenLt,
                  transition: 'border-color 0.2s',
                  ...s,
                }} />
              ))}

              {/* Animated scan line */}
              <div style={{
                position: 'absolute', left: 12, right: 12, height: 2,
                background: status === 'confirming'
                  ? 'linear-gradient(to right, transparent, #7FD45A, transparent)'
                  : `linear-gradient(to right, transparent, ${W.greenLt}, transparent)`,
                boxShadow: status === 'confirming'
                  ? '0 0 10px 2px #7FD45A'
                  : `0 0 8px 1px ${W.greenLt}`,
                animation: 'scanline 2s ease-in-out infinite',
                top: '50%',
                transition: 'background 0.2s, box-shadow 0.2s',
              }} />

              {/* Confirmation progress bar */}
              {status === 'confirming' && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: -20,
                  height: 3, borderRadius: 2, overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${confirmPct}%`,
                    background: `linear-gradient(to right, ${W.greenLt}, #7FD45A)`,
                    borderRadius: 2,
                    transition: 'width 0.08s linear',
                  }} />
                </div>
              )}
            </div>

            {/* Status text */}
            <p style={{
              position: 'absolute', left: 0, right: 0, textAlign: 'center',
              bottom: status === 'confirming' ? 28 : 18,
              fontSize: 12, fontWeight: 600,
              color: status === 'confirming' ? '#7FD45A' : 'rgba(255,255,255,0.85)',
              textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              transition: 'color 0.2s, bottom 0.2s',
              margin: 0,
            }}>
              {status === 'confirming'
                ? '✓ Hold still — confirming…'
                : 'Align barcode inside the box'}
            </p>
          </div>
        )}

        {/* Loading */}
        {status === 'init' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.15)',
              borderTopColor: W.greenLt,
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Starting camera…
            </p>
          </div>
        )}

        {/* Permission denied */}
        {status === 'permission' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '0 24px', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16,
              backgroundColor: W.redPale,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IonIcon icon={cameraOutline} style={{ fontSize: 24, color: W.red }} />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              Camera Permission Denied
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              Allow camera in your browser settings, then reload.
            </p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '0 24px', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16,
              backgroundColor: W.redPale,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IonIcon icon={qrCodeOutline} style={{ fontSize: 24, color: W.red }} />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              Camera Error
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              {errorMsg}
            </p>
            <button
              onClick={() => startWithCamera(activeCamIdx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                borderRadius: 12, padding: '8px 16px',
                fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg,${W.greenLt},${W.green})`,
              }}
            >
              <IonIcon icon={refreshOutline} style={{ fontSize: 14 }} />
              Try Again
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 6%;  opacity: 0.5; }
          50%  { top: 88%; opacity: 1;   }
          100% { top: 6%;  opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}