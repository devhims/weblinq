'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { config } from '@/config/env';

export default function SignInSocial({
  provider,
  children,
  callbackURL,
  className,
}: {
  provider:
    | 'github'
    | 'apple'
    | 'discord'
    | 'facebook'
    | 'google'
    | 'microsoft'
    | 'spotify'
    | 'twitch'
    | 'twitter'
    | 'dropbox'
    | 'linkedin'
    | 'gitlab'
    | 'tiktok'
    | 'reddit'
    | 'roblox'
    | 'vk'
    | 'kick';
  children: React.ReactNode;
  callbackURL?: string;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialSignIn = async () => {
    try {
      setIsLoading(true);

      // Use authClient for client-side operations
      await authClient.signIn.social({
        provider,
        callbackURL: callbackURL || `${config.frontendUrl}/dashboard`,
        newUserCallbackURL: callbackURL
          ? `${callbackURL}?new_user=true`
          : `${config.frontendUrl}/dashboard?new_user=true`,
        errorCallbackURL: `${config.frontendUrl}/sign-in?error=oauth_error`,
      });
    } catch (err) {
      console.error(`${provider} sign-in error:`, err);
      setIsLoading(false);
      // Don't show error here as Better Auth will redirect to errorCallbackURL
    }
  };

  return (
    <Button
      onClick={handleSocialSignIn}
      disabled={isLoading}
      type="button"
      variant="outline"
      className={`cursor-pointer ${className || ''}`}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </Button>
  );
}
