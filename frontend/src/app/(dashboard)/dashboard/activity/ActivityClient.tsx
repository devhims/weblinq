'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ListFilesResponse, filesApi } from '@/lib/studio-api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, FileText, Image, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isVercelPreview } from '@/lib/utils';

interface ActivityClientProps {
  filesPromise: Promise<ListFilesResponse>;
  className?: string;
}

export function ActivityClient({ filesPromise, className }: ActivityClientProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use React 18's use() hook to unwrap the server promise
  const initialFiles = use(filesPromise);

  const preview = isVercelPreview();

  // Use React Query for client-side data fetching (especially needed for preview mode)
  const queryOptions = {
    queryKey: ['files', { limit: 50, offset: 0, sort_by: 'created_at', order: 'desc' }] as const,
    queryFn: () =>
      filesApi.list({
        limit: 50,
        offset: 0,
        sort_by: 'created_at',
        order: 'desc',
      }),
    staleTime: preview ? 0 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    // In preview mode, don't use server data as initialData since it's empty
    // In production, use server data as initialData for instant rendering
    ...(preview ? {} : { initialData: initialFiles }),
  } as const;

  const { data: filesResponse, isLoading, error: queryError, refetch } = useQuery(queryOptions);

  const files = filesResponse?.data?.files || [];
  const hasMore = filesResponse?.data?.hasMore || false;

  const formatFileSize = (sizeBytes: number): string => {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'screenshot':
        return <Image className="h-4 w-4" aria-label="Screenshot" />;
      case 'pdf':
        return <FileText className="h-4 w-4" aria-label="PDF" />;
      default:
        return <FileText className="h-4 w-4" aria-label="File" />;
    }
  };

  const getFileMetadata = (metadataString: string) => {
    try {
      const metadata = JSON.parse(metadataString);
      return metadata;
    } catch {
      return {};
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show loading state while React Query is fetching
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Files</span>
            <Button variant="outline" size="sm" disabled>
              <RefreshCw className="h-4 w-4 mr-2" />
              Loading...
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-sm text-muted-foreground">Loading files...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (queryError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Files</span>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              Retry
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium mb-2">Failed to load files</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {queryError.message || 'An error occurred while loading files.'}
            </p>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Files</span>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-lg font-medium mb-2">No files found</h3>
            <p className="text-sm text-muted-foreground">
              Files generated from screenshots, PDFs, and other API operations will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>Recent Files</span>
            <Badge variant="secondary">
              {files.length}
              {hasMore ? '+' : ''} file{files.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop Table Layout */}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source URL</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => {
                const metadata = getFileMetadata(file.metadata);
                const size = metadata.size || 0;

                return (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getFileIcon(file.type)}
                        <span className="font-medium truncate max-w-[200px]">{file.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {file.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[300px] block">
                        {metadata.url || file.url || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{size > 0 ? formatFileSize(size) : 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatDate(file.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      <a
                        href={file.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <span>Open</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card Layout */}
        <div className="block lg:hidden space-y-3">
          {files.map((file) => {
            const metadata = getFileMetadata(file.metadata);
            const size = metadata.size || 0;

            return (
              <Card key={file.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {getFileIcon(file.type)}
                    <span className="font-medium truncate">{file.filename}</span>
                  </div>
                  <Badge variant="outline" className="capitalize ml-2">
                    {file.type}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Source: </span>
                    <span className="break-all">{metadata.url || file.url || 'N/A'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Size: </span>
                      <span>{size > 0 ? formatFileSize(size) : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created: </span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href={file.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <span>Open file</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {hasMore && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Showing latest {files.length} files. More files available via API.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
