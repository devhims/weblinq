'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import {
  createApiKey,
  listApiKeysClient,
  deleteApiKey,
  type ApiKeysListResponse,
  type ApiKeyWithKey,
} from '@/lib/api-keys';
import { formatApiKeyDisplay, validateApiKeyName, getApiKeyStatusColor } from '@/lib/utils/api-key-utils';
import { isVercelPreview } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';

interface ApiKeyManagerPromiseClientProps {
  apiKeysPromise: Promise<ApiKeysListResponse>;
  className?: string;
}

export function ApiKeyManagerPromiseClient({ apiKeysPromise, className = '' }: ApiKeyManagerPromiseClientProps) {
  // Use React's 'use' hook to consume the promise (Next.js 15 pattern)
  const initialApiKeys = use(apiKeysPromise);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [nameError, setNameError] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyWithKey | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const preview = isVercelPreview();

  const queryOptions = {
    queryKey: ['apiKeys'] as const,
    queryFn: listApiKeysClient,
    staleTime: preview ? 0 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    ...(preview ? {} : { initialData: initialApiKeys }),
  } as const;

  const { data: apiKeysResponse, isLoading, error: queryError } = useQuery(queryOptions);

  const apiKeys = apiKeysResponse?.apiKeys || [];

  const showTable = !isLoading && apiKeys.length > 0;
  const showEmptyState = !isLoading && apiKeys.length === 0;

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: createApiKey,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['apiKeys'] });
      const previousResponse = queryClient.getQueryData<ApiKeysListResponse>(['apiKeys']);
      return { previousResponse };
    },
    onError: (err, newApiKeyData, context) => {
      queryClient.setQueryData(['apiKeys'], context?.previousResponse);
    },
    onSettled: () => {
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
      const previousResponse = queryClient.getQueryData<ApiKeysListResponse>(['apiKeys']);

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

    // Get existing API key names for duplicate checking
    const existingNames = apiKeys.map((key) => key.name).filter(Boolean) as string[];
    const validation = validateApiKeyName(value, existingNames);
    if (!validation.isValid && value.trim()) {
      setNameError(validation.error || '');
    }
  };

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();

    // Get existing API key names for duplicate checking
    const existingNames = apiKeys.map((key) => key.name).filter(Boolean) as string[];
    const validation = validateApiKeyName(newKeyName, existingNames);
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
    if (!confirm(`Are you sure you want to delete "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(id));

    deleteApiKeyMutation.mutate(id, {
      onSettled: () => {
        setDeletingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      },
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
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
    });
  };

  const getStatusBadge = (enabled: boolean, expiresAt: Date | null) => {
    const statusInfo = getApiKeyStatusColor(enabled, expiresAt);
    const variant =
      statusInfo.status === 'Active' ? 'outline' : statusInfo.status === 'Expired' ? 'destructive' : 'secondary';

    return (
      <Badge variant={variant} className="text-xs">
        {statusInfo.status}
      </Badge>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Section */}
      <div className="flex w-full justify-end items-center">
        <Button onClick={() => setShowCreateForm(!showCreateForm)} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Create new secret key
        </Button>
      </div>

      {/* Create API Key Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create API Key</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateApiKey} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Name</Label>
                <Input
                  id="keyName"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter a descriptive name for your API key"
                  required
                  className={nameError ? 'border-destructive' : ''}
                />
                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                <p className="text-sm text-muted-foreground">
                  Give your API key a memorable name to identify its purpose
                </p>
              </div>

              <div className="flex space-x-3">
                <Button type="submit" disabled={!newKeyName.trim() || !!nameError || createApiKeyMutation.isPending}>
                  {createApiKeyMutation.isPending ? 'Creating...' : 'Create secret key'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
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
          </CardContent>
        </Card>
      )}

      {/* Error Messages */}
      {queryError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
          Failed to load API keys: {getErrorMessage(queryError)}
        </div>
      )}

      {createApiKeyMutation.isError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
          Failed to create API key: {getErrorMessage(createApiKeyMutation.error)}
        </div>
      )}

      {deleteApiKeyMutation.isError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
          Failed to delete API key: {getErrorMessage(deleteApiKeyMutation.error)}
        </div>
      )}

      {/* New API Key Display */}
      {createdKey && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">🎉 Your new secret key</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Please save this secret key somewhere safe and accessible. For security reasons, you won't be able to view
              it again through your account. If you lose this secret key, you'll need to generate a new one.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-foreground mb-2">Secret Key</Label>
                <div className="flex items-center space-x-2 bg-background p-3 rounded-lg border">
                  <code className="flex-1 text-sm font-mono text-foreground break-all">{createdKey.key}</code>
                  <Button
                    size="sm"
                    variant={copiedId === 'new-key' ? 'default' : 'outline'}
                    onClick={() => copyToClipboard(createdKey.key, 'new-key')}
                    className={`shrink-0 ${copiedId === 'new-key' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    {copiedId === 'new-key' ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => setCreatedKey(null)}>
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      {/* API Keys Table */}
      {showEmptyState && (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <div className="text-4xl mb-4">🔑</div>
          <h3 className="text-lg font-medium mb-2">No API keys found</h3>
          <p className="text-sm text-muted-foreground">Create your first API key to get started with our API.</p>
        </div>
      )}

      {showTable && (
        <>
          {/* Desktop Table Layout (lg and up) */}
          <div className="hidden lg:block border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_2.5fr_1.2fr_1.2fr_1.5fr_0.8fr] gap-6 p-4 border-b bg-muted/50 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center">Name</div>
              <div className="flex items-center">Secret Key</div>
              <div className="flex items-center">Created</div>
              <div className="flex items-center">Last Used</div>
              <div className="flex items-center">Project Access</div>
              <div className="flex items-center justify-center">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {apiKeys.map((apiKey) => {
                const isDeleting = deletingIds.has(apiKey.id);

                return (
                  <div
                    key={apiKey.id}
                    className={`grid grid-cols-[2fr_2.5fr_1.2fr_1.2fr_1.5fr_0.8fr] gap-6 p-4 hover:bg-muted/30 transition-colors ${
                      isDeleting ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Name */}
                    <div className="flex items-center">
                      <span className="font-medium truncate">{apiKey.name || 'Unnamed Key'}</span>
                    </div>

                    {/* Secret Key */}
                    <div className="flex items-center">
                      <code className="text-sm font-mono text-muted-foreground truncate">
                        {formatApiKeyDisplay(apiKey.prefix, apiKey.start)}
                      </code>
                    </div>

                    {/* Created */}
                    <div className="flex items-center text-sm text-muted-foreground">
                      {formatDate(apiKey.createdAt)}
                    </div>

                    {/* Last Used */}
                    <div className="flex items-center text-sm text-muted-foreground">
                      {formatDate(apiKey.lastRequest)}
                    </div>

                    {/* Project Access */}
                    <div className="flex items-center text-sm text-muted-foreground">All projects</div>

                    {/* Actions */}
                    <div className="flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                        disabled={isDeleting}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        {isDeleting ? <span className="text-xs">...</span> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tablet Layout (md to lg) */}
          <div className="hidden md:block lg:hidden border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[2.5fr_3fr_1.5fr_1fr] gap-4 p-4 border-b bg-muted/50 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center">Name</div>
              <div className="flex items-center">Secret Key</div>
              <div className="flex items-center">Created</div>
              <div className="flex items-center justify-center">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {apiKeys.map((apiKey) => {
                const isDeleting = deletingIds.has(apiKey.id);

                return (
                  <div
                    key={apiKey.id}
                    className={`grid grid-cols-[2.5fr_3fr_1.5fr_1fr] gap-4 p-4 hover:bg-muted/30 transition-colors ${
                      isDeleting ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Name */}
                    <div className="flex items-center">
                      <span className="font-medium truncate">{apiKey.name || 'Unnamed Key'}</span>
                    </div>

                    {/* Secret Key */}
                    <div className="flex items-center">
                      <code className="text-sm font-mono text-muted-foreground truncate">
                        {formatApiKeyDisplay(apiKey.prefix, apiKey.start)}
                      </code>
                    </div>

                    {/* Created */}
                    <div className="flex items-center text-sm text-muted-foreground">
                      {formatDate(apiKey.createdAt)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                        disabled={isDeleting}
                        className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        {isDeleting ? <span className="text-xs">...</span> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Card Layout (sm and below) */}
          <div className="block md:hidden space-y-3">
            {apiKeys.map((apiKey) => {
              const isDeleting = deletingIds.has(apiKey.id);

              return (
                <Card key={apiKey.id} className={isDeleting ? 'opacity-50' : ''}>
                  <CardContent className="px-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 flex min-w-0 space-x-2">
                        <h4 className="font-medium text-base truncate">{apiKey.name || 'Unnamed Key'}</h4>
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(apiKey.enabled, apiKey.expiresAt)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteApiKey(apiKey.id, apiKey.name)}
                        disabled={isDeleting}
                        className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive ml-2 shrink-0"
                      >
                        {isDeleting ? <span className="text-xs">...</span> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Secret Key</div>
                        <code className="text-sm font-mono text-muted-foreground block">
                          {formatApiKeyDisplay(apiKey.prefix, apiKey.start)}
                        </code>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created</div>
                          <div className="text-sm">{formatDate(apiKey.createdAt)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last Used</div>
                          <div className="text-sm">{formatDate(apiKey.lastRequest)}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
