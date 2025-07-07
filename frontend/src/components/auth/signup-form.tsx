'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmailBadge } from './email-badge';
import { PasswordRequirements } from './password-requirements';
import { validatePassword } from '@/lib/utils/password-validation';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  password: string;
  confirm: string;
}

interface SignUpFormProps {
  email: string;
  onSubmit: (data: SignUpFormData) => Promise<void>;
  isLoading: boolean;
  onChangeEmail: () => void;
}

export function SignUpForm({
  email,
  onSubmit,
  isLoading,
  onChangeEmail,
}: SignUpFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      password: '',
      confirm: '',
    },
    mode: 'onChange',
  });

  // Watch form values for validation
  const password = watch('password');
  const confirm = watch('confirm');

  // Derived state
  const passwordsMatch = !confirm || password === confirm;
  const passwordValidation = validatePassword(password);
  const isPasswordValid = passwordValidation.isValid;

  return (
    <div className="space-y-6">
      <EmailBadge email={email} onChangeEmail={onChangeEmail} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-medium">
              First name
            </Label>
            <Input
              {...register('firstName', {
                required: 'First name is required',
              })}
              id="firstName"
              type="text"
              placeholder="Enter your first name"
              className="h-11"
              disabled={isLoading}
              autoComplete="given-name"
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">
                {errors.firstName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-medium">
              Last name
            </Label>
            <Input
              {...register('lastName', {
                required: 'Last name is required',
              })}
              id="lastName"
              type="text"
              placeholder="Enter your last name"
              className="h-11"
              disabled={isLoading}
              autoComplete="family-name"
            />
            {errors.lastName && (
              <p className="text-sm text-destructive">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password" className="text-sm font-medium">
            Password
          </Label>
          <Input
            {...register('password', {
              required: 'Password is required',
              validate: (value) => {
                const validation = validatePassword(value);
                return validation.isValid || validation.errors.join(' ');
              },
            })}
            id="signup-password"
            type="password"
            placeholder="Create a password"
            className="h-11"
            disabled={isLoading}
            autoComplete="new-password"
          />
          {password && (
            <PasswordRequirements password={password} className="mt-2" />
          )}
          {errors.password && (
            <p className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm password
          </Label>
          <Input
            {...register('confirm', {
              required: 'Please confirm your password',
              validate: (value) => {
                return value === password || 'Passwords do not match';
              },
            })}
            type="password"
            id="confirmPassword"
            placeholder="Confirm your password"
            className={`h-11 ${
              confirm && !passwordsMatch
                ? 'border-destructive focus-visible:ring-destructive'
                : ''
            }`}
            autoComplete="new-password"
            disabled={isLoading}
          />
          {errors.confirm && (
            <p className="text-sm text-destructive">{errors.confirm.message}</p>
          )}
        </div>

        <Button
          className="w-full h-11"
          disabled={isLoading || !isPasswordValid || !passwordsMatch}
          type="submit"
        >
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>
    </div>
  );
}
