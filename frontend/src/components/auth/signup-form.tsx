'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { signUp } from '@/server/auth-actions';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SignInSocial from './signin-social';

export default function SignupForm() {
  const initialState = { errorMessage: '' };
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  useEffect(() => {
    if (state.errorMessage.length) {
      toast.error(state.errorMessage);
    }
  }, [state.errorMessage]);

  useEffect(() => {
    if (confirmPassword) {
      setPasswordsMatch(password === confirmPassword);
    }
  }, [password, confirmPassword]);

  const handleSubmit = (formData: FormData) => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    formAction(formData);
  };

  return (
    <div className='w-full'>
      {/* Header */}
      <div className='mb-8'>
        <Link href='/' aria-label='go home' className='inline-block mb-6'>
          <Icons.logo className='h-8 w-8' />
        </Link>
        <h1 className='text-3xl font-bold text-foreground mb-2'>Sign Up.</h1>
        <p className='text-muted-foreground'>
          Welcome! Create an account to get started
        </p>
      </div>

      <form action={handleSubmit} className='space-y-6'>
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

        {/* Form fields */}
        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='firstname' className='text-sm font-medium'>
                First name
              </Label>
              <Input
                type='text'
                required
                name='firstname'
                id='firstname'
                placeholder='Enter your first name'
                className='h-11'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='lastname' className='text-sm font-medium'>
                Last name
              </Label>
              <Input
                type='text'
                required
                name='lastname'
                id='lastname'
                placeholder='Enter your last name'
                className='h-11'
              />
            </div>
          </div>

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
            <Label htmlFor='pwd' className='text-sm font-medium'>
              Password
            </Label>
            <Input
              type='password'
              required
              name='pwd'
              id='pwd'
              placeholder='Create a password'
              className='h-11'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='confirmPassword' className='text-sm font-medium'>
              Confirm password
            </Label>
            <Input
              type='password'
              required
              id='confirmPassword'
              placeholder='Confirm your password'
              className={`h-11 ${
                confirmPassword && !passwordsMatch
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword && !passwordsMatch && (
              <p className='text-sm text-destructive'>Passwords do not match</p>
            )}
          </div>
        </div>

        <Button
          className='w-full h-11'
          disabled={pending || (!!confirmPassword && !passwordsMatch)}
        >
          {pending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      {/* Sign in link */}
      <div className='mt-6 text-center'>
        <p className='text-sm text-muted-foreground'>
          Already have an account?{' '}
          <Button asChild variant='link' className='px-0 h-auto font-medium'>
            <Link href='/sign-in'>Sign in</Link>
          </Button>
        </p>
      </div>
    </div>
  );
}
