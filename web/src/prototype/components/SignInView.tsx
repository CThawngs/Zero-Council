'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useApp } from '../context/AppContext';
import { localizeAuthError } from '../i18n';
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, LogIn, Mail } from 'lucide-react';
import { AuthShowcase } from './AuthShowcase';

export const SignInView: React.FC = () => {
  const router = useRouter();
  const { setCurrentView, t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const anyBusy = submitting || oauthBusy || resetBusy;

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    if (anyBusy) return;
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const supabase = await createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(localizeAuthError(signInError.message, t));
        setSubmitting(false);
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError(t.authGenericError);
      setSubmitting(false);
    }
  }

  const oauth = async (provider: 'google') => {
    if (anyBusy) return;
    setError('');
    setMessage('');
    setOauthBusy(true);
    try {
      const supabase = await createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (oauthError) {
        setError(localizeAuthError(oauthError.message, t));
        setOauthBusy(false);
      }
    } catch {
      setError(t.authGenericError);
      setOauthBusy(false);
    }
  };

  async function resetPassword() {
    if (anyBusy) return;
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError(t.authEmailRequiredError);
      return;
    }

    setResetBusy(true);
    try {
      const checked = await fetch(
        `/api/auth/check-account?email=${encodeURIComponent(email.trim().toLowerCase())}`
      );
      const body = (await checked.json().catch(() => null)) as { exists?: boolean } | null;
      if (!checked.ok || !body?.exists) {
        setError(t.authAccountNotFound);
        return;
      }

      const supabase = await createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth?reset=1')}`,
      });

      if (resetError) {
        setError(localizeAuthError(resetError.message, t));
        return;
      }

      setMessage(t.authResetSent);
    } catch {
      setError(t.authGenericError);
    } finally {
      setResetBusy(false);
    }
  }

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
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  required
                  disabled={anyBusy}
                  style={{ paddingLeft: '2.25rem' }}
                  autoComplete="email"
                />
              </div>
            </label>

            <div className="field">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="signin-password" className="field-label">
                  {t.authPassword}
                </label>

                <button
                  type="button"
                  onClick={() => void resetPassword()}
                  disabled={anyBusy}
                  className="inline-flex max-w-fit items-center gap-1.5 field-label text-brass! hover:underline disabled:opacity-50"
                >
                  {resetBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                  {t.authForgotPasswordLink}
                </button>
              </div>

              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.authYourPassword}
                  required
                  disabled={anyBusy}
                  style={{ paddingLeft: '2.25rem', paddingRight: '3.5rem' }}
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
            </div>

            <button
              type="submit"
              disabled={anyBusy}
              className="button-primary min-h-11 w-full justify-center disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? t.authSignInPending : t.authSignInAction}
            </button>

            {message && (
              <div className="flex gap-3 rounded-lg border border-sage/40 bg-sage/10 p-4 text-sm leading-relaxed text-ink">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
                <span>{message}</span>
              </div>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
              <span className="h-px flex-1 bg-border" />
              {t.authOrContinueWith}
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => void oauth('google')}
              disabled={anyBusy}
              className="button-secondary min-h-11 w-full justify-center disabled:opacity-60"
            >
              {oauthBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.93.46 3.76 1.27 5.39l4-3.11Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
                  />
                </svg>
              )}
              {t.authContinueGoogle}
            </button>
          </form>

          <p className="text-center text-sm text-ink-muted">
            <button
              type="button"
              onClick={() => setCurrentView('sign-up')}
              disabled={anyBusy}
              className="font-medium text-brass hover:underline disabled:opacity-50"
            >
              {t.authOrSignUp}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
