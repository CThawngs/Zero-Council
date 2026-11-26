'use client';

/**
 * User accounts filter, role management, and founder password-reset section for `/admin`.
 */

import React from 'react';
import { useApp } from '@/prototype/context/AppContext';
import {
  ADMIN_BUTTON_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_CLASS,
  ROLES,
  type User,
} from './types-and-helpers';

interface AdminUsersSectionProps {
  filteredUsers: User[];
  me: { email: string; isFounder: boolean } | null;
  searchEmail: string;
  searchRole: string;
  resetFor: string | null;
  newPassword: string;
  onSearchEmailChange: (next: string) => void;
  onSearchRoleChange: (next: string) => void;
  onApplyFilter: () => void;
  onSetRole: (user: User, role: 'user' | 'admin') => void;
  onToggleResetFor: (email: string) => void;
  onNewPasswordChange: (next: string) => void;
  onSubmitResetPassword: (user: User) => void;
}

export const AdminUsersSection: React.FC<AdminUsersSectionProps> = ({
  filteredUsers,
  me,
  searchEmail,
  searchRole,
  resetFor,
  newPassword,
  onSearchEmailChange,
  onSearchRoleChange,
  onApplyFilter,
  onSetRole,
  onToggleResetFor,
  onNewPasswordChange,
  onSubmitResetPassword,
}) => {
  const { language, t } = useApp();

  return (
    <section className="space-y-3" aria-labelledby="users-heading">
      <h2 id="users-heading" className="font-serif text-xl text-ink">
        {t.adminAccounts}
      </h2>

      <div className="flex w-full items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-nowrap">Email:</span>
          <input
            type="email"
            name="search"
            id="search"
            value={searchEmail}
            onChange={(e) => onSearchEmailChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brass"
          />

          <span className="flex items-center gap-2 text-nowrap">{t.adminRole}</span>
          <select
            name="role"
            id="role"
            value={searchRole}
            onChange={(e) => onSearchRoleChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brass"
          >
            <option value="all">{language === 'vi' ? 'Tất cả' : 'All'}</option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label[language]}
              </option>
            ))}
          </select>
        </div>

        <button type="button" onClick={onApplyFilter} className="button-primary">
          {t.adminFilter}
        </button>
      </div>

      {filteredUsers.length === 0 && <p className="text-ink-muted">{t.adminEmptyAccounts}</p>}
      {filteredUsers.map((user) => {
        const isFounderRow = Boolean(
          me?.isFounder && me.email.toLowerCase() === user.email.toLowerCase()
        );
        const canDemote = Boolean(me?.isFounder && !isFounderRow);
        return (
          <article
            key={user.email}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 grow">
              <p className="truncate text-ink">{user.email}</p>
              <p
                className={`mt-1 text-sm ${
                  user.role === 'admin' ? 'text-brass' : 'text-ink-muted'
                }`}
              >
                {user.role}
              </p>
              {me?.isFounder && resetFor === user.email ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    className={ADMIN_FIELD_CLASS}
                    style={{ maxWidth: '16rem' }}
                    value={newPassword}
                    autoComplete="new-password"
                    placeholder={t.adminNewPassword}
                    aria-label={t.adminNewPassword}
                    onChange={(e) => onNewPasswordChange(e.target.value)}
                  />
                  <button
                    type="button"
                    className={ADMIN_PRIMARY_CLASS}
                    onClick={() => onSubmitResetPassword(user)}
                  >
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
                    className={ADMIN_BUTTON_CLASS}
                    onClick={() => onSetRole(user, 'user')}
                  >
                    {t.adminRemoveAdmin}
                  </button>
                ) : null
              ) : (
                <button
                  type="button"
                  className={ADMIN_BUTTON_CLASS}
                  onClick={() => onSetRole(user, 'admin')}
                >
                  {t.adminMakeAdmin}
                </button>
              )}
              {me?.isFounder ? (
                <button
                  type="button"
                  className={ADMIN_BUTTON_CLASS}
                  onClick={() => onToggleResetFor(user.email)}
                >
                  {t.adminResetPassword}
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
};
