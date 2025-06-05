'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createApiKey,
  listApiKeysClient as listApiKeys,
  deleteApiKey,
  type ApiKeysListResponse,
  type ApiKeyWithKey,
} from '@/lib/api-keys';
import {
  formatApiKeyDisplay,
  validateApiKeyName,
  generateKeyNameSuggestion,
  getApiKeyStatusColor,
  maskApiKey,
} from '@/lib/utils/api-key-utils';

interface ApiKeyManagerClientProps {
  initialApiKeys: ApiKeysListResponse;
  className?: string;
}

export function ApiKeyManagerClient({
  initialApiKeys,
  className = '',
}: ApiKeyManagerClientProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [nameError, setNameError] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyWithKey | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // React Query for API keys management (optimized like tasks)
  const {
    data: apiKeysResponse,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: listApiKeys,
    initialData: initialApiKeys, // Use server-side data as initial data
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // No auto-refetch on window focus
    refetchOnReconnect: false, // No auto-refetch on network reconnect
    refetchInterval: false, // No background polling
  });

  const apiKeys = apiKeysResponse?.apiKeys || [];

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: createApiKey,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['apiKeys'] });

      // Snapshot the previous value
      const previousResponse = queryClient.getQueryData<ApiKeysListResponse>([
        'apiKeys',
      ]);

      // Optimistically update (we'll show this in the created key display instead)
      // Don't add to list since API keys need to be copied before being masked

      return { previousResponse };
    },
    onError: (err, newApiKeyData, context) => {
      // Rollback on error
      queryClient.setQueryData(['apiKeys'], context?.previousResponse);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onSuccess: (createdApiKey) => {
      setCreatedKey(createdApiKey);
      setNewKeyName('');
      setNameError('');
      setShowCreateForm(false);
    },
  });

  // Delete API key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: deleteApiKey,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['apiKeys'] });

      const previousResponse = queryClient.getQueryData<ApiKeysListResponse>([
        'apiKeys',
      ]);

      // Optimistically remove from the list
      if (previousResponse) {
        queryClient.setQueryData<ApiKeysListResponse>(['apiKeys'], {
          ...previousResponse,
          apiKeys: apiKeys.filter((key) => key.id !== deletedId),
          total: Math.max(0, (previousResponse.total || apiKeys.length) - 1),
        });
      }

      return { previousResponse };
    },
    onError: (err, deletedId, context) => {
      queryClient.setQueryData(['apiKeys'], context?.previousResponse);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });

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

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation
    const validation = validateApiKeyName(newKeyName);
    if (!validation.isValid) {
      setNameError(validation.error || '');
      return;
    }

    createApiKeyMutation.mutate({
      name: newKeyName.trim(),
    });
  };

  const handleDeleteApiKey = (id: string, name: string | null) => {
    const keyName = name || 'this API key';
    if (
      !confirm(
        `Are you sure you want to delete "${keyName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    // Track which key is being deleted for optimistic UI
    setDeletingIds((prev) => new Set(prev).add(id));

    deleteApiKeyMutation.mutate(id, {
      onSettled: () => {
        // Remove from deleting set regardless of success/error
        setDeletingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      },
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here if desired
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
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

  // Show loading state if initial query is loading (shouldn't happen with initialData)
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className='text-center py-4'>Loading API keys...</div>
      </div>
    );
  }

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
              <div className='space-y-2'>
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
              </div>
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
                isLoading={createApiKeyMutation.isPending}
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

      {/* Error Messages */}
      {queryError && (
        <div className='mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm'>
          Failed to load API keys: {queryError.message}
        </div>
      )}

      {createApiKeyMutation.isError && (
        <div className='mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm'>
          {createApiKeyMutation.error.message}
        </div>
      )}

      {deleteApiKeyMutation.isError && (
        <div className='mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm'>
          Failed to delete API key: {deleteApiKeyMutation.error.message}
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
      {!apiKeys || apiKeys.length === 0 ? (
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
            {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''} total
          </div>
          {apiKeys.map((apiKey) => {
            const statusColor = getApiKeyStatusColor(
              apiKey.enabled,
              apiKey.expiresAt
            );
            const isDeleting = deletingIds.has(apiKey.id);

            return (
              <div
                key={apiKey.id}
                className={`border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                  isDeleting ? 'opacity-50' : ''
                }`}
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
                    isLoading={isDeleting}
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
    </div>
  );
}
