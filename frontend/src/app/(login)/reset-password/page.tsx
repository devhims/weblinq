'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { resetPassword } from '@/server/auth-actions';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import { validatePassword } from '@/lib/utils/password-validation';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  // Password validation
  const passwordValidation = validatePassword(password);
  const isPasswordValid = passwordValidation.isValid;

  const initialState = { errorMessage: '' };
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialState,
  );

  // Check password match
  useEffect(() => {
    if (confirmPassword) {
      setPasswordsMatch(password === confirmPassword);
    }
  }, [password, confirmPassword]);

  // Handle form response
  useEffect(() => {
    if (state.errorMessage) {
      toast.error(state.errorMessage, {
        style: {
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        },
      });
    }
  }, [state.errorMessage]);

  const handleSubmit = (formData: FormData) => {
    if (!token) {
      toast.error('Invalid reset token', {
        style: {
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        },
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match', {
        style: {
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        },
      });
      return;
    }

    if (!isPasswordValid) {
      toast.error(passwordValidation.errors.join(' '), {
        style: {
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        },
      });
      return;
    }

    formData.set('token', token);
    formData.set('newPassword', password);
    formAction(formData);
  };

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8 text-center">
          <Link href="/" aria-label="go home" className="inline-block mb-6">
            <Icons.logo className="h-8 w-auto" />
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Invalid Reset Link
          </h1>
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <Icons.alertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Link Not Valid</h3>
          </div>
          <p className="text-sm text-red-800">
            This could happen if the link has expired or has already been used.
            Password reset links are only valid for 1 hour.
          </p>
        </div>

        <div className="text-center space-y-4">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request New Reset Link</Link>
          </Button>

          <p className="text-sm text-muted-foreground">
            Or{' '}
            <Link href="/sign-in" className="text-primary hover:underline">
              try signing in again
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <Link href="/" aria-label="go home" className="inline-block mb-6">
          <Icons.logo className="h-8 w-auto" />
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Set New Password
        </h1>
        <p className="text-muted-foreground">
          Enter a new password for your account
        </p>
      </div>

      {/* Form */}
      <form action={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            New Password
          </Label>
          <Input
            type="password"
            required
            name="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your new password"
            className="h-11"
            disabled={pending}
            autoComplete="new-password"
            minLength={8}
          />
          {password && (
            <PasswordRequirements password={password} className="mt-2" />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm New Password
          </Label>
          <Input
            type="password"
            required
            name="confirmPassword"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            className={`h-11 ${
              !passwordsMatch && confirmPassword ? 'border-red-500' : ''
            }`}
            disabled={pending}
            autoComplete="new-password"
            minLength={8}
          />
          {!passwordsMatch && confirmPassword && (
            <p className="text-xs text-red-600">Passwords do not match</p>
          )}
        </div>

        <Button
          className="w-full h-11"
          disabled={
            pending ||
            !password ||
            !confirmPassword ||
            !passwordsMatch ||
            !isPasswordValid
          }
        >
          {pending ? 'Setting Password...' : 'Set New Password'}
        </Button>
      </form>

      {/* Security info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Security Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Use a unique password you don&apos;t use elsewhere</li>
          <li>Include a mix of letters, numbers, and symbols</li>
          <li>Make it at least 8 characters long</li>
          <li>Consider using a password manager</li>
        </ul>
      </div>

      {/* Footer links */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8 text-center">
            <Icons.logo className="h-8 w-auto mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Loading...
            </h1>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
