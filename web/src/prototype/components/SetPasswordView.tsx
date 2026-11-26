'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { localizeAuthError } from '../i18n';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, RefreshCw, Save } from 'lucide-react';
import { AuthShowcase } from './AuthShowcase';

export const SetPasswordView: React.FC = () => {
  const router = useRouter();
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        if (session?.user?.email) {
          setEmail(session.user.email);
        }
        setIsValidToken(true);
        setLoading(false);
      }
    });

    const timer = setTimeout(() => {
      setLoading((prevLoading) => {
        if (prevLoading) {
          setIsValidToken(false);
          return false;
        }
        return false;
      });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleNewSetPassword(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const supabase = await createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          has_password: true,
        },
      });

      if (updateError) {
        setError(localizeAuthError(updateError.message, t));
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

          {loading ? (
            <div className="panel flex flex-col items-center justify-center space-y-3 p-8 text-center">
              <RefreshCw className="h-6 w-6 animate-spin text-ink-muted" />
              <p className="text-sm text-ink-muted">{t.authValidatingLink}</p>
            </div>
          ) : !isValidToken ? (
            <div className="panel space-y-4 p-6 text-center">
              <p className="font-medium text-terracotta">{t.authInvalidTokenTitle}</p>
              <p className="text-sm text-ink-muted">{t.authInvalidTokenBody}</p>
              <a
                href="/auth"
                className="button-primary inline-flex min-h-10 w-full items-center justify-center px-4"
              >
                {t.authResendEmailAction}
              </a>
            </div>
          ) : (
            <form onSubmit={handleNewSetPassword} className="panel space-y-5 p-5 sm:p-7">
              <label className="field">
                <span className="field-label">{t.authEmail}</span>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    value={email ? email : ''}
                    placeholder={t.emailPlaceholder}
                    required
                    readOnly
                    style={{ paddingLeft: '2.25rem' }}
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="field">
                <span className="field-label">{t.authPassword}</span>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.authPasswordHint}
                    required
                    minLength={8}
                    disabled={submitting}
                    style={{ paddingLeft: '2.25rem', paddingRight: '3.5rem' }}
                    autoComplete="new-password"
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

              <button
                type="submit"
                disabled={submitting}
                className="button-primary min-h-11 w-full justify-center disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {t.authUpdatePassword}
              </button>

              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
