'use client';

/**
 * Administrative console (`/admin`) for promo coupon CRUD, account RBAC, and founder password resets.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Home, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { useApp } from '@/prototype/context/AppContext';
import { AdminCouponsSection } from './AdminCouponsSection';
import { AdminUsersSection } from './AdminUsersSection';
import {
  ADMIN_BUTTON_CLASS,
  EMPTY_FORM,
  adminErrorMessage,
  endOfDay,
  toDateInput,
  type Coupon,
  type User,
} from './types-and-helpers';

export default function AdminPage() {
  const { language, setLanguage, theme, toggleTheme, t } = useApp();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchRole, setSearchRole] = useState('all');
  const [appliedFilter, setAppliedFilter] = useState({ email: '', role: 'all' });
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

  const filterAccounts = () => {
    setAppliedFilter({
      email: searchEmail.trim().toLowerCase(),
      role: searchRole,
    });
  };

  const filteredUsers = users.filter((user) => {
    const matchEmail =
      !appliedFilter.email || user.email.toLowerCase().includes(appliedFilter.email);
    const matchRole = appliedFilter.role === 'all' || user.role === appliedFilter.role;
    return matchEmail && matchRole;
  });

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
    const response = await fetch(`/api/admin/coupons/${encodeURIComponent(coupon.code)}`, {
      method: 'DELETE',
    });
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

  const headerControls = (
    <div className="flex flex-wrap items-center gap-2">
      <nav
        className="flex items-center gap-1 rounded-full border border-border p-1"
        aria-label={t.workspaceNavigation}
      >
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
      <div
        className="flex items-center gap-1 rounded-full border border-border p-1"
        role="group"
        aria-label={t.language}
      >
        {(['en', 'vi'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`min-h-11 rounded-full px-3 text-sm transition ${
              language === item
                ? 'bg-brass text-accent-ink'
                : 'text-ink-muted hover:bg-background hover:text-ink'
            }`}
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
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );

  if (status === 'signedOut' || status === 'denied' || status === 'loading') {
    return (
      <main lang={language} className="mx-auto w-full max-w-3xl px-4 py-10 text-center sm:px-10">
        <div className="mb-8 flex justify-end">{headerControls}</div>
        <p className="text-sm font-semibold tracking-widest text-brass">
          ZERO COUNCIL · {t.adminLabel}
        </p>
        <h1 className="mt-3 font-serif text-3xl text-ink">{t.adminTitle}</h1>
        <p className="mt-4 text-ink-muted">
          {status === 'loading' ? '…' : status === 'denied' ? t.adminDenied : t.adminSignedOut}
        </p>
        {status !== 'loading' && (
          <Link href="/" className={`${ADMIN_BUTTON_CLASS} mt-6 inline-flex items-center`}>
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
          <p className="text-sm font-semibold tracking-widest text-brass">
            ZERO COUNCIL · {t.adminLabel}
          </p>
          <h1 className="mt-2 font-serif text-3xl text-ink">{t.adminTitle}</h1>
        </div>
        {headerControls}
      </header>

      <p className="max-w-3xl text-ink-muted">{t.adminIntro}</p>
      <p className="text-sm text-ink-muted">{t.adminSync}</p>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-sm text-terracotta"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-ink"
        >
          {notice}
        </p>
      )}

      <AdminCouponsSection
        coupons={coupons}
        form={form}
        editing={editing}
        saving={saving}
        onChangeForm={setForm}
        onSubmit={(e) => void submit(e)}
        onCancelEdit={() => {
          setEditing(null);
          setForm(EMPTY_FORM);
        }}
        onToggleActive={(coupon) => void toggleActive(coupon)}
        onStartEdit={startEdit}
        onRemove={(coupon) => void remove(coupon)}
      />

      <AdminUsersSection
        filteredUsers={filteredUsers}
        me={me}
        searchEmail={searchEmail}
        searchRole={searchRole}
        resetFor={resetFor}
        newPassword={newPassword}
        onSearchEmailChange={setSearchEmail}
        onSearchRoleChange={setSearchRole}
        onApplyFilter={filterAccounts}
        onSetRole={(user, role) => void setRole(user, role)}
        onToggleResetFor={(email) => {
          setResetFor(resetFor === email ? null : email);
          setNewPassword('');
          setError(null);
        }}
        onNewPasswordChange={setNewPassword}
        onSubmitResetPassword={(user) => void resetPassword(user)}
      />
    </main>
  );
}
