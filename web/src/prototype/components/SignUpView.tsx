'use client';

import { createClient } from '@/lib/supabase/client';
import { FormEvent, useState } from 'react';
import { useApp } from '../context/AppContext';

export const SignUpView: React.FC = () => {
    const { setCurrentView } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    
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
        <div>
            <form onSubmit={handleSignUp}>
                <input type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='Email'
                required
                name=""
                id="" />

                <input type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Password'
                required
                name=""
                id="" />

                <button type="submit">
                    Sign Up
                </button>
                
                {message && <p>{message}</p>}
                {error && <p>{error}</p>}
            </form>

            <button type="button" onClick={() => setCurrentView('sign-in')}>Or Sign In</button>
        </div>
    )
};
