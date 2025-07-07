'use client';

import React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmailBadge } from './email-badge';

interface SignInFormData {
  password: string;
}

interface SignInFormProps {
  email: string;
  onSubmit: (data: SignInFormData) => Promise<void>;
  isLoading: boolean;
  onChangeEmail: () => void;
}

export function SignInForm({
  email,
  onSubmit,
  isLoading,
  onChangeEmail,
}: SignInFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    defaultValues: {
      password: '',
    },
    mode: 'onChange',
  });

  return (
    <div className="space-y-6">
      <EmailBadge email={email} onChangeEmail={onChangeEmail} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password" className="text-sm font-medium">
              Password
            </Label>
            <Button asChild variant="link" size="sm" className="px-0 h-auto">
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </Button>
          </div>
          <Input
            {...register('password', { required: 'Password is required' })}
            type="password"
            id="signin-password"
            placeholder="Enter your password"
            className="h-11"
            autoComplete="current-password"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button className="w-full h-11" disabled={isLoading} type="submit">
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
