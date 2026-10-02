'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Language = 'en' | 'vi';

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

const copy = {
  en: {
    label: 'ADMIN',
    title: 'Coupon management',
    intro:
      'Codes are percentage-only. Each account may use a given code once, and the limit is enforced by the database rather than by this page.',
    new: 'New coupon',
    code: 'Code',
    percent: 'Discount %',
    expires: 'Expires',
    never: 'Never expires',
    cap: 'Max total redemptions',
    unlimited: 'Unlimited',
    note: 'Note',
    active: 'Active',
    save: 'Save',
    create: 'Create',
    cancel: 'Cancel',
    edit: 'Edit',
    remove: 'Delete',
    used: 'Used',
    accounts: 'Accounts',
    promote: 'Make admin',
    demote: 'Make user',
    sync: 'Syncing with other admins every 5s',
    denied: 'This page is for admin accounts only.',
    signedOut: 'No account is signed in on this device.',
    empty: 'No coupon yet.',
    confirmDelete: 'Delete this code? Its redemptions stay as the usage record.',
    failed: 'Could not reach the server.',
    signIn: 'Sign in',
  },
  vi: {
    label: 'QUẢN TRỊ',
    title: 'Quản lý coupon',
    intro:
      'Mã chỉ giảm theo phần trăm. Mỗi tài khoản chỉ dùng được một mã đó một lần, và giới hạn do database kiểm soát chứ không phải trang này.',
    new: 'Tạo coupon',
    code: 'Mã',
    percent: 'Giảm %',
    expires: 'Hết hạn',
    never: 'Không bao giờ hết hạn',
    cap: 'Tổng số lượt dùng tối đa',
    unlimited: 'Không giới hạn',
    note: 'Ghi chú',
    active: 'Đang bật',
    save: 'Lưu',
    create: 'Tạo',
    cancel: 'Huỷ',
    edit: 'Sửa',
    remove: 'Xoá',
    used: 'Đã dùng',
    accounts: 'Tài khoản',
    promote: 'Cho làm admin',
    demote: 'Bỏ admin',
    sync: 'Đang đồng bộ với admin khác mỗi 5 giây',
    denied: 'Trang này chỉ dành cho tài khoản admin.',
    signedOut: 'Thiết bị này chưa đăng nhập tài khoản nào.',
    empty: 'Chưa có coupon nào.',
    confirmDelete: 'Xoá mã này? Các lượt đã dùng vẫn được giữ làm lịch sử.',
    failed: 'Không kết nối được máy chủ.',
    signIn: 'Đăng nhập',
  },
} as const;

const ERROR_TEXT: Record<string, { en: string; vi: string }> = {
  BAD_CODE: { en: 'Code must be 1–32 characters, A–Z, 0–9, dash or underscore.', vi: 'Mã phải dài 1–32 ký tự, chữ A–Z, số, gạch ngang hoặc gạch dưới.' },
  BAD_PERCENT: { en: 'Discount must be a whole number from 1 to 100.', vi: 'Phần trăm phải là số nguyên từ 1 đến 100.' },
  BAD_EXPIRY: { en: 'That expiry date is not a valid date.', vi: 'Ngày hết hạn không hợp lệ.' },
  BAD_LIMIT: { en: 'The redemption cap must be empty or a whole number of 1 or more.', vi: 'Giới hạn lượt dùng phải để trống hoặc là số nguyên từ 1 trở lên.' },
  BAD_ROLE: { en: 'Role must be user or admin.', vi: 'Vai trò phải là user hoặc admin.' },
  COUPON_EXISTS: { en: 'That code already exists.', vi: 'Mã đó đã tồn tại.' },
  CODE_IMMUTABLE: { en: 'A code cannot be renamed — its redemptions point at it.', vi: 'Không đổi được tên mã — các lượt đã dùng gắn vào mã đó.' },
  LAST_ADMIN: { en: 'This is the last admin. Removing it would leave nobody able to promote anyone.', vi: 'Đây là admin cuối cùng. Bỏ đi thì không còn ai phong được admin nữa.' },
  UNKNOWN_USER: { en: 'No such account.', vi: 'Không có tài khoản này.' },
  FORBIDDEN: { en: 'This account is not an admin.', vi: 'Tài khoản này không phải admin.' },
  NEED_LOGIN: { en: 'No account is signed in on this device.', vi: 'Thiết bị này chưa đăng nhập tài khoản nào.' },
};

const EMPTY_FORM = { code: '', percent: '20', expires: '', never: true, cap: '', active: true, note: '' };

