'use client';

import { createClient } from '@/lib/supabase/client';
import { FormEvent, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from 'lucide-react';
import { AuthShowcase } from './AuthShowcase';

export const SetPasswordView: React.FC = () => {
    const { t } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError('');

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
        password: password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    // A full navigation, not a client-side route change: the workspace reads the session on
    // mount, so only a fresh load turns the visitor into a signed-in user. Pushing a route would
    // leave the same page rendering as if nobody were logged in.
    window.location.href = '/';
  }

  return (
    <div className="grid min-h-[calc(100vh-76px)] lg:grid-cols-2">
      <AuthShowcase />
      <div className="flex flex-col justify-center px-4 py-10 sm:px-6 sm:py-14 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md space-y-7">
          <header className="page-header text-center sm:text-left">
            <p className="eyebrow justify-center sm:justify-start">
              <span className="status-dot" />
              {t.authSetPasswordEyebrow}
            </p>
            <h1>{t.authSetPasswordTitle}</h1>
            <p>{t.authSetPasswordBody}</p>
          </header>

          <form onSubmit={handleSignIn} className="panel space-y-5 p-5 sm:p-7">
            <label className="field">
              <span className="field-label">{t.authEmail}</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{ paddingLeft: '2.25rem' }}
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="field">
              <span className="field-label">{t.authPassword}</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.authYourPassword}
                  required
                  style={{ paddingLeft: '2.25rem', paddingRight: '2.75rem' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? t.authHidePassword : t.authShowPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button type="submit" className="button-primary min-h-11 w-full justify-center">
              <LogIn className="h-4 w-4" />
              {t.authSignInAction}
            </button>

            {error && <p className="field-error" role="alert">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};