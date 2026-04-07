// ============================================================
// FILE: src/pages/Profile.tsx
//
// MIRRORS:
//   resources/js/Pages/Profile/Edit.jsx
//   resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.jsx
//   resources/js/Pages/Profile/Partials/UpdatePasswordForm.jsx
//   resources/js/Pages/Profile/Partials/DeleteUserForm.jsx
//
// DATA SOURCE:
//   GET    /api/me
//   PATCH  /api/profile         (name + email)
//   PUT    /api/profile/password (current + new password)
//   DELETE /api/profile          (account deletion)
//
// FEATURES CARRIED OVER:
//   ✓ Update profile name & email
//   ✓ Update password with show/hide toggles
//   ✓ Delete account (with password confirmation)
//   ✓ Super-admin guard — Danger Zone hidden entirely for user ID 1
//   ✓ Pull-to-refresh
//   ✓ Flash success / error banners
//   ✓ Heroicons throughout (no emoji / unicode)
//   ✓ Warm Earth palette throughout
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { IonSpinner, IonRefresher, IonRefresherContent, IonModal } from '@ionic/react';
import {
  UserIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '../components/AppLayout';
import api from '../services/api';
import { W } from '../theme/warmEarth';

// ── Types ─────────────────────────────────────────────────────
interface AuthUser {
  id:          number;
  name:        string;
  email:       string;
  role:        string;
  is_approved: boolean;
}

// ── Shared style helpers ───────────────────────────────────────
const card: React.CSSProperties = {
  backgroundColor: W.cardBg,
  borderRadius: 16,
  boxShadow: '0 2px 12px rgba(28,43,26,0.08)',
  border: `1px solid ${W.border}`,
  overflow: 'hidden',
  marginBottom: 14,
};

const cardHeader = (danger = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 16px',
  backgroundColor: W.cardBgAlt,
  borderBottom: `1px solid ${W.border}`,
});

const iconWrap = (danger = false): React.CSSProperties => ({
  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: danger ? '#FAE3DF' : W.greenPale,
});

const inputStyle = (hasError = false): React.CSSProperties => ({
  width: '100%', padding: '11px 12px',
  borderRadius: 12, fontSize: 13,
  border: `1px solid ${hasError ? '#EBBDB8' : W.border}`,
  backgroundColor: hasError ? '#FAE3DF' : W.inputBg,
  color: W.text, boxSizing: 'border-box', colorScheme: 'light',
});

const btnPrimary: React.CSSProperties = {
  padding: '12px 22px', borderRadius: 12, border: 'none',
  background: `linear-gradient(135deg, ${W.greenLt}, ${W.green})`,
  color: 'white', fontWeight: 800, fontSize: 14,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  boxShadow: '0 4px 14px rgba(45,106,31,0.25)',
};

const btnSecondary: React.CSSProperties = {
  padding: '12px 22px', borderRadius: 12,
  backgroundColor: W.cardBgAlt, border: `1px solid ${W.border}`,
  color: W.textMuted, fontWeight: 700, fontSize: 14,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};

const btnDanger: React.CSSProperties = {
  padding: '12px 22px', borderRadius: 12, border: 'none',
  backgroundColor: '#B83220',
  color: 'white', fontWeight: 800, fontSize: 14,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: W.textMuted, textTransform: 'uppercase', letterSpacing: 0.4,
  marginBottom: 5,
};

