// ============================================================
// FILE: src/pages/Register.tsx
//
// CONVERTED FROM: resources/js/Pages/Auth/Register.jsx
//
// CHANGES FROM WEB VERSION:
//   - No Inertia useForm / Head / Link — uses React state + axios
//   - No GuestLayout / PasswordCriteriaPanel import — inlined here
//   - Navigation via useHistory (react-router-dom)
//   - On success → history.replace('/pending')
//   - Warm Earth palette matches the rest of the Ionic app
//   - IonPage / IonContent shell so Ionic router is happy
// ============================================================

import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import { useHistory, Link } from 'react-router-dom';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  EnvelopeIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';
import { W } from '../theme/warmEarth';

// ── Password criteria panel (inlined from GuestLayout) ─────────
interface Criteria { label: string; met: boolean }

function PasswordCriteriaPanel({ password }: { password: string }) {
  const criteria: Criteria[] = [
    { label: 'At least 8 characters',   met: password.length >= 8 },
    { label: 'Uppercase letter (A–Z)',   met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a–z)',   met: /[a-z]/.test(password) },
    { label: 'Number (0–9)',             met: /\d/.test(password) },
    { label: 'Special character (!@#…)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  return (
    <div style={{
      marginTop: 8, borderRadius: 12, padding: '10px 12px',
      backgroundColor: W.cardBgAlt, border: `1px solid ${W.border}`,
    }}>
      {criteria.map(c => (
        <div key={c.label} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
        }}>
          {c.met
            ? <CheckCircleIcon style={{ width: 13, height: 13, color: W.green, flexShrink: 0 }} />
            : <XCircleIcon     style={{ width: 13, height: 13, color: '#C0A898', flexShrink: 0 }} />}
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: c.met ? W.greenText : W.textMuted,
          }}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: W.textMuted, textTransform: 'uppercase',
  letterSpacing: 0.4, marginBottom: 5,
};

const inputStyle = (hasError = false): React.CSSProperties => ({
  width: '100%', padding: '11px 12px 11px 38px',
  borderRadius: 12, fontSize: 13,
  border: `1px solid ${hasError ? '#EBBDB8' : W.border}`,
  backgroundColor: hasError ? '#FAE3DF' : W.inputBg,
  color: W.text, boxSizing: 'border-box', colorScheme: 'light',
  outline: 'none',
});

// ── PasswordInput ──────────────────────────────────────────────
function PasswordInput({
  id, value, onChange, placeholder, hasError,
}: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hasError?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <LockClosedIcon style={{
        position: 'absolute', left: 12, top: '50%',
        transform: 'translateY(-50%)', width: 15, height: 15,
        color: W.textMuted, pointerEvents: 'none',
      }} />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle(hasError), paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 12, top: '50%',
          transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, color: W.textMuted,
          display: 'flex', alignItems: 'center',
        }}
      >
        {show
          ? <EyeSlashIcon style={{ width: 15, height: 15 }} />
          : <EyeIcon      style={{ width: 15, height: 15 }} />}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function Register() {
  const history = useHistory();

  const [name,                 setName]                 = useState('');
  const [email,                setEmail]                = useState('');
  const [password,             setPassword]             = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [processing,           setProcessing]           = useState(false);
  const [errors,               setErrors]               = useState<Record<string, string>>({});
  const [mounted,              setMounted]              = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  // ── Password strength ──────────────────────────────────────
  const passwordValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const passwordsMatch =
    password.length > 0 &&
    passwordConfirmation.length > 0 &&
    password === passwordConfirmation;

  const passwordMismatch =
    passwordConfirmation.length > 0 &&
    password !== passwordConfirmation;

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid || passwordMismatch) return;

    setErrors({});
    setProcessing(true);

    try {
      await api.post('/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      history.replace('/pending');
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.errors) {
        // Laravel validation errors shape: { errors: { field: ['msg'] } }
        const mapped: Record<string, string> = {};
        Object.entries(data.errors as Record<string, string[]>).forEach(([k, v]) => {
          mapped[k] = v[0];
        });
        setErrors(mapped);
      } else {
        setErrors({ general: data?.message ?? 'Registration failed. Please try again.' });
      }
      setPassword('');
      setPasswordConfirmation('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <IonPage>
      <IonContent style={{ '--background': W.pageBg } as any}>
        <div style={{
          minHeight: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 20px',
        }}>
          <div
            style={{
              width: '100%', maxWidth: 420,
              opacity:   mounted ? 1 : 0,
              transform: mounted ? 'translateX(0)' : 'translateX(-24px)',
              transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
            }}
          >
            {/* ── Logo / Brand ─────────────────────────────── */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                overflow: 'hidden', margin: '0 auto 14px',
                border: `3px solid ${W.green}`,
                outline: `3px solid ${W.greenPale ?? '#D6EDD0'}`,
                outlineOffset: 2,
                boxShadow: '0 8px 32px rgba(45,106,31,0.30)',
              }}>
                <picture>
                  <source srcSet="/assets/COOP.webp" type="image/webp" />
                  <img
                    src="/assets/COOP.png"
                    alt="OCMPC Logo"
                    width={72}
                    height={72}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </picture>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: W.text }}>
                Create account
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: W.textMuted }}>
                Register your staff account.{' '}
                <span style={{ fontWeight: 600, color: '#92600A' }}>
                  Admin approval required.
                </span>
              </p>
            </div>

            {/* ── Card ─────────────────────────────────────── */}
            <div style={{
              backgroundColor: W.cardBg,
              borderRadius: 20,
              border: `1px solid ${W.border}`,
              boxShadow: '0 4px 24px rgba(28,43,26,0.10)',
              padding: '24px 20px',
            }}>

              {/* General error */}
              {errors.general && (
                <div style={{
                  marginBottom: 16, borderRadius: 12, padding: '10px 14px',
                  backgroundColor: '#FAE3DF', border: '1px solid #EBBDB8',
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#B83220', fontWeight: 600 }}>
                    {errors.general}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Full Name */}
                <div>
                  <label htmlFor="reg-name" style={labelStyle}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <UserIcon style={{
                      position: 'absolute', left: 12, top: '50%',
                      transform: 'translateY(-50%)', width: 15, height: 15,
                      color: W.textMuted, pointerEvents: 'none',
                    }} />
                    <input
                      id="reg-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Juan dela Cruz"
                      required
                      style={inputStyle(!!errors.name)}
                    />
                  </div>
                  {errors.name && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B83220' }}>{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="reg-email" style={labelStyle}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <EnvelopeIcon style={{
                      position: 'absolute', left: 12, top: '50%',
                      transform: 'translateY(-50%)', width: 15, height: 15,
                      color: W.textMuted, pointerEvents: 'none',
                    }} />
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      style={inputStyle(!!errors.email)}
                    />
                  </div>
                  {errors.email && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B83220' }}>{errors.email}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="reg-password" style={labelStyle}>Password</label>
                  <PasswordInput
                    id="reg-password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Create a strong password"
                    hasError={!!errors.password}
                  />
                  {errors.password && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B83220' }}>{errors.password}</p>
                  )}
                  {password.length > 0 && <PasswordCriteriaPanel password={password} />}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="reg-confirm" style={labelStyle}>Confirm Password</label>
                  <PasswordInput
                    id="reg-confirm"
                    value={passwordConfirmation}
                    onChange={setPasswordConfirmation}
                    placeholder="Repeat your password"
                    hasError={!!errors.password_confirmation || passwordMismatch}
                  />
                  {passwordsMatch && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 600, color: W.greenText }}>
                      ✓ Passwords match
                    </p>
                  )}
                  {passwordMismatch && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B83220' }}>
                      Passwords do not match
                    </p>
                  )}
                  {errors.password_confirmation && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B83220' }}>
                      {errors.password_confirmation}
                    </p>
                  )}
                </div>

                {/* Weak password warning */}
                {password.length > 0 && !passwordValid && (
                  <div style={{
                    borderRadius: 12, padding: '10px 14px',
                    backgroundColor: '#FAE3DF', border: '1px solid #EBBDB8',
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#B83220' }}>
                      <strong>Password is too weak.</strong> It must contain at least 8 characters,
                      an uppercase letter, a lowercase letter, a number, and a special character.
                    </p>
                  </div>
                )}

                {/* Approval notice */}
                <div style={{
                  borderRadius: 12, padding: '12px 14px',
                  backgroundColor: '#FEF3C7', border: '1px solid #FCD34D',
                }}>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#92600A' }}>
                    <strong>What happens after you register?</strong><br />
                    You will receive a confirmation email immediately. Your account will not be
                    active until an administrator approves it.
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={processing || passwordMismatch || !passwordValid}
                  style={{
                    padding: '13px 22px', borderRadius: 12, border: 'none',
                    background: processing || passwordMismatch || !passwordValid
                      ? '#A8C4A2'
                      : `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
                    color: 'white', fontWeight: 800, fontSize: 14,
                    cursor: processing || passwordMismatch || !passwordValid ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: processing || passwordMismatch || !passwordValid
                      ? 'none'
                      : '0 4px 14px rgba(45,106,31,0.25)',
                    transition: 'all 0.2s',
                  }}
                >
                  {processing && (
                    <IonSpinner name="crescent" style={{ width: 14, height: 14 }} />
                  )}
                  {processing ? 'Submitting…' : 'Create Account'}
                </button>

              </form>
            </div>

            {/* ── Sign in link ──────────────────────────────── */}
            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: W.textMuted }}>
              Already have an account?{' '}
              <Link
                to="/login"
                style={{ fontWeight: 700, color: W.green, textDecoration: 'none' }}
              >
                Sign in
              </Link>
            </p>

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}