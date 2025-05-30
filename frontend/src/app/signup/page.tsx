'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SocialLogin } from '@/components/auth/SocialLogin';
import { signUp } from '@/lib/auth-client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error } = await signUp.email(
        { email, password, name },
        {
          onSuccess: () => {
            router.push('/dashboard');
          },
          onError: (ctx) => {
            setError(ctx.error.message || 'Sign up failed');
          },
        }
      );

      if (error) {
        setError(error.message || 'Sign up failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Create your account
          </h2>
          <p className='mt-2 text-center text-sm text-gray-600'>
            Or{' '}
            <Link
              href='/login'
              className='font-medium text-blue-600 hover:text-blue-500'
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        <div className='mt-8'>
          <SocialLogin />
        </div>

        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-t border-gray-300' />
          </div>
          <div className='relative flex justify-center text-sm'>
            <span className='px-2 bg-gray-50 text-gray-500'>
              Or continue with email
            </span>
          </div>
        </div>

        <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
          <div className='space-y-4'>
            <Input
              label='Full name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder='Enter your full name'
              autoComplete='name'
            />

            <Input
              label='Email address'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder='Enter your email'
              autoComplete='email'
            />

            <Input
              label='Password'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder='Enter your password'
              autoComplete='new-password'
              minLength={6}
            />
          </div>

          {error && (
            <div className='bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm'>
              {error}
            </div>
          )}

          <div>
            <Button
              type='submit'
              className='w-full'
              isLoading={isLoading}
              disabled={!email || !password || !name}
            >
              Create account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