// ── Flash Banner ───────────────────────────────────────────────
function FlashBanner({ msg, ok, onDismiss }: { msg: string; ok: boolean; onDismiss: () => void }) {
  return (
    <div style={{
      marginBottom: 14, borderRadius: 16, padding: '10px 14px',
      backgroundColor: ok ? W.greenPale : '#FAE3DF',
      border: `1px solid ${ok ? '#B2D9A8' : '#EBBDB8'}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {ok
          ? <CheckIcon style={{ width: 16, height: 16, color: W.greenText, flexShrink: 0 }} />
          : <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#B83220', flexShrink: 0 }} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: ok ? W.greenText : '#B83220' }}>
          {msg}
        </span>
      </div>
      <button onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, color: ok ? W.greenText : '#B83220' }}>
        <XMarkIcon style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}

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
      <input
        id={id} type={show ? 'text' : 'password'}
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle(hasError), paddingRight: 40 }}
      />
      <button type="button" onClick={() => setShow(v => !v)}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: W.textMuted, display: 'flex', alignItems: 'center',
        }}
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show
          ? <EyeSlashIcon style={{ width: 16, height: 16 }} />
          : <EyeIcon      style={{ width: 16, height: 16 }} />}
      </button>
    </div>
  );
}

// ── Update Profile Form ────────────────────────────────────────
function UpdateProfileForm({
  user, onSuccess, onError,
}: { user: AuthUser; onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [name,       setName]       = useState(user.name);
  const [email,      setEmail]      = useState(user.email);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    setErrors({});
    const errs: Record<string, string> = {};
    if (!name.trim())  errs.name  = 'Name is required.';
    if (!email.trim()) errs.email = 'Email is required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await api.patch('/profile', { name: name.trim(), email: email.trim() });
      onSuccess('Profile updated successfully.');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update profile.';
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '16px', backgroundColor: W.pageBg }}>
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="prof-name" style={labelStyle}>Full Name</label>
        <input id="prof-name" type="text" value={name}
          onChange={e => setName(e.target.value)}
          style={inputStyle(!!errors.name)} />
        {errors.name && <p style={{ fontSize: 11, color: '#B83220', marginTop: 4 }}>{errors.name}</p>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="prof-email" style={labelStyle}>Email Address</label>
        <input id="prof-email" type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle(!!errors.email)} />
        {errors.email && <p style={{ fontSize: 11, color: '#B83220', marginTop: 4 }}>{errors.email}</p>}
      </div>

      <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
        {saving ? <IonSpinner name="crescent" style={{ width: 14, height: 14 }} /> : null}
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  );
}

// ── Update Password Form ───────────────────────────────────────
function UpdatePasswordForm({
  onSuccess, onError,
}: { onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [current,  setCurrent]  = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    setErrors({});
    const errs: Record<string, string> = {};
    if (!current)               errs.current = 'Current password is required.';
    if (newPass.length < 8)     errs.newPass = 'New password must be at least 8 characters.';
    if (newPass !== confirm)    errs.confirm = 'Passwords do not match.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await api.put('/profile/password', {
        current_password:      current,
        password:              newPass,
        password_confirmation: confirm,
      });
      setCurrent(''); setNewPass(''); setConfirm('');
      onSuccess('Password updated successfully.');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update password.';
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '16px', backgroundColor: W.pageBg }}>
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="pass-current" style={labelStyle}>Current Password</label>
        <PasswordInput id="pass-current" value={current} onChange={setCurrent} hasError={!!errors.current} />
        {errors.current && <p style={{ fontSize: 11, color: '#B83220', marginTop: 4 }}>{errors.current}</p>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label htmlFor="pass-new" style={labelStyle}>New Password</label>
        <PasswordInput id="pass-new" value={newPass} onChange={setNewPass} hasError={!!errors.newPass} />
        {errors.newPass && <p style={{ fontSize: 11, color: '#B83220', marginTop: 4 }}>{errors.newPass}</p>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="pass-confirm" style={labelStyle}>Confirm New Password</label>
        <PasswordInput id="pass-confirm" value={confirm} onChange={setConfirm} hasError={!!errors.confirm} />
        {errors.confirm && <p style={{ fontSize: 11, color: '#B83220', marginTop: 4 }}>{errors.confirm}</p>}
      </div>

      <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
        {saving ? <IonSpinner name="crescent" style={{ width: 14, height: 14 }} /> : null}
        {saving ? 'Updating…' : 'Update Password'}
      </button>
    </div>
  );
}

// ── Delete Account Section ─────────────────────────────────────
function DeleteAccountSection({
  onSuccess, onError,
}: { onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [modalOpen,  setModalOpen]  = useState(false);
  const [password,   setPassword]   = useState('');
  const [deleting,   setDeleting]   = useState(false);
  const [passError,  setPassError]  = useState('');

  const handleDelete = async () => {
    setPassError('');
    if (!password) { setPassError('Password is required to confirm deletion.'); return; }
    setDeleting(true);
    try {
      await api.delete('/profile', { data: { password } });
      onSuccess('Account deleted.');
      setModalOpen(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to delete account.';
      setPassError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '16px', backgroundColor: W.pageBg }}>
      <p style={{ fontSize: 13, color: W.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        This action is irreversible. All your data and records will be permanently deleted.
      </p>

      <button onClick={() => setModalOpen(true)} style={btnDanger}>
        <ExclamationTriangleIcon style={{ width: 16, height: 16 }} />
         Delete My Account
      </button>

      {/* Confirmation modal */}
      <IonModal isOpen={modalOpen} onDidDismiss={() => { setModalOpen(false); setPassword(''); setPassError(''); }}
        initialBreakpoint={0.55} breakpoints={[0, 0.55]}
        style={{ '--border-radius': '24px 24px 0 0' } as React.CSSProperties}>
        <div style={{
          backgroundColor: W.cardBg, height: '100%',
          display: 'flex', flexDirection: 'column',
          borderRadius: '24px 24px 0 0', overflow: 'hidden',
        }}>
          {/* Modal header */}
          <div style={{ padding: '16px 18px', backgroundColor: '#B83220', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ExclamationTriangleIcon style={{ width: 16, height: 16 }} /> Authorize Deletion
              </p>
              <button onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
                <XMarkIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>

          {/* Modal body */}
          <div style={{ padding: 18 }}>
            <p style={{ fontSize: 13, color: W.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
              Enter your password to permanently delete your account. This cannot be undone.
            </p>

            <label htmlFor="del-password" style={labelStyle}>
              Confirm Password <span style={{ color: '#B83220' }}>*</span>
            </label>
            <PasswordInput id="del-password" value={password} onChange={setPassword}
              placeholder="Enter your password" hasError={!!passError} />
            {passError && <p style={{ fontSize: 11, color: '#B83220', marginTop: 4 }}>{passError}</p>}
          </div>

          {/* Modal footer */}
          <div style={{ padding: '0 18px 18px', display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setModalOpen(false)} style={{ ...btnSecondary, flex: 1, justifyContent: 'center' }}>
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting}
              style={{ ...btnDanger, flex: 1, justifyContent: 'center', opacity: deleting ? 0.6 : 1 }}>
              {deleting ? <IonSpinner name="crescent" style={{ width: 14, height: 14 }} /> : null}
              {deleting ? 'Deleting…' : 'Delete Now'}
            </button>
          </div>
        </div>
      </IonModal>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Profile() {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash,   setFlash]   = useState<{ msg: string; ok: boolean } | null>(null);

  const showFlash = (msg: string, ok: boolean) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AuthUser>('/me');
      setUser(res.data);
    } catch {
      showFlash('Failed to load profile.', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async (e: any) => { await load(); e.detail.complete(); };

  const isSuperAdmin = user?.id === 1;

  if (loading) {
    return (
      <AppLayout title="Profile">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <IonSpinner name="crescent" style={{ color: W.green }} />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout title="Profile">
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <ExclamationTriangleIcon style={{ width: 36, height: 36, color: '#B83220', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, color: '#B83220' }}>Could not load profile.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Profile Settings">
      <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
        <IonRefresherContent pullingText="Pull to refresh" refreshingText="Loading…" />
      </IonRefresher>

      {flash && (
        <FlashBanner msg={flash.msg} ok={flash.ok} onDismiss={() => setFlash(null)} />
      )}

      {/* ── User identity summary ──────────────────────────── */}
      <div style={{
        ...card,
        padding: '16px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          backgroundColor: W.greenPale, border: `1px solid #B2D9A8`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <UserIcon style={{ width: 24, height: 24, color: W.greenText }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: W.text }}>{user.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: W.textMuted }}>{user.email}</p>
          <span style={{
            display: 'inline-block', marginTop: 5,
            borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
            backgroundColor: W.greenPale, color: W.greenText,
          }}>
            {user.role}
          </span>
          {isSuperAdmin && (
            <span style={{
              display: 'inline-block', marginTop: 5, marginLeft: 6,
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
              backgroundColor: W.bluePale, color: W.blueText,
            }}>
              Super Admin
            </span>
          )}
        </div>
      </div>

      {/* ── Profile Information ────────────────────────────── */}
      <div style={card}>
        <div style={cardHeader()}>
          <div style={iconWrap()}>
            <UserIcon style={{ width: 18, height: 18, color: W.green }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: W.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Profile Information
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
              Update your name and email address.
            </p>
          </div>
        </div>
        <UpdateProfileForm
          user={user}
          onSuccess={msg => { showFlash(msg, true); load(); }}
          onError={msg => showFlash(msg, false)}
        />
      </div>

      {/* ── Security / Password ────────────────────────────── */}
      <div style={card}>
        <div style={cardHeader()}>
          <div style={iconWrap()}>
            <ShieldCheckIcon style={{ width: 18, height: 18, color: W.green }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: W.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Security
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
              Manage your password to keep your account secure.
            </p>
          </div>
        </div>
        <UpdatePasswordForm
          onSuccess={msg => showFlash(msg, true)}
          onError={msg => showFlash(msg, false)}
        />
      </div>

      {/* ── Danger Zone (hidden for super-admin) ──────────── */}
      {isSuperAdmin ? (
        <div style={card}>
          <div style={cardHeader(true)}>
            <div style={iconWrap(true)}>
              <ShieldCheckIcon style={{ width: 18, height: 18, color: '#B83220' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: W.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Danger Zone
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
                Account deletion is not available for this account.
              </p>
            </div>
          </div>
          <div style={{ padding: 16, backgroundColor: W.pageBg }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              borderRadius: 12, padding: '12px 14px',
              backgroundColor: W.greenPale, border: '1px solid #B2D9A8',
            }}>
              <ShieldCheckIcon style={{ width: 18, height: 18, color: W.greenText, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: W.greenText }}>
                  Super-admin account is protected
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: W.textMuted, lineHeight: 1.6 }}>
                  This is the primary administrator account (Admin #1) and cannot be deleted.
                  It is permanently protected to ensure the system always has at least one administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={card}>
          <div style={cardHeader(true)}>
            <div style={iconWrap(true)}>
              <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#B83220' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: W.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Danger Zone
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: W.textMuted }}>
                Permanently remove your account and all associated data.
              </p>
            </div>
          </div>
          <DeleteAccountSection
            onSuccess={msg => showFlash(msg, true)}
            onError={msg => showFlash(msg, false)}
          />
        </div>
      )}

    </AppLayout>
  );
}