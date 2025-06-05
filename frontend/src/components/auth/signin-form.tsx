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
  const initialState = { errorMessage: '' };
  const [state, formAction, pending] = useActionState(signIn, initialState);

  useEffect(() => {
    if (state.errorMessage.length) {
      toast.error(state.errorMessage);
    }
  }, [state.errorMessage]);

  return (
    <div className='w-full'>
      {/* Header */}
      <div className='mb-8'>
        <Link href='/' aria-label='go home' className='inline-block mb-6'>
          <Icons.logo className='h-8 w-8' />
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
                  href='/sign-in/forgot-account'
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
