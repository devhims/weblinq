'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { checkEmailExists, unifiedSignIn, unifiedSignUp } from '@/server/auth-actions';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import SignInSocial from './signin-social';

type AuthStep = 'email' | 'signin' | 'signup';

export default function UnifiedAuthForm() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(true);

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

  // Email check state
  const emailCheckInitialState = {
    errorMessage: null,
    emailExists: false,
    email: '',
  };
  const [emailCheckState, emailCheckAction, emailCheckPending] = useActionState(
    checkEmailExists,
    emailCheckInitialState,
  );

  // Sign in state
  const signInInitialState = {
    errorMessage: '',
    requiresVerification: false,
    email: '',
  };
  const [signInState, signInAction, signInPending] = useActionState(unifiedSignIn, signInInitialState);

  // Sign up state
  const signUpInitialState = { errorMessage: '' };
  const [signUpState, signUpAction, signUpPending] = useActionState(unifiedSignUp, signUpInitialState);

  // Handle email check response
  useEffect(() => {
    if (emailCheckState.errorMessage) {
      toast.error(emailCheckState.errorMessage);
    } else if (emailCheckState.email) {
      setEmail(emailCheckState.email);
      if (emailCheckState.emailExists) {
        setStep('signin');
        toast.success('Please enter your password to sign in');
      } else {
        setStep('signup');
        toast.success('This email is new! Please create your account');
      }
    }
  }, [emailCheckState]);

  // Handle sign in response
  useEffect(() => {
    if (signInState.errorMessage) {
      if (signInState.requiresVerification && signInState.email) {
        toast.error(signInState.errorMessage, {
          style: {
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            color: '#92400e',
          },
          duration: 8000, // Show longer for verification message
          action: {
            label: 'Go to Verification',
            onClick: () => {
              window.location.href = `/verify-email?email=${encodeURIComponent(signInState.email!)}`;
            },
          },
        });
      } else {
        toast.error(signInState.errorMessage, {
          style: {
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
          },
        });
      }
    }
  }, [signInState.errorMessage, signInState.requiresVerification, signInState.email]);

  // Handle sign up response
  useEffect(() => {
    if (signUpState.errorMessage) {
      toast.error(signUpState.errorMessage);
    }
  }, [signUpState.errorMessage]);

  // Check password match for sign up
  useEffect(() => {
    if (confirmPassword) {
      setPasswordsMatch(password === confirmPassword);
    }
  }, [password, confirmPassword]);

  const handleEmailSubmit = (formData: FormData) => {
    emailCheckAction(formData);
  };

  const handleSignInSubmit = (formData: FormData) => {
    formData.set('email', email);
    signInAction(formData);
  };

  const handleSignUpSubmit = (formData: FormData) => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    formData.set('email', email);
    signUpAction(formData);
  };

  const resetToEmailStep = () => {
    setStep('email');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
  };

  return (
    <div className="w-full px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
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
      </div>

      {/* Social login - show only on email step */}
      {step === 'email' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
            <SignInSocial provider="google">
              <Icons.google />
              <span className="ml-2 text-sm sm:text-base">Google</span>
            </SignInSocial>
            <SignInSocial provider="github">
              <Icons.gitHub />
              <span className="ml-2 text-sm sm:text-base">GitHub</span>
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
      )}

      {/* Email Step */}
      {step === 'email' && (
        <form action={handleEmailSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              type="email"
              required
              name="email"
              id="email"
              placeholder="Enter your email"
              className="h-11"
              disabled={emailCheckPending}
            />
          </div>

          <Button className="w-full h-11" disabled={emailCheckPending}>
            {emailCheckPending ? 'Checking...' : 'Continue with Email'}
          </Button>
        </form>
      )}

      {/* Sign In Step */}
      {step === 'signin' && (
        <div className="space-y-6">
          {/* Show email being used */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-2">
              <Icons.mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={resetToEmailStep} className="text-xs">
              Change
            </Button>
          </div>

          <form action={handleSignInSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Button asChild variant="link" size="sm" className="px-0 h-auto">
                  <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
                    Forgot password?
                  </Link>
                </Button>
              </div>
              <Input
                type="password"
                required
                name="password"
                id="password"
                placeholder="Enter your password"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={signInPending}
              />
            </div>

            <Button className="w-full h-11" disabled={signInPending}>
              {signInPending ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      )}

      {/* Sign Up Step */}
      {step === 'signup' && (
        <div className="space-y-6">
          {/* Show email being used */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-2">
              <Icons.mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={resetToEmailStep} className="text-xs">
              Change
            </Button>
          </div>

          <form action={handleSignUpSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium">
                  First name
                </Label>
                <Input
                  type="text"
                  required
                  name="firstName"
                  id="firstName"
                  placeholder="Enter your first name"
                  className="h-11"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={signUpPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Last name
                </Label>
                <Input
                  type="text"
                  required
                  name="lastName"
                  id="lastName"
                  placeholder="Enter your last name"
                  className="h-11"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={signUpPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                type="password"
                required
                name="password"
                id="password"
                placeholder="Create a password"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={signUpPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </Label>
              <Input
                type="password"
                required
                id="confirmPassword"
                placeholder="Confirm your password"
                className={`h-11 ${
                  confirmPassword && !passwordsMatch ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={signUpPending}
              />
              {confirmPassword && !passwordsMatch && <p className="text-sm text-destructive">Passwords do not match</p>}
            </div>

            <Button className="w-full h-11" disabled={signUpPending || (!!confirmPassword && !passwordsMatch)}>
              {signUpPending ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        </div>
      )}

      {/* Footer links */}
      {step !== 'email' && (
        <div className="mt-6 text-center">
          <Button
            variant="link"
            onClick={resetToEmailStep}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to email
          </Button>
        </div>
      )}
    </div>
  );
}
