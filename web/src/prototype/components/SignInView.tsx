import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, Mail } from 'lucide-react';

export const SignInView: React.FC = () => {
  const { setCurrentView, showToast, language } = useApp();
  const [email, setEmail] = useState('');

  const handleGoogleSignIn = () => {
    showToast(
      language === 'vi'
        ? 'Mô phỏng Google OAuth; chưa có tài khoản được tạo.'
        : 'Mock Google OAuth; no account was created.'
    );
    setCurrentView('empty-chamber');
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    showToast(
      language === 'vi'
        ? 'Email chỉ dùng cho mô phỏng; không có liên kết bảo mật nào được gửi.'
        : 'Email is used only by this mock; no security email was sent.'
    );
    setCurrentView('empty-chamber');
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg shadow-xl p-6 sm:p-8 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brass/15 text-brass border border-brass/30 mb-1">
            <div className="w-3 h-3 rounded-full bg-brass" />
          </div>
          <h2 className="font-serif text-2xl text-ink font-normal">Enter the Chamber</h2>
          <p className="text-xs text-ink-muted">
            Preview a multi-model decision interface. This build has no connected account or intelligence service.
          </p>
        </div>

        {/* Continue with Google (Real 4-color Google G logo) */}
        <button
          onClick={handleGoogleSignIn}
          type="button"
          className="w-full py-3 px-4 rounded-md bg-background border border-border hover:bg-surface text-xs font-medium text-ink transition-colors flex items-center justify-center gap-3 shadow-xs"
        >
          {/* Authentic 4-color Google G SVG mark */}
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.25 21.37 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.43l4.02-3.14z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.63 1.26 6.57l4.02 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>Simulate Google sign-in</span>
        </button>

        {/* Separator */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-border" />
          <span className="absolute px-3 bg-surface text-[11px] text-ink-muted">
            or preview email flow
          </span>
        </div>

        {/* Email Magic Link Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="mock-email" className="block text-xs font-medium text-ink-muted mb-1.5">
              Sample Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="mock-email"
                name="mock-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sample.operator@example.test"
                className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md text-xs text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-brass transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-md bg-brass hover:bg-brass/90 text-background font-medium text-xs transition-colors shadow-xs"
          >
            Simulate Email Sign-in
          </button>
        </form>

        {/* Privacy Note */}
        <div className="p-3 rounded-md bg-background/60 border border-border space-y-1.5 text-left">
          <div className="flex items-center gap-1.5 text-xs text-ink font-medium">
            <Lock className="w-3.5 h-3.5 text-sage" />
            <span>Mock Account Boundary</span>
          </div>
          <p className="text-[11px] text-ink-muted leading-relaxed">
            UI-only mock. No identity, email, session, or deliberation data is sent or persisted.
          </p>
        </div>

        {/* Quick Guest Bypass for review */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setCurrentView('empty-chamber')}
            className="text-[11px] text-ink-muted hover:text-ink transition-colors underline"
          >
            Enter Mock Chamber as Guest
          </button>
        </div>
      </div>
    </div>
  );
};
