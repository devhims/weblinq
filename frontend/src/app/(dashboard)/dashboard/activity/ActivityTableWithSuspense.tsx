'use client';

import { use, useState, useRef, useCallback } from 'react';
import { studioApi, type ListFilesResponse } from '@/lib/studio-api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, FileText, Image, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActivityTableClientProps {
  filesPromise: Promise<ListFilesResponse>;
}

function ActivityTableClient({ filesPromise }: ActivityTableClientProps) {
  // Don't wrap use() in try/catch - let Suspense handle promise rejections
  const filesResponse = use(filesPromise);

  const files = filesResponse.data?.files || [];
  const hasMore = filesResponse.data?.hasMore || false;

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

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Files</CardTitle>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recent Files</span>
          <Badge variant="secondary">
            {files.length}
            {hasMore ? '+' : ''} file{files.length !== 1 ? 's' : ''}
          </Badge>
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

// Safe wrapper that prevents infinite request loops
function SafeActivityTable() {
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Use useRef to store the promise and prevent recreation on re-renders
  const filesPromiseRef = useRef<Promise<ListFilesResponse> | null>(null);
  const hasInitialized = useRef(false);

  const createFilesPromise = useCallback(() => {
    console.log('📡 Creating new files promise...');
    return studioApi.listFiles({
      limit: 50,
      offset: 0,
      sort_by: 'created_at',
      order: 'desc',
    });
  }, []);

  const handleRetry = useCallback(() => {
    console.log('🔄 Retrying files fetch...');
    setError(null);
    setIsRetrying(true);
    hasInitialized.current = false; // Allow new promise creation
    filesPromiseRef.current = null; // Clear cached promise
  }, []);

  // Only create promise once on mount or when explicitly retrying
  if (!hasInitialized.current && !filesPromiseRef.current) {
    hasInitialized.current = true;
    filesPromiseRef.current = createFilesPromise()
      .then((response) => {
        setIsRetrying(false);
        return response;
      })
      .catch((err) => {
        console.error('❌ Files promise rejected:', err);
        const errorMessage = err?.message || 'Failed to load files';
        setError(errorMessage);
        setIsRetrying(false);
        throw err;
      });
  }

  if (error && !isRetrying) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span>Failed to Load Files</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={handleRetry} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // filesPromiseRef.current should never be null at this point due to the initialization logic above
  if (!filesPromiseRef.current) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <ActivityTableClient filesPromise={filesPromiseRef.current} />;
}

export default function ActivityTableWithSuspense() {
  return <SafeActivityTable />;
}
