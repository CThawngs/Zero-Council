'use client';

import { createClient } from '@/lib/supabase/client';
import { FormEvent, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from 'lucide-react';
import { AuthShowcase } from './AuthShowcase';

export const SignInView: React.FC = () => {
  const { setCurrentView, t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError('');

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      return;
    }

    // A full navigation, not a client-side route change: the workspace reads the session on
    // mount, so only a fresh load turns the visitor into a signed-in user. Pushing a route would
    // leave the same page rendering as if nobody were logged in.
    window.location.href = '/';
  }

  const oauth = async (provider: 'google' | 'discord') => {
    setError('');
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    // On success Supabase redirects the browser to the provider and back to /auth/callback,
    // so there is nothing else to do here.
  };

  return (
    <div className="grid min-h-[calc(100vh-76px)] lg:grid-cols-2">
      <AuthShowcase />
      <div className="flex flex-col justify-center px-4 py-10 sm:px-6 sm:py-14 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md space-y-7">
          <header className="page-header text-center sm:text-left">
            <p className="eyebrow justify-center sm:justify-start">
              <span className="status-dot" />
              {t.authSignInEyebrow}
            </p>
            <h1>{t.authSignInTitle}</h1>
            <p>{t.authSignInBody}</p>
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

            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
              <span className="h-px flex-1 bg-border" />
              {t.authOrContinueWith}
              <span className="h-px flex-1 bg-border" />
            </div>

            <button type="button" onClick={() => oauth('google')} className="button-secondary min-h-11 w-full justify-center">
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.93.46 3.76 1.27 5.39l4-3.11Z" />
                <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
              </svg>
              {t.authContinueGoogle}
            </button>

            <button type="button" onClick={() => oauth('discord')} className="button-secondary min-h-11 w-full justify-center">
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#5865F2" d="M20.32 5.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.45.86-.61 1.25a18.3 18.3 0 0 0-5.48 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04c-1.71.29-3.35.8-4.89 1.52a.07.07 0 0 0-.03.03C.53 9.05-.32 12.62.1 16.15a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1 0-.13l1.87-.89a.08.08 0 0 0 .04.11c.37.7.78 1.36 1.23 2a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-4.08-.63-7.62-2.68-10.75a.06.06 0 0 0-.03-.03ZM8.02 14c-.9 0-1.63-.82-1.63-1.84 0-1.01.72-1.84 1.63-1.84.92 0 1.65.83 1.64 1.84 0 1.02-.72 1.84-1.64 1.84Zm7.97 0c-.9 0-1.63-.82-1.63-1.84 0-1.01.72-1.84 1.63-1.84.92 0 1.65.83 1.64 1.84 0 1.02-.71 1.84-1.64 1.84Z" />
              </svg>
              {t.authContinueDiscord}
            </button>
          </form>

          <p className="text-center text-sm text-ink-muted">
            <button type="button" onClick={() => setCurrentView('sign-up')} className="font-medium text-brass hover:underline">
              {t.authOrSignUp}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};