'use client'

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Globe2, RefreshCw } from 'lucide-react';
import { AppProvider, useApp } from '@/prototype/context/AppContext';

interface AuthErrorInfo {
  error: string;
  errorCode: string;
  errorDescription: string;
}

function cleanParam(value: string | null | undefined): string | null {
  if (!value) return null;
  let decoded = value.replace(/\+/g, ' ');
  try {
    decoded = decodeURIComponent(decoded);
    // Decode twice if still URL-encoded (e.g. %253A -> %3A -> :)
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // Return decoded so far if decodeURIComponent fails
  }
  return decoded;
}

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const { t, language, setLanguage } = useApp();
  const [mounted, setMounted] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo>({
    error: '',
    errorCode: '',
    errorDescription: '',
  });

  useEffect(() => {
    setMounted(true);

    // 1. Check search query params (?error=... or ?code=...)
    let err = searchParams.get('error');
    let code = searchParams.get('error_code') || searchParams.get('code');
    let desc = searchParams.get('error_description') || searchParams.get('message');

    // 2. Check hash fragment (#error=...&error_code=...&error_description=...)
    if (typeof window !== 'undefined' && window.location.hash) {
      const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(rawHash);

      err = hashParams.get('error') || err;
      code = hashParams.get('error_code') || hashParams.get('code') || code;
      desc = hashParams.get('error_description') || hashParams.get('message') || desc;
    }

    setErrorInfo({
      error: cleanParam(err) || t.authErrorDefaultMessage,
      errorCode: cleanParam(code) || 'unexpected_failure',
      errorDescription: cleanParam(desc) || t.authErrorDefaultDesc,
    });
  }, [searchParams, t]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'vi' : 'en');
  };

  if (!mounted) {
    return <AuthCodeErrorFallback />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="panel w-full max-w-lg space-y-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-ink">{t.authErrorTitle}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {t.authErrorSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLanguage}
            className="language-toggle inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brass/60 hover:text-ink"
            aria-label={language === 'en' ? t.switchToVietnamese : t.switchToEnglish}
          >
            <Globe2 className="h-3.5 w-3.5 text-brass" />
            <span>{language === 'en' ? 'VI' : 'EN'}</span>
          </button>
        </div>

        <div className="space-y-3 rounded-lg border border-border/80 bg-surface/60 p-4 text-sm">
          <div>
            <span className="font-semibold text-ink-muted">{t.authErrorLabel}</span>
            <span className="font-mono text-ink">{errorInfo.error || t.authErrorLoading}</span>
          </div>
          <div>
            <span className="font-semibold text-ink-muted">{t.authErrorCodeLabel}</span>
            <span className="font-mono text-ink">{errorInfo.errorCode || t.authErrorLoading}</span>
          </div>
          <div>
            <span className="font-semibold text-ink-muted">{t.authErrorDetailsLabel}</span>
            <span className="text-ink break-words">{errorInfo.errorDescription || t.authErrorLoading}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Link
            href="/auth"
            className="button-primary inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t.authErrorTryAgain}
          </Link>
          <Link
            href="/"
            className="button-secondary inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.authErrorBackHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuthCodeErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-ink">
      <p className="text-sm text-ink-muted">Loading...</p>
    </div>
  );
}

export default function AuthCodeError() {
  return (
    <AppProvider>
      <Suspense fallback={<AuthCodeErrorFallback />}>
        <AuthCodeErrorContent />
      </Suspense>
    </AppProvider>
  );
}