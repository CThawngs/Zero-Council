'use client';

import { createClient } from '@/lib/supabase/client';
import { FormEvent, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, UserPlus } from 'lucide-react';

export const SignUpView: React.FC = () => {
    const { setCurrentView } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    async function handleSignUp(event: FormEvent) {
        event.preventDefault();

        setError('');
        setMessage('');

        const supabase = await createClient();

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo:
                `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            setError(error.message);
            return;
        }

        setMessage(
            'Check your email for confirmation form.'
        );
    }

    return (
        <div className="content-shell flex max-w-md flex-col justify-center space-y-7 py-10 sm:py-14">
            <header className="page-header text-center sm:text-left">
                <p className="eyebrow justify-center sm:justify-start">
                    <span className="status-dot" />
                    Create account
                </p>
                <h1>Set up your council</h1>
                <p>Create an account to start configuring advisors.</p>
            </header>

            <form onSubmit={handleSignUp} className="panel space-y-5 p-5 sm:p-7">
                <label className="field">
                    <span className="field-label">Email</span>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                        <input type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        style={{ paddingLeft: '2.25rem' }}
                        autoComplete="email" />
                    </div>
                </label>

                <label className="field">
                    <span className="field-label">Password</span>
                    <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                        <input type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        style={{ paddingLeft: '2.25rem', paddingRight: '2.75rem' }}
                        autoComplete="new-password" />
                        <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </label>

                <button type="submit" className="button-primary min-h-11 w-full justify-center">
                    <UserPlus className="h-4 w-4" />
                    Sign Up
                </button>

                {message && (
                    <div className="flex gap-3 rounded-lg border border-sage/40 bg-sage/10 p-4 text-sm leading-relaxed text-ink">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
                        <span>{message}</span>
                    </div>
                )}
                {error && <p className="field-error" role="alert">{error}</p>}
            </form>

            <p className="text-center text-sm text-ink-muted">
                <button type="button" onClick={() => setCurrentView('sign-in')} className="font-medium text-brass hover:underline">Or Sign In</button>
            </p>
        </div>
    )
};
