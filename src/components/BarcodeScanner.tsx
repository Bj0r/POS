// ============================================================
// FILE: src/components/BarcodeScanner.tsx
//
// Uses @capacitor-mlkit/barcode-scanning for NATIVE camera.
//
// Setup:
//   npm install @capacitor-mlkit/barcode-scanning
//   npx cap sync android
//
// AndroidManifest.xml must have:
//   <uses-permission android:name="android.permission.CAMERA" />
// ============================================================

import React, { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  cameraOutline,
  closeOutline,
  refreshOutline,
  qrCodeOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import {
  BarcodeScanner as CapBarcodeScanner,
  BarcodeFormat,
  LensFacing,
  BarcodesScannedEvent,
} from '@capacitor-mlkit/barcode-scanning';

// ── Theme colours ────────────────────────────────────────────
const W = {
  green:   '#2D6A1F',
  greenLt: '#3E8A2A',
  red:     '#B83220',
  redPale: '#FAE3DF',
};

// ── Props ────────────────────────────────────────────────────
interface Props {
  onDetected: (barcode: string) => void;
  onClose:    () => void;
}

type Status = 'init' | 'scanning' | 'permission' | 'error';

// ── Component ────────────────────────────────────────────────
export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const [status,   setStatus]   = useState<Status>('init');
  const [errorMsg, setErrorMsg] = useState('');

  const isNative = Capacitor.isNativePlatform();

  // ── Stop / cleanup ───────────────────────────────────────
  async function stopScan() {
    try {
      document.querySelector('body')?.classList.remove('barcode-scanner-active');
      await CapBarcodeScanner.removeAllListeners();
      await CapBarcodeScanner.stopScan();
    } catch {
      // best-effort cleanup
    }
  }

  // ── Native scan (Android APK) ────────────────────────────
  async function startNativeScan() {
    // 1. Request camera permission
    const { camera } = await CapBarcodeScanner.requestPermissions();
    if (camera !== 'granted') {
      setStatus('permission');
      return;
    }

    // 2. Install Google MLKit module if missing (Android only)
    try {
      const { available } =
        await CapBarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await CapBarcodeScanner.installGoogleBarcodeScannerModule();
      }
    } catch {
      // not required on all devices — continue
    }

    // 3. Make the WebView transparent so the native camera preview shows through
    document.querySelector('body')?.classList.add('barcode-scanner-active');

    setStatus('scanning');

    // 4. Listen for scanned barcodes
    //    ✅ Correct event name: 'barcodesScanned'  (PLURAL — has an 's')
    //    ✅ Correct result shape: event.barcodes   (array)
    await CapBarcodeScanner.addListener(
      'barcodesScanned',
      async (event: BarcodesScannedEvent) => {
        const first = event.barcodes?.[0]?.rawValue;
        if (first) {
          await stopScan();
          onDetected(first);
        }
      },
    );

    // 5. Start scanning
    await CapBarcodeScanner.startScan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
        BarcodeFormat.Code128,
      ],
      lensFacing: LensFacing.Back,
    });
  }

  // ── Web / browser fallback (dev preview only) ────────────
  async function startWebScan() {
    try {
      const [
        { BrowserMultiFormatReader },
        { DecodeHintType, BarcodeFormat: ZBarcodeFormat },
      ] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ]);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        ZBarcodeFormat.EAN_13,
        ZBarcodeFormat.EAN_8,
        ZBarcodeFormat.UPC_A,
        ZBarcodeFormat.UPC_E,
        ZBarcodeFormat.CODE_128,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader  = new BrowserMultiFormatReader(hints);
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();

      if (!devices?.length) {
        setStatus('error');
        setErrorMsg('No camera found on this device.');
        return;
      }

      const backIdx = devices.findIndex(d =>
        /back|rear|environment/i.test(d.label),
      );
      const useIdx = backIdx >= 0 ? backIdx : 0;

      setStatus('scanning');

      const videoEl = document.getElementById(
        'zxing-video',
      ) as HTMLVideoElement | null;
      if (!videoEl) return;

      await reader.decodeFromVideoDevice(
        devices[useIdx].deviceId,
        videoEl,
        (result: any) => {
          if (result) onDetected(result.getText());
        },
      );
    } catch (e: any) {
      if (
        e?.name === 'NotAllowedError' ||
        e?.name === 'PermissionDeniedError'
      ) {
        setStatus('permission');
      } else {
        setStatus('error');
        setErrorMsg(e?.message ?? 'Camera could not be started.');
      }
    }
  }

  // ── Main entry point ─────────────────────────────────────
  async function startScan() {
    setStatus('init');
    setErrorMsg('');
    try {
      if (isNative) {
        await startNativeScan();
      } else {
        await startWebScan();
      }
    } catch (e: any) {
      await stopScan();
      setStatus('error');
      setErrorMsg(e?.message ?? 'Camera could not be started.');
    }
  }

  async function handleClose() {
    await stopScan();
    onClose();
  }

  useEffect(() => {
    startScan();
    return () => { stopScan(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isScanning = status === 'scanning';

  // ── Render ───────────────────────────────────────────────
  return (
    <>
      {/* Global CSS — makes WebView transparent during native scan */}
      <style>{`
        body.barcode-scanner-active ion-app,
        body.barcode-scanner-active #root {
          background: transparent !important;
        }
        body.barcode-scanner-active {
          background: transparent !important;
        }
        @keyframes scanline {
          0%   { top: 6%;  opacity: 0.5; }
          50%  { top: 88%; opacity: 1;   }
          100% { top: 6%;  opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          display:         'flex',
          flexDirection:   'column',
          height:          '100%',
          backgroundColor: isNative && isScanning ? 'transparent' : '#000',
        }}
      >
        {/* ── Header bar ───────────────────────────────────── */}
        <div
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'space-between',
            padding:         '8px 16px',
            flexShrink:      0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            borderBottom:    '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IonIcon
              icon={cameraOutline}
              style={{ fontSize: 16, color: W.greenLt }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
              Scan Barcode
            </span>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              display:    'flex',
              alignItems: 'center',
              padding:    4,
              color:      'rgba(255,255,255,0.6)',
            }}
          >
            <IonIcon icon={closeOutline} style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* ── Camera viewport ──────────────────────────────── */}
        <div
          style={{
            position:        'relative',
            flex:            1,
            overflow:        'hidden',
            backgroundColor: isNative && isScanning ? 'transparent' : '#000',
            minHeight:       220,
          }}
        >
          {/* Web-only <video> element (not rendered in native APK) */}
          {!isNative && (
            <video
              id="zxing-video"
              style={{
                position:   'absolute',
                inset:      0,
                width:      '100%',
                height:     '100%',
                objectFit:  'cover',
                display:    isScanning ? 'block' : 'none',
              }}
              playsInline
              muted
              autoPlay
            />
          )}

          {/* Scan reticle (shown while scanning) */}
          {isScanning && (
            <div
              style={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                pointerEvents:  'none',
              }}
            >
              <div style={{ position: 'relative', width: 290, height: 96 }}>
                {/* Corner brackets */}
                {(
                  [
                    { top: 0,    left:  0, borderTop:    '3px solid', borderLeft:   '3px solid', borderRadius: '5px 0 0 0' },
                    { top: 0,    right: 0, borderTop:    '3px solid', borderRight:  '3px solid', borderRadius: '0 5px 0 0' },
                    { bottom: 0, left:  0, borderBottom: '3px solid', borderLeft:   '3px solid', borderRadius: '0 0 0 5px' },
                    { bottom: 0, right: 0, borderBottom: '3px solid', borderRight:  '3px solid', borderRadius: '0 0 5px 0' },
                  ] as React.CSSProperties[]
                ).map((s, i) => (
                  <div
                    key={i}
                    style={{
                      position:    'absolute',
                      width:       22,
                      height:      22,
                      borderColor: W.greenLt,
                      ...s,
                    }}
                  />
                ))}

                {/* Animated scan line */}
                <div
                  style={{
                    position:   'absolute',
                    left:       12,
                    right:      12,
                    height:     2,
                    background: `linear-gradient(to right, transparent, ${W.greenLt}, transparent)`,
                    boxShadow:  `0 0 8px 1px ${W.greenLt}`,
                    animation:  'scanline 2s ease-in-out infinite',
                    top:        '50%',
                  }}
                />
              </div>

              <p
                style={{
                  position:   'absolute',
                  left:       0,
                  right:      0,
                  textAlign:  'center',
                  bottom:     18,
                  fontSize:   12,
                  fontWeight: 600,
                  color:      'rgba(255,255,255,0.85)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  margin:     0,
                }}
              >
                Align barcode inside the box
              </p>
            </div>
          )}

          {/* Loading spinner */}
          {status === 'init' && (
            <div
              style={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            12,
              }}
            >
              <div
                style={{
                  width:       36,
                  height:      36,
                  borderRadius: '50%',
                  border:      '3px solid rgba(255,255,255,0.15)',
                  borderTopColor: W.greenLt,
                  animation:   'spin 0.8s linear infinite',
                }}
              />
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                Starting camera…
              </p>
            </div>
          )}

          {/* Permission denied */}
          {status === 'permission' && (
            <div
              style={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            12,
                padding:        '0 24px',
                textAlign:      'center',
              }}
            >
              <div
                style={{
                  width:           48,
                  height:          48,
                  borderRadius:    16,
                  backgroundColor: W.redPale,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                }}
              >
                <IonIcon
                  icon={cameraOutline}
                  style={{ fontSize: 24, color: W.red }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                Camera Permission Denied
              </p>
              <p
                style={{
                  margin:     0,
                  fontSize:   12,
                  color:      'rgba(255,255,255,0.6)',
                  lineHeight: 1.4,
                }}
              >
                Go to Settings → App → Permissions → enable Camera, then try again.
              </p>
              <button
                onClick={startScan}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        8,
                  borderRadius: 12,
                  padding:    '8px 16px',
                  fontSize:   12,
                  fontWeight: 700,
                  color:      '#fff',
                  border:     'none',
                  cursor:     'pointer',
                  background: `linear-gradient(135deg,${W.greenLt},${W.green})`,
                }}
              >
                <IonIcon icon={refreshOutline} style={{ fontSize: 14 }} />
                Try Again
              </button>
            </div>
          )}

          {/* Generic error */}
          {status === 'error' && (
            <div
              style={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            12,
                padding:        '0 24px',
                textAlign:      'center',
              }}
            >
              <div
                style={{
                  width:           48,
                  height:          48,
                  borderRadius:    16,
                  backgroundColor: W.redPale,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                }}
              >
                <IonIcon
                  icon={qrCodeOutline}
                  style={{ fontSize: 24, color: W.red }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                Camera Error
              </p>
              <p
                style={{
                  margin:     0,
                  fontSize:   12,
                  color:      'rgba(255,255,255,0.6)',
                  lineHeight: 1.4,
                }}
              >
                {errorMsg}
              </p>
              <button
                onClick={startScan}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        8,
                  borderRadius: 12,
                  padding:    '8px 16px',
                  fontSize:   12,
                  fontWeight: 700,
                  color:      '#fff',
                  border:     'none',
                  cursor:     'pointer',
                  background: `linear-gradient(135deg,${W.greenLt},${W.green})`,
                }}
              >
                <IonIcon icon={refreshOutline} style={{ fontSize: 14 }} />
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}