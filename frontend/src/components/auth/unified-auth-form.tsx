'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { userApi } from '@/lib/studio-api';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SignInSocial from './signin-social';
import { SignInForm } from './signin-form';
import { SignUpForm } from './signup-form';

type Step = 'email' | 'signin' | 'signup';

interface EmailFormData {
  email: string;
}

/* -------------------------------- helpers -------------------------------- */
function showToast(
  type: 'success' | 'error',
  message: string,
  opts?: Parameters<typeof toast.success>[1],
) {
  if (type === 'success') return toast.success(message, opts);
  toast.error(message, opts);
}

/* ------------------------------- sub‑components ------------------------------- */

const AuthHeader = ({ step }: { step: Step }) => (
  <header className="mb-6 sm:mb-8">
    <Link href="/" aria-label="go home" className="inline-block mb-6">
      <Icons.logo className="h-8 w-auto" />
    </Link>

    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
      {step === 'email' && 'Welcome.'}
      {step === 'signin' && 'Sign In.'}
      {step === 'signup' && 'Create Account.'}
    </h1>
    <p className="text-muted-foreground">
      {step === 'email' && 'Please sign in to continue'}
      {step === 'signin' && 'Welcome back! Enter your password to continue'}
      {step === 'signup' && 'Create your account to get started'}
    </p>
  </header>
);

const AuthFooter = ({ onBack }: { onBack(): void }) => (
  <div className="mt-6 text-center">
    <Button
      variant="link"
      onClick={onBack}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      ← Back to email
    </Button>
  </div>
);

const SocialButtons = () => (
  <>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
      <SignInSocial provider="google">
        <Icons.google />
        <span className="ml-2 text-sm">Google</span>
      </SignInSocial>
      <SignInSocial provider="github">
        <Icons.gitHub />
        <span className="ml-2 text-sm">GitHub</span>
      </SignInSocial>
    </div>

    <div className="relative mb-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">Or</span>
      </div>
    </div>
  </>
);

/* --------------------------------------------------------------------- */

export default function UnifiedAuthForm() {
  const [step, setStep] = useState<Step>('email');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // React Hook Form setup
  const form = useForm<EmailFormData>({
    defaultValues: {
      email: '',
    },
    mode: 'onChange',
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = form;

  // Watch form values for validation
  const email = watch('email');

  /* ------------ effects ------------ */
  // URL params success message
  useEffect(() => {
    const url = new URL(window.location.href);
    if (
      url.searchParams.get('reset') === 'success' &&
      url.searchParams.get('message')
    ) {
      showToast(
        'success',
        decodeURIComponent(url.searchParams.get('message') as string),
        {
          duration: 5000,
          style: {
            background: '#dcfce7',
            border: '1px solid #bbf7d0',
            color: '#166534',
          },
        },
      );
      window.history.replaceState({}, '', url.origin + url.pathname);
    }
  }, []);

  /* ------------ email check handler ------------ */
  const onEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);

    try {
      const result = await userApi.verifyEmail({ email: data.email });
      if (!result.success) {
        showToast('error', 'Failed to check email');
        return;
      }

      setValue('email', data.email);
      if (result.data.exists) {
        setStep('signin');
        showToast('success', 'Please enter your password to sign in');
      } else {
        setStep('signup');
        showToast('success', 'This email is new! Please create your account');
      }
    } catch (err) {
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------ sign in handler ------------ */
  const onSignInSubmit = async (data: { password: string }) => {
    setIsLoading(true);

    try {
      const { data: result, error } = await authClient.signIn.email({
        email: email,
        password: data.password,
      });

      if (error) {
        if (error.status === 403) {
          // Email verification required
          showToast(
            'error',
            error.message ||
              'Please verify your email address by clicking the link in your email',
            {
              duration: 10000,
              style: {
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                color: '#92400e',
              },
              action: {
                label: 'Resend Email',
                onClick: async () => {
                  try {
                    await authClient.sendVerificationEmail({
                      email,
                      callbackURL: `${window.location.origin}/dashboard`,
                    });
                    showToast(
                      'success',
                      'Verification email sent! Please check your inbox.',
                    );
                  } catch (err) {
                    showToast('error', 'Failed to send verification email');
                  }
                },
              },
            },
          );
        } else {
          showToast(
            'error',
            error.message || 'Invalid password. Please try again.',
          );
        }
      } else if (result) {
        showToast('success', 'Welcome back!');
        router.push('/dashboard');
      }
    } catch (err) {
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------ sign up handler ------------ */
  const onSignUpSubmit = async (data: {
    firstName: string;
    lastName: string;
    password: string;
    confirm: string;
  }) => {
    setIsLoading(true);

    try {
      const { data: result, error } = await authClient.signUp.email({
        email: email,
        password: data.password,
        name: `${data.firstName} ${data.lastName}`,
      });

      if (error) {
        if (error.message?.includes('already exists')) {
          showToast('error', 'An account with this email already exists.');
        } else {
          showToast(
            'error',
            error.message || 'Failed to create account. Please try again.',
          );
        }
      } else if (result) {
        showToast(
          'success',
          'Account created successfully! Please check your email for verification and click the link to sign in.',
          {
            duration: 8000,
            style: {
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              color: '#166534',
            },
          },
        );
        // Reset form to allow user to sign in after verification
        resetToEmailStep();
      }
    } catch (err) {
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetToEmailStep = () => {
    setStep('email');
    reset();
  };

  /* ------------ render ------------ */
  return (
    <div className="w-full px-4 sm:px-0">
      <AuthHeader step={step} />

      {/* ----- Email Step ----- */}
      {step === 'email' && (
        <>
          <SocialButtons />
          <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
                id="email"
                type="email"
                placeholder="Enter your email"
                className="h-11"
                disabled={isLoading}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <Button className="w-full h-11" disabled={isLoading} type="submit">
              {isLoading ? 'Checking...' : 'Continue with Email'}
            </Button>
          </form>
        </>
      )}

      {/* ----- Sign‑in Step ----- */}
      {step === 'signin' && (
        <SignInForm
          email={email}
          onSubmit={onSignInSubmit}
          isLoading={isLoading}
          onChangeEmail={resetToEmailStep}
        />
      )}

      {/* ----- Sign‑up Step ----- */}
      {step === 'signup' && (
        <SignUpForm
          email={email}
          onSubmit={onSignUpSubmit}
          isLoading={isLoading}
          onChangeEmail={resetToEmailStep}
        />
      )}

      {/* Footer */}
      {step !== 'email' && <AuthFooter onBack={resetToEmailStep} />}
    </div>
  );
}
