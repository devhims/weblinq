'use client';

import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { getCallbackURL } from '@/lib/utils';
import { useState } from 'react';

interface SocialLoginProps {
  callbackURL?: string;
  className?: string;
}

export function SocialLogin({ callbackURL, className }: SocialLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await signIn.social({
        provider: 'github',
        callbackURL: callbackURL || getCallbackURL('/dashboard'),
      });
    } catch (err) {
      console.error('GitHub sign-in error:', err);
      setError('Failed to sign in with GitHub. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      {error && (
        <div className='mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md'>
          {error}
        </div>
      )}

      <Button
        onClick={handleGitHubSignIn}
        disabled={isLoading}
        variant='outline'
        className='w-full flex items-center justify-center gap-3 py-3 text-gray-700 hover:text-gray-900'
      >
        {isLoading ? (
          <div className='w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin' />
        ) : (
          <svg
            className='w-5 h-5'
            fill='currentColor'
            viewBox='0 0 20 20'
            aria-hidden='true'
          >
            <path
              fillRule='evenodd'
              d='M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z'
              clipRule='evenodd'
            />
          </svg>
        )}
        {isLoading ? 'Signing in...' : 'Continue with GitHub'}
      </Button>
    </div>
  );
}
