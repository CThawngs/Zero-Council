'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Home, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { useApp } from '@/prototype/context/AppContext';
import type { Copy } from '@/prototype/i18n';

type Coupon = {
  code: string;
  percent: number;
  expiresAt: string | null;
  maxTotalRedemptions: number | null;
  active: boolean;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  used: number;
};

type User = { email: string; role: 'user' | 'admin'; createdAt: string };

const EMPTY_FORM = { code: '', percent: '20', expires: '', never: true, cap: '', active: true, note: '' };

const ROLES = [
  {
    value: 'admin',
    label: {en: 'Administrator', vi: 'Quản trị viên'},
  },
  {
    value: 'user',
    label: {en: 'User', vi: 'Thành viên'},
  },
]

const adminErrorMessage = (code: string | undefined, t: Copy): string => {
  switch (code) {
    case 'INVALID_JSON':
      return t.adminErrInvalidJson;
    case 'BAD_CODE':
    case 'INVALID_CODE':
      return t.adminErrInvalidCode;
    case 'BAD_PERCENT':
    case 'INVALID_PERCENT':
      return t.adminErrInvalidPercent;
    case 'BAD_LIMIT':
    case 'INVALID_CAP':
      return t.adminErrInvalidCap;
    case 'BAD_EXPIRY':
    case 'INVALID_EXPIRY':
      return t.adminErrInvalidExpiry;
    case 'BAD_ROLE':
      return t.adminErrBadRole;
    case 'COUPON_EXISTS':
      return t.adminErrCouponExists;
    case 'CODE_IMMUTABLE':
      return t.adminErrCodeImmutable;
    case 'LAST_ADMIN':
      return t.adminErrLastAdmin;
    case 'FOUNDER_LOCKED':
      return t.adminErrFounderLocked;
    case 'ONLY_FOUNDER_CAN_DEMOTE':
      return t.adminErrOnlyFounderDemote;
    case 'ONLY_FOUNDER':
      return t.adminErrOnlyFounder;
    case 'PASSWORD_TOO_SHORT':
      return t.adminErrPasswordTooShort;
    case 'RESET_FAILED':
      return t.adminErrResetFailed;
    case 'UNKNOWN_USER':
      return t.adminErrUnknownUser;
    case 'FORBIDDEN':
      return t.adminErrForbidden;
    case 'NEED_LOGIN':
      return t.adminErrNeedLogin;
    default:
      return code || t.adminUnknownError;
  }
};

