'use client';

import { signIn } from '@/server/auth-actions';
import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { Icons } from '@/components/icons';
import SignInSocial from './signin-social';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SignInForm() {
  const initialState = {
    errorMessage: '',
    requiresVerification: false,
    email: '',
  };
  const [state, formAction, pending] = useActionState(signIn, initialState);

  // Check for success messages from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetSuccess = urlParams.get('reset');
    const message = urlParams.get('message');

    if (resetSuccess === 'success' && message) {
      toast.success(decodeURIComponent(message), {
        style: {
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#166534',
        },
        duration: 5000, // Show for 5 seconds
      });

      // Clean up URL params
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  useEffect(() => {
    if (state.errorMessage) {
      if (state.requiresVerification && state.email) {
        toast.error(state.errorMessage, {
          style: {
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            color: '#92400e',
          },
          duration: 8000, // Show longer for verification message
          action: {
            label: 'Go to Verification',
            onClick: () => {
              window.location.href = `/verify-email?email=${encodeURIComponent(
                state.email!
              )}`;
            },
          },
        });
      } else {
        toast.error(state.errorMessage, {
          style: {
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
          },
        });
      }
    }
  }, [state.errorMessage, state.requiresVerification, state.email]);

  return (
    <div className='w-full'>
      {/* Header */}
      <div className='mb-8'>
        <Link href='/' aria-label='go home' className='inline-block mb-6'>
          <Icons.logo className='h-8 w-auto' />
        </Link>
        <h1 className='text-3xl font-bold text-foreground mb-2'>Sign In.</h1>
        <p className='text-muted-foreground'>
          Welcome back! Sign in to continue
        </p>
      </div>

      <form action={formAction} className='space-y-6'>
        {/* Social login */}
        <div className='grid grid-cols-2 gap-3'>
          <SignInSocial provider='google'>
            <Icons.google />
            <span className='ml-2'>Google</span>
          </SignInSocial>
          <SignInSocial provider='github'>
            <Icons.gitHub />
            <span className='ml-2'>GitHub</span>
          </SignInSocial>
        </div>

        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background px-2 text-muted-foreground'>
              Or continue with
            </span>
          </div>
        </div>

        {/* Email/Password form */}
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='email' className='text-sm font-medium'>
              Email
            </Label>
            <Input
              type='email'
              required
              name='email'
              id='email'
              placeholder='Enter your email'
              className='h-11'
            />
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='pwd' className='text-sm font-medium'>
                Password
              </Label>
              <Button asChild variant='link' size='sm' className='px-0 h-auto'>
                <Link
                  href='/forgot-password'
                  className='text-sm text-muted-foreground hover:text-foreground'
                >
                  Forgot password?
                </Link>
              </Button>
            </div>
            <Input
              type='password'
              required
              name='pwd'
              id='pwd'
              placeholder='Enter your password'
              className='h-11'
            />
          </div>
        </div>

        <Button className='w-full h-11' disabled={pending}>
          {pending ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      {/* Sign up link */}
      <div className='mt-6 text-center'>
        <p className='text-sm text-muted-foreground'>
          Don&apos;t have an account?{' '}
          <Button asChild variant='link' className='px-0 h-auto font-medium'>
            <Link href='/sign-up'>Create account</Link>
          </Button>
        </p>
      </div>
    </div>
  );
}
