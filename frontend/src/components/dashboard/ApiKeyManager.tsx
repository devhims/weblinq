'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiKeyService, type ApiKey, type ApiKeyWithKey } from '@/lib/api-keys';
import {
  formatApiKeyDisplay,
  validateApiKeyName,
  generateKeyNameSuggestion,
  getApiKeyStatusColor,
  maskApiKey,
} from '@/lib/utils/api-key-utils';

interface ApiKeyManagerProps {
  className?: string;
}

export function ApiKeyManager({ className = '' }: ApiKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyWithKey | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [nameError, setNameError] = useState('');

  // Load API keys on component mount
  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await apiKeyService.listApiKeys();

      // Defensive programming: ensure apiKeys is always an array
      const apiKeys = Array.isArray(response?.apiKeys) ? response.apiKeys : [];
      setApiKeys(apiKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
      // Ensure apiKeys remains an array even on error
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (value: string) => {
    setNewKeyName(value);
    setNameError('');

    // Validate on change
    const validation = validateApiKeyName(value);
    if (!validation.isValid && value.trim()) {
      setNameError(validation.error || '');
    }
  };

  const generateSuggestion = () => {
    const suggestion = generateKeyNameSuggestion();
    setNewKeyName(suggestion);
    setNameError('');
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation
    const validation = validateApiKeyName(newKeyName);
    if (!validation.isValid) {
      setNameError(validation.error || '');
      return;
    }

    try {
      setIsCreating(true);
      setError('');
      setSuccess('');

      const newApiKey = await apiKeyService.createApiKey({
        name: newKeyName.trim(),
      });
      setCreatedKey(newApiKey);
      setSuccess(
        'API key created successfully! Please copy it now - it won&apos;t be shown again.'
      );
      setNewKeyName('');
      setShowCreateForm(false);

      // Reload the API keys list
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteApiKey = async (id: string, name: string | null) => {
    const keyName = name || 'this API key';
    if (
      !confirm(
        `Are you sure you want to delete "${keyName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeletingIds((prev) => new Set(prev).add(id));
      setError('');

      await apiKeyService.deleteApiKey(id);
      setSuccess(`API key "${keyName}" deleted successfully`);

      // Reload the API keys list
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('API key copied to clipboard!');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h3 className='text-lg font-semibold text-gray-900'>API Keys</h3>
          <p className='text-sm text-gray-600 mt-1'>
            Manage your API keys to access our services programmatically
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={isLoading}
        >
          {showCreateForm ? 'Cancel' : 'Create New Key'}
        </Button>
      </div>

      {/* Create API Key Form */}
      {showCreateForm && (
        <div className='mb-6 p-4 bg-gray-50 rounded-lg border'>
          <h4 className='font-medium text-gray-900 mb-4'>Create New API Key</h4>
          <form onSubmit={handleCreateApiKey} className='space-y-4'>
            <div>
              <Input
                label='Key Name'
                type='text'
                value={newKeyName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder='Enter a descriptive name for your API key'
                required
                error={nameError}
                helperText='Give your API key a memorable name to identify its purpose'
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={generateSuggestion}
                className='mt-2'
              >
                💡 Generate suggestion
              </Button>
            </div>

            <div className='bg-blue-50 border border-blue-200 rounded-md p-3'>
              <h5 className='text-sm font-medium text-blue-900 mb-1'>
                Default Settings
              </h5>
              <ul className='text-xs text-blue-700 space-y-1'>
                <li>• Prefix: wq_</li>
                <li>• Rate limit: 1000 requests per 24 hours</li>
                <li>• No expiration date</li>
                <li>• Free plan metadata</li>
              </ul>
            </div>

            <div className='flex space-x-3'>
              <Button
                type='submit'
                isLoading={isCreating}
                disabled={!newKeyName.trim() || !!nameError}
              >
                Create API Key
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                  setNameError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Success/Error Messages */}
      {error && (
        <div className='mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm'>
          {error}
        </div>
      )}

      {success && (
        <div className='mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm'>
          {success}
        </div>
      )}

      {/* New API Key Display */}
      {createdKey && (
        <div className='mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
          <h4 className='font-semibold text-blue-900 mb-2'>
            🎉 Your New API Key
          </h4>
          <p className='text-sm text-blue-700 mb-3'>
            Please copy your API key now. For security reasons, it won&apos;t be
            shown again.
          </p>
          <div className='space-y-3'>
            <div>
              <label className='block text-xs font-medium text-blue-900 mb-1'>
                Full API Key
              </label>
              <div className='flex items-center space-x-2 bg-white p-3 rounded border'>
                <code className='flex-1 text-sm font-mono text-gray-800 break-all'>
                  {createdKey.key}
                </code>
                <Button
                  size='sm'
                  onClick={() => copyToClipboard(createdKey.key)}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div>
              <label className='block text-xs font-medium text-blue-900 mb-1'>
                Masked Preview
              </label>
              <code className='block text-sm font-mono text-gray-600 bg-white p-2 rounded border'>
                {maskApiKey(createdKey.key)}
              </code>
            </div>
          </div>
          <Button
            className='mt-3'
            variant='outline'
            size='sm'
            onClick={() => setCreatedKey(null)}
          >
            I&apos;ve copied the key
          </Button>
        </div>
      )}

      {/* API Keys List */}
      {isLoading ? (
        <div className='flex justify-center py-8'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
        </div>
      ) : !apiKeys || apiKeys.length === 0 ? (
        <div className='text-center py-8 text-gray-500'>
          <div className='text-4xl mb-4'>🔑</div>
          <p className='text-lg font-medium mb-2'>No API keys found</p>
          <p className='text-sm'>
            Create your first API key to get started with our API.
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          <div className='text-sm text-gray-600 mb-4'>
            {(apiKeys || []).length} API key
            {(apiKeys || []).length !== 1 ? 's' : ''} total
          </div>
          {(apiKeys || []).map((apiKey) => {
            const statusColor = getApiKeyStatusColor(
              apiKey.enabled,
              apiKey.expiresAt
            );

            return (
              <div
                key={apiKey.id}
                className='border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors'
              >
                <div className='flex justify-between items-start'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center space-x-3 mb-2'>
                      <h4 className='font-medium text-gray-900 truncate'>
                        {apiKey.name || 'Unnamed Key'}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                      >
                        {statusColor.status}
                      </span>
                    </div>

                    <div className='text-sm text-gray-600 space-y-2'>
                      <div>
                        <strong>Key:</strong>{' '}
                        <code className='text-xs bg-gray-100 px-2 py-1 rounded'>
                          {formatApiKeyDisplay(apiKey.prefix, apiKey.start)}
                        </code>
                      </div>

                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1'>
                        <div>
                          <strong>Requests:</strong>{' '}
                          {apiKey.requestCount.toLocaleString()}
                        </div>
                        <div>
                          <strong>Remaining:</strong>{' '}
                          {apiKey.remaining?.toLocaleString() ?? 'Unlimited'}
                        </div>
                        <div>
                          <strong>Last Used:</strong>{' '}
                          {formatDate(apiKey.lastRequest)}
                        </div>
                        <div>
                          <strong>Created:</strong>{' '}
                          {formatDate(apiKey.createdAt)}
                        </div>
                      </div>

                      {apiKey.expiresAt && (
                        <div>
                          <strong>Expires:</strong>{' '}
                          {formatDate(apiKey.expiresAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                    isLoading={deletingIds.has(apiKey.id)}
                    className='text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 ml-4'
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Refresh Button */}
      <div className='mt-6 flex justify-center'>
        <Button variant='outline' onClick={loadApiKeys} isLoading={isLoading}>
          🔄 Refresh
        </Button>
      </div>
    </div>
  );
}
