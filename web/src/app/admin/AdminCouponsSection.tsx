'use client';

/**
 * Coupon creation/edit form and active coupon list section for the `/admin` console.
 */

import React from 'react';
import { useApp } from '@/prototype/context/AppContext';
import {
  ADMIN_BUTTON_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_LABEL_CLASS,
  ADMIN_PRIMARY_CLASS,
  type Coupon,
  type CouponFormState,
} from './types-and-helpers';

interface AdminCouponsSectionProps {
  coupons: Coupon[];
  form: CouponFormState;
  editing: string | null;
  saving: boolean;
  onChangeForm: (next: CouponFormState) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancelEdit: () => void;
  onToggleActive: (coupon: Coupon) => void;
  onStartEdit: (coupon: Coupon) => void;
  onRemove: (coupon: Coupon) => void;
}

export const AdminCouponsSection: React.FC<AdminCouponsSectionProps> = ({
  coupons,
  form,
  editing,
  saving,
  onChangeForm,
  onSubmit,
  onCancelEdit,
  onToggleActive,
  onStartEdit,
  onRemove,
}) => {
  const { language, t } = useApp();
  const dateFormat = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
  });

  return (
    <>
      <section
        className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        aria-labelledby="form-heading"
      >
        <h2 id="form-heading" className="font-serif text-xl text-ink">
          {editing ? t.adminEdit : t.adminNew}
        </h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div>
            <label className={ADMIN_LABEL_CLASS} htmlFor="code">
              {t.adminCode}
            </label>
            <input
              id="code"
              className={ADMIN_FIELD_CLASS}
              value={form.code}
              readOnly={editing !== null}
              onChange={(e) => onChangeForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="LAUNCH20"
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS} htmlFor="percent">
              {t.adminPercent}
            </label>
            <input
              id="percent"
              className={ADMIN_FIELD_CLASS}
              type="number"
              min={1}
              max={100}
              value={form.percent}
              onChange={(e) => onChangeForm({ ...form, percent: e.target.value })}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS} htmlFor="expires">
              <input
                id="never"
                type="checkbox"
                className="mr-2"
                checked={form.never}
                onChange={(e) => onChangeForm({ ...form, never: e.target.checked })}
              />
              {t.adminNever}
            </label>
            <input
              id="expires"
              type="date"
              className={ADMIN_FIELD_CLASS}
              disabled={form.never}
              value={form.expires}
              onChange={(e) => onChangeForm({ ...form, expires: e.target.value })}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS} htmlFor="cap">
              {t.adminCap}
            </label>
            <input
              id="cap"
              className={ADMIN_FIELD_CLASS}
              type="number"
              min={1}
              placeholder={t.adminUnlimited}
              value={form.cap}
              onChange={(e) => onChangeForm({ ...form, cap: e.target.value })}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS} htmlFor="note">
              {t.adminNote}
            </label>
            <input
              id="note"
              className={ADMIN_FIELD_CLASS}
              value={form.note}
              onChange={(e) => onChangeForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => onChangeForm({ ...form, active: e.target.checked })}
              />
              {t.adminActive}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className={ADMIN_PRIMARY_CLASS} disabled={saving}>
              {t.adminSave}
            </button>
            {editing && (
              <button type="button" className={ADMIN_BUTTON_CLASS} onClick={onCancelEdit}>
                {t.adminCancel}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3" aria-labelledby="coupons-heading">
        <h2 id="coupons-heading" className="font-serif text-xl text-ink">
          {t.adminCode}
        </h2>
        {coupons.length === 0 && <p className="text-ink-muted">{t.adminEmptyCoupons}</p>}
        {coupons.map((coupon) => (
          <article
            key={coupon.code}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4"
          >
            <div className="min-w-0">
              <p className="font-mono text-ink">
                {coupon.code} <span className="text-brass">−{coupon.percent}%</span>
                {!coupon.active && <span className="ml-2 text-sm text-ink-muted">(off)</span>}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {t.adminExpires}:{' '}
                {coupon.expiresAt ? dateFormat.format(new Date(coupon.expiresAt)) : t.adminNever} ·{' '}
                {t.adminUsed} {coupon.used}
                {coupon.maxTotalRedemptions === null
                  ? ` / ${t.adminUnlimited}`
                  : ` / ${coupon.maxTotalRedemptions}`}
                {coupon.note ? ` · ${coupon.note}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={ADMIN_BUTTON_CLASS}
                onClick={() => onToggleActive(coupon)}
              >
                {coupon.active ? t.adminActionTurnOff : t.adminActionTurnOn}
              </button>
              <button
                type="button"
                className={ADMIN_BUTTON_CLASS}
                onClick={() => onStartEdit(coupon)}
              >
                {t.adminEdit}
              </button>
              <button
                type="button"
                className={ADMIN_BUTTON_CLASS}
                onClick={() => onRemove(coupon)}
              >
                {t.adminRemove}
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
};