/** A date input gives a day; a coupon that expires on the 30th is usable through the 30th. */
const endOfDay = (date: string): string | null => {
  if (!date) return null;
  const parsed = new Date(`${date}T23:59:59.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toDateInput = (iso: string | null): string => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export default function AdminPage() {
  const { language, setLanguage, theme, toggleTheme, t } = useApp();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchRole, setSearchRole] = useState('all');
  const [appliedFilter, setAppliedFilter] = useState({ email: '', role: 'all' });

  const filterAccounts = () => {
    setAppliedFilter({
      email: searchEmail.trim().toLowerCase(),
      role: searchRole,
    });
  };

  const filteredUsers = users.filter((user) => {
    const matchEmail = !appliedFilter.email || user.email.toLowerCase().includes(appliedFilter.email);
    const matchRole = appliedFilter.role === 'all' || user.role === appliedFilter.role;
    return matchEmail && matchRole;
  });
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied' | 'signedOut'>('loading');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [me, setMe] = useState<{ email: string; isFounder: boolean } | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const [couponResponse, userResponse] = await Promise.all([
      fetch('/api/admin/coupons'),
      fetch('/api/admin/users'),
    ]);
    if (couponResponse.status === 401) return { kind: 'signedOut' as const };
    if (couponResponse.status === 403) return { kind: 'denied' as const };
    if (!couponResponse.ok || !userResponse.ok) return { kind: 'denied' as const };
    const couponJson = (await couponResponse.json()) as { coupons?: Coupon[] };
    const userJson = (await userResponse.json()) as { users?: User[] };
    return { kind: 'ok' as const, coupons: couponJson.coupons ?? [], users: userJson.users ?? [] };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchAll();
      if (next.kind === 'ok') {
        setCoupons(next.coupons);
        setUsers(next.users);
        setStatus('ok');
      } else {
        setStatus(next.kind);
      }
    } catch {
      setError(t.adminFailed);
    }
  }, [fetchAll, t.adminFailed]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const next = await fetchAll();
        if (!active) return;
        if (next.kind === 'ok') {
          setCoupons(next.coupons);
          setUsers(next.users);
          setStatus('ok');
        } else {
          setStatus(next.kind);
        }
      } catch {
        if (active) setError(t.adminFailed);
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchAll, t.adminFailed]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.adminPageTitle;
  }, [language, t.adminPageTitle]);

  useEffect(() => {
    let active = true;
    void fetch('/api/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { email?: string; isFounder?: boolean } | null) => {
        if (active && body?.email) setMe({ email: body.email, isFounder: Boolean(body.isFounder) });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      code: form.code,
      percent: Number(form.percent),
      expiresAt: form.never ? null : endOfDay(form.expires),
      maxTotalRedemptions: form.cap.trim() === '' ? null : Number(form.cap),
      active: form.active,
      note: form.note,
    };

    try {
      const response = editing
        ? await fetch(`/api/admin/coupons/${encodeURIComponent(editing)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        setError(adminErrorMessage(json.error, t));
        return;
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      await refresh();
    } catch {
      setError(t.adminFailed);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const startEdit = (coupon: Coupon) => {
    setEditing(coupon.code);
    setForm({
      code: coupon.code,
      percent: String(coupon.percent),
      expires: toDateInput(coupon.expiresAt),
      never: coupon.expiresAt === null,
      cap: coupon.maxTotalRedemptions === null ? '' : String(coupon.maxTotalRedemptions),
      active: coupon.active,
      note: coupon.note ?? '',
    });
    setError(null);
  };

  const remove = async (coupon: Coupon) => {
    if (!window.confirm(t.adminConfirmDelete)) return;
    const response = await fetch(`/api/admin/coupons/${encodeURIComponent(coupon.code)}`, { method: 'DELETE' });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setError(adminErrorMessage(json.error, t));
      return;
    }
    if (editing === coupon.code) {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    await refresh();
  };

  const toggleActive = async (coupon: Coupon) => {
    await fetch(`/api/admin/coupons/${encodeURIComponent(coupon.code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !coupon.active }),
    });
    await refresh();
  };

  const resetPassword = async (user: User) => {
    setError(null);
    setNotice(null);
    if (newPassword.length < 8) {
      setError(t.adminErrPasswordTooShort);
      return;
    }
    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setError(adminErrorMessage(json.error, t));
      return;
    }
    setResetFor(null);
    setNewPassword('');
    setNotice(t.adminResetDone);
  };

  const setRole = async (user: User, role: 'user' | 'admin') => {
    setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setError(adminErrorMessage(json.error, t));
    }
    await refresh();
  };

  const dateFormat = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' });
  const label = 'mb-1 block text-sm text-ink-muted';
  const field =
    'min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink outline-none focus:border-brass/60';
  const button = 'min-h-11 rounded-full border border-border px-4 text-sm text-ink transition hover:border-brass/50';
  const primary = 'min-h-11 rounded-full bg-brass px-5 text-sm font-medium text-accent-ink transition disabled:opacity-50';

  const headerControls = (
    <div className="flex flex-wrap items-center gap-2">
      <nav className="flex items-center gap-1 rounded-full border border-border p-1" aria-label={t.workspaceNavigation}>
        <Link
          href="/"
          onClick={() => {
            try {
              sessionStorage.setItem('zc:initial-dashboard-redirect', 'true');
            } catch {}
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-muted transition hover:bg-background hover:text-ink"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          <span>{t.adminBackHome}</span>
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-muted transition hover:bg-background hover:text-ink"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          <span>{t.adminToDashboard}</span>
        </Link>
      </nav>
      <div className="flex items-center gap-1 rounded-full border border-border p-1" role="group" aria-label={t.language}>
        {(['en', 'vi'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`min-h-11 rounded-full px-3 text-sm transition ${language === item ? 'bg-brass text-accent-ink' : 'text-ink-muted hover:bg-background hover:text-ink'}`}
            aria-pressed={language === item}
            onClick={() => void setLanguage(item)}
          >
            {item === 'en' ? 'English' : 'Tiếng Việt'}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t.themeToLight : t.themeToDark}
        title={theme === 'dark' ? t.themeToLight : t.themeToDark}
        className="icon-button min-w-11 px-3"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );

  if (status === 'signedOut' || status === 'denied' || status === 'loading') {
    return (
      <main lang={language} className="mx-auto w-full max-w-3xl px-4 py-10 text-center sm:px-10">
        <div className="mb-8 flex justify-end">{headerControls}</div>
        <p className="text-sm font-semibold tracking-widest text-brass">ZERO COUNCIL · {t.adminLabel}</p>
        <h1 className="mt-3 font-serif text-3xl text-ink">{t.adminTitle}</h1>
        <p className="mt-4 text-ink-muted">
          {status === 'loading' ? '…' : status === 'denied' ? t.adminDenied : t.adminSignedOut}
        </p>
        {status !== 'loading' && (
          <Link href="/" className={`${button} mt-6 inline-flex items-center`}>
            {t.adminSignIn}
          </Link>
        )}
      </main>
    );
  }

  return (
    <main lang={language} className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-widest text-brass">ZERO COUNCIL · {t.adminLabel}</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">{t.adminTitle}</h1>
        </div>
        {headerControls}
      </header>

      <p className="max-w-3xl text-ink-muted">{t.adminIntro}</p>
      <p className="text-sm text-ink-muted">{t.adminSync}</p>
      {error && <p role="alert" className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-ink">{notice}</p>}

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="form-heading">
        <h2 id="form-heading" className="font-serif text-xl text-ink">
          {editing ? t.adminEdit : t.adminNew}
        </h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div>
            <label className={label} htmlFor="code">{t.adminCode}</label>
            <input
              id="code"
              className={field}
              value={form.code}
              readOnly={editing !== null}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="LAUNCH20"
            />
          </div>
          <div>
            <label className={label} htmlFor="percent">{t.adminPercent}</label>
            <input
              id="percent"
              className={field}
              type="number"
              min={1}
              max={100}
              value={form.percent}
              onChange={(e) => setForm({ ...form, percent: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="expires">
              <input
                id="never"
                type="checkbox"
                className="mr-2"
                checked={form.never}
                onChange={(e) => setForm({ ...form, never: e.target.checked })}
              />
              {t.adminNever}
            </label>
            <input
              id="expires"
              type="date"
              className={field}
              disabled={form.never}
              value={form.expires}
              onChange={(e) => setForm({ ...form, expires: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="cap">{t.adminCap}</label>
            <input
              id="cap"
              className={field}
              type="number"
              min={1}
              placeholder={t.adminUnlimited}
              value={form.cap}
              onChange={(e) => setForm({ ...form, cap: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="note">{t.adminNote}</label>
            <input
              id="note"
              className={field}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              {t.adminActive}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className={primary} disabled={saving}>
              {t.adminSave}
            </button>
            {editing && (
              <button
                type="button"
                className={button}
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY_FORM);
                }}
              >
                {t.adminCancel}
              </button>
            )}
          </div>
        </form>
      </section>

        <section className="space-y-3" aria-labelledby="coupons-heading">
          <h2 id="coupons-heading" className="font-serif text-xl text-ink">{t.adminCode}</h2>
          {coupons.length === 0 && <p className="text-ink-muted">{t.adminEmptyCoupons}</p>}
          {coupons.map((coupon) => (
            <article key={coupon.code} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
              <div className="min-w-0">
                <p className="font-mono text-ink">
                  {coupon.code} <span className="text-brass">−{coupon.percent}%</span>
                  {!coupon.active && <span className="ml-2 text-sm text-ink-muted">(off)</span>}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {t.adminExpires}: {coupon.expiresAt ? dateFormat.format(new Date(coupon.expiresAt)) : t.adminNever} · {t.adminUsed}{' '}
                  {coupon.used}
                  {coupon.maxTotalRedemptions === null ? ` / ${t.adminUnlimited}` : ` / ${coupon.maxTotalRedemptions}`}
                  {coupon.note ? ` · ${coupon.note}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={button} onClick={() => toggleActive(coupon)}>
                  {coupon.active ? t.adminActionTurnOff : t.adminActionTurnOn}
                </button>
                <button type="button" className={button} onClick={() => startEdit(coupon)}>
                  {t.adminEdit}
                </button>
                <button type="button" className={button} onClick={() => remove(coupon)}>
                  {t.adminRemove}
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-3" aria-labelledby="users-heading">
          <h2 id="users-heading" className="font-serif text-xl text-ink">{t.adminAccounts}</h2>

          {/* tools */}
          <div className='flex items-center gap-3 w-full'>
            <div className='flex items-center gap-3'>
              {/* EMAIL */}
              <span className='flex items-center gap-2 text-nowrap'>Email:</span>
              <input type="email" name="search" id="search"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className='w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brass'/>

              {/* ROLE */}
              <span className='flex items-center gap-2 text-nowrap'>{t.adminRole}</span>
              <select name="role" id="role"
              value={searchRole}
              onChange={(e) => setSearchRole(e.target.value)}
              className='w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brass'>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label[language]}
                  </option>
                ))}
              </select>
            </div>

            <button type="button" onClick={filterAccounts}
            className='button-primary'>{t.adminFilter}</button>
          </div>

          {filteredUsers.length === 0 && <p className="text-ink-muted">{t.adminEmptyAccounts}</p>}
          {filteredUsers.map((user) => {
            const isFounderRow = Boolean(me?.isFounder && me.email.toLowerCase() === user.email.toLowerCase());
            const canDemote = Boolean(me?.isFounder && !isFounderRow);
            return (
            <article key={user.email} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
              <div className="min-w-0 grow">
                <p className="truncate text-ink">{user.email}</p>
                <p className={`mt-1 text-sm ${user.role === 'admin' ? 'text-brass' : 'text-ink-muted'}`}>{user.role}</p>
                {me?.isFounder && resetFor === user.email ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      className={field}
                      style={{ maxWidth: '16rem' }}
                      value={newPassword}
                      autoComplete="new-password"
                      placeholder={t.adminNewPassword}
                      aria-label={t.adminNewPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button type="button" className={primary} onClick={() => void resetPassword(user)}>
                      {t.adminResetPassword}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {user.role === 'admin' ? (
                  canDemote ? (
                    <button
                      type="button"
                      className={button}
                      onClick={() => setRole(user, 'user')}
                    >
                      {t.adminRemoveAdmin}
                    </button>
                  ) : null
                ) : (
                  <button
                    type="button"
                    className={button}
                    onClick={() => setRole(user, 'admin')}
                  >
                    {t.adminMakeAdmin}
                  </button>
                )}
                {me?.isFounder ? (
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      setResetFor(resetFor === user.email ? null : user.email);
                      setNewPassword('');
                      setError(null);
                    }}
                  >
                    {t.adminResetPassword}
                  </button>
                ) : null}
              </div>
            </article>
            );
          })}
        </section>
      </main>
  );
}
