'use client';

import { createClient } from '@/lib/supabase/client';
import { FormEvent, useState } from 'react';
import { useApp } from '../context/AppContext';

export const SignInView: React.FC = () => {
    const { setCurrentView } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

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
        <div className='w-full h-full'>
            <form onSubmit={handleSignIn}
            className='p-[5%] border-white border-2 flex flex-col gap-3 w-full sm:w-fit h-full'>
                <h1 className='font-serif text-4xl text-center text-brass mb-5'>Sign In</h1>

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
                    Sign In
                </button>
                
                <span className='flex gap-1.5 justify-center'>
                    Or
                    <button type='button' onClick={() => setCurrentView('sign-up')}
                    className='underline hover:text-brass hover:no-underline'>
                        Sign Up
                    </button>
                </span>

                {error && <p>{error}</p>}
            </form>
        </div>
    )
}