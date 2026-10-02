'use client';

import { createClient } from '@/lib/supabase/client';
import { FormEvent, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Eye, EyeOff, LockKeyhole, LogIn, Mail } from 'lucide-react';

export const SignInView: React.FC = () => {
    const { setCurrentView } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    async function handleSignIn(event: FormEvent) {
        event.preventDefault();

        setError('');

        const supabase = await createClient();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            return;
        }

        window.location.href = '/';
    }

    return (
        <div className="content-shell flex max-w-md flex-col justify-center space-y-7 py-10 sm:py-14">
            <header className="page-header text-center sm:text-left">
                <p className="eyebrow justify-center sm:justify-start">
                    <span className="status-dot" />
                    Sign in
                </p>
                <h1>Welcome back</h1>
                <p>Sign in to access your council workspace.</p>
            </header>

            <form onSubmit={handleSignIn} className="panel space-y-5 p-5 sm:p-7">
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
                        placeholder="Your password"
                        required
                        style={{ paddingLeft: '2.25rem', paddingRight: '2.75rem' }}
                        autoComplete="current-password" />
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
                    <LogIn className="h-4 w-4" />
                    Sign In
                </button>

                {error && <p className="field-error" role="alert">{error}</p>}
            </form>

            <p className="text-center text-sm text-ink-muted">
                <button type="button" onClick={() => setCurrentView('sign-up')} className="font-medium text-brass hover:underline">Or Sign Up</button>
            </p>
        </div>
    )
}