/** A date input gives a day; a coupon that expires on the 30th is usable through the 30th. */
const endOfDay = (date: string): string | null => {
  if (!date) return null;
  const parsed = new Date(`${date}T23:59:59.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toDateInput = (iso: string | null): string => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export default function AdminPage() {
  const [language, setLanguage] = useState<Language>('en');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied' | 'signedOut'>('loading');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The ref closes the double-submit window synchronously; the state drives the disabled button.
  // A ref read during render is a React error, so it cannot do both jobs.
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);

  const t = copy[language];

  /**
   * Pure data, no setState — so both the poller and the buttons after a mutation can share it.
   * The `active` flag belongs to the poller, because a poll that resolves after unmount, or after
   * a newer poll started, must not write stale rows over fresh ones.
   */
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
      setError(t.failed);
    }
  }, [fetchAll, t.failed]);

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
        if (active) setError(t.failed);
      }
    };
    void poll();
    // The other-admin sync. Polling rather than a socket: the data changes only when someone
    // edits it, a five-second lag is invisible here, and it needs no realtime publication set up
    // on the database. ponytail: swap for Supabase Realtime if admins ever need sub-second sync.
    const timer = setInterval(() => void poll(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchAll, t.failed]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

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
        setError(ERROR_TEXT[json.error ?? '']?.[language] ?? json.error ?? 'UNKNOWN');
        return;
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      await refresh();
    } catch {
      setError(t.failed);
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
    if (!window.confirm(t.confirmDelete)) return;
    const response = await fetch(`/api/admin/coupons/${encodeURIComponent(coupon.code)}`, { method: 'DELETE' });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setError(ERROR_TEXT[json.error ?? '']?.[language] ?? json.error ?? 'UNKNOWN');
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

  const setRole = async (user: User, role: 'user' | 'admin') => {
    setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      setError(ERROR_TEXT[json.error ?? '']?.[language] ?? json.error ?? 'UNKNOWN');
    }
    await refresh();
  };

  const dateFormat = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' });
  const label = 'mb-1 block text-sm text-ink-muted';
  const field =
    'min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink outline-none focus:border-brass/60';
  const button = 'min-h-11 rounded-full border border-border px-4 text-sm text-ink transition hover:border-brass/50';
  const primary = 'min-h-11 rounded-full bg-brass px-5 text-sm font-medium text-white transition disabled:opacity-50';

  if (status === 'signedOut' || status === 'denied' || status === 'loading') {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:px-10">
        <p className="text-sm font-semibold tracking-widest text-brass">ZERO COUNCIL · {t.label}</p>
        <h1 className="mt-3 font-serif text-3xl text-ink">{t.title}</h1>
        <p className="mt-4 text-ink-muted">{status === 'loading' ? '…' : status === 'denied' ? t.denied : t.signedOut}</p>
        {status !== 'loading' && (
          <Link href="/" className={`${button} mt-6 inline-flex items-center`}>
            {t.signIn}
          </Link>
        )}
      </main>
    );
  }

  return (
    <main lang={language} className="mx-auto w-full max-w-5xl space-y-10 px-5 py-10 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-semibold tracking-widest text-brass">ZERO COUNCIL · {t.label}</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">{t.title}</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border p-1" role="group" aria-label="Language">
          {(['en', 'vi'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`min-h-11 rounded-full px-3 text-sm transition ${language === item ? 'bg-brass text-white' : 'text-ink-muted hover:bg-background hover:text-ink'}`}
              aria-pressed={language === item}
              onClick={() => setLanguage(item)}
            >
              {item === 'en' ? 'English' : 'Tiếng Việt'}
            </button>
          ))}
        </div>
      </header>

      <p className="max-w-3xl text-ink-muted">{t.intro}</p>
      <p className="text-sm text-ink-muted">{t.sync}</p>
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-ink">{notice}</p>}

      <section className="rounded-2xl border border-border bg-surface p-6" aria-labelledby="form-heading">
        <h2 id="form-heading" className="font-serif text-xl text-ink">
          {editing ? t.edit : t.new}
        </h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div>
            <label className={label} htmlFor="code">{t.code}</label>
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
            <label className={label} htmlFor="percent">{t.percent}</label>
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
              {t.never}
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
            <label className={label} htmlFor="cap">{t.cap}</label>
            <input
              id="cap"
              className={field}
              type="number"
              min={1}
              placeholder={t.unlimited}
              value={form.cap}
              onChange={(e) => setForm({ ...form, cap: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="note">{t.note}</label>
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
              {t.active}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className={primary} disabled={saving}>
              {editing ? t.save : t.create}
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
                {t.cancel}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3" aria-labelledby="coupons-heading">
        <h2 id="coupons-heading" className="font-serif text-xl text-ink">{t.code}</h2>
        {coupons.length === 0 && <p className="text-ink-muted">{t.empty}</p>}
        {coupons.map((coupon) => (
          <article key={coupon.code} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="min-w-0">
              <p className="font-mono text-ink">
                {coupon.code} <span className="text-brass">−{coupon.percent}%</span>
                {!coupon.active && <span className="ml-2 text-sm text-ink-muted">(off)</span>}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {t.expires}: {coupon.expiresAt ? dateFormat.format(new Date(coupon.expiresAt)) : t.never} · {t.used}{' '}
                {coupon.used}
                {coupon.maxTotalRedemptions === null ? ` / ${t.unlimited}` : ` / ${coupon.maxTotalRedemptions}`}
                {coupon.note ? ` · ${coupon.note}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} onClick={() => toggleActive(coupon)}>
                {coupon.active ? 'Off' : 'On'}
              </button>
              <button type="button" className={button} onClick={() => startEdit(coupon)}>
                {t.edit}
              </button>
              <button type="button" className={button} onClick={() => remove(coupon)}>
                {t.remove}
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3" aria-labelledby="users-heading">
        <h2 id="users-heading" className="font-serif text-xl text-ink">{t.accounts}</h2>
        {users.length === 0 && <p className="text-ink-muted">{t.empty}</p>}
        {users.map((user) => (
          <article key={user.email} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="min-w-0">
              <p className="truncate text-ink">{user.email}</p>
              <p className="mt-1 text-sm text-ink-muted">{user.role}</p>
            </div>
            <button
              type="button"
              className={button}
              onClick={() => setRole(user, user.role === 'admin' ? 'user' : 'admin')}
            >
              {user.role === 'admin' ? t.demote : t.promote}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
