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
            <form onSubmit={handleSignUp}
            className='p-[5%] border-white border-2 flex flex-col gap-3 w-full sm:w-fit h-full'>
                <h1 className='font-serif text-4xl text-center text-brass mb-5'>Sign Up</h1>

                <input type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='Email'
                required
                name="email"
                id="email"
                className='border-white border-2'/>

                <input type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Password'
                required
                name="password"
                id="password"
                className='border-white border-2'/>

                <button type="submit"
                className='button-secondary mt-5'>
                    Sign Up
                </button>
                
                <span className='flex gap-1.5 justify-center'>
                    Or
                    <button type='button' onClick={() => setCurrentView('sign-in')}
                    className='underline hover:text-brass hover:no-underline'>
                        Sign In
                    </button>
                </span>
                
                {message && <p>{message}</p>}
                {error && <p>{error}</p>}
            </form>
        </div>
    )
};
