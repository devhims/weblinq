'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, Key, ExternalLink } from 'lucide-react';
import { setApiKeyInStorage, removeApiKeyFromStorage } from '@/lib/utils';
import { parseErrorResponse, getErrorMessage } from '@/lib/error-utils';

interface PreviewAuthModalProps {
  onAuthenticated: () => void;
}

export default function PreviewAuthModal({
  onAuthenticated,
}: PreviewAuthModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const validateAndSetApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!apiKey.startsWith('wq_')) {
      setError('API key must start with "wq_"');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Test the API key by making a simple request
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/v1/api-keys/list`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        // API key is valid, store it
        setApiKeyInStorage(apiKey);
        onAuthenticated();
      } else {
        const apiError = await parseErrorResponse(response);
        setError(`Invalid API key: ${getErrorMessage(apiError)}`);
      }
    } catch (err) {
      setError('Failed to validate API key. Please check your connection.');
    } finally {
      setIsValidating(false);
    }
  };

  const clearApiKey = () => {
    removeApiKeyFromStorage();
    setApiKey('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Key className="h-8 w-8 text-blue-500" />
          </div>
          <CardTitle className="text-xl">
            Preview Environment Authentication
          </CardTitle>
          <CardDescription className="text-sm text-left">
            You&apos;re accessing a Vercel preview deployment. Session cookies
            don&apos;t work across different domains, so please provide an API
            key for authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Studio API Key Required:</p>
                <p className="mt-1 text-xs">
                  While you can sign in with email/password for dashboard access
                  in preview mode, Studio features require an API key to connect
                  to the backend services.
                </p>
                <ol className="mt-2 list-decimal list-inside space-y-1 text-xs">
                  <li>Sign in to dashboard first (if not already signed in)</li>
                  <li>Go to Dashboard → API Keys</li>
                  <li>Create a new API key</li>
                  <li>Paste it here for Studio access</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="wq_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && validateAndSetApiKey()}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={validateAndSetApiKey}
              disabled={isValidating || !apiKey.trim()}
              className="flex-1"
            >
              {isValidating ? 'Validating...' : 'Authenticate'}
            </Button>
            <Button
              variant="outline"
              onClick={clearApiKey}
              disabled={isValidating}
            >
              Clear
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="link"
              size="sm"
              onClick={() =>
                window.open(
                  'https://www.weblinq.dev/dashboard/security',
                  '_blank',
                )
              }
              className="text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open production site to create API key
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
