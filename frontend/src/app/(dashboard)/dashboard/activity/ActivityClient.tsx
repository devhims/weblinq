'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ListFilesResponse, filesApi, type DeleteFileRequest } from '@/lib/studio-api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, FileText, Image, RefreshCw, Trash2, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isVercelPreview } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityLoading } from '@/components/dashboard';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

interface ActivityClientProps {
  filesPromise: Promise<ListFilesResponse>;
  className?: string;
}

const PAGE_SIZE = 50;

export function ActivityClient({ filesPromise, className }: ActivityClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Filter and sorting state
  const [fileType, setFileType] = useState<'all' | 'screenshot' | 'pdf'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'filename'>('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  // Use React 18's use() hook to unwrap the server promise
  const initialFiles = use(filesPromise);

  const preview = isVercelPreview();
  const queryClient = useQueryClient();

  // Calculate offset based on current page
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Build query parameters for API calls
  const queryParams = {
    limit: PAGE_SIZE,
    offset,
    sort_by: sortBy,
    order,
    ...(fileType !== 'all' && { type: fileType as 'screenshot' | 'pdf' }),
  };

  // Use React Query for client-side data fetching (especially needed for preview mode)
  const queryOptions = {
    queryKey: ['files', queryParams] as const,
    queryFn: () => filesApi.list(queryParams),
    staleTime: preview ? 0 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    // In preview mode, don't use server data as initialData since it's empty
    // In production, use server data as initialData only for the first page with default filters
    ...(preview
      ? {}
      : currentPage === 1 && fileType === 'all' && sortBy === 'created_at' && order === 'desc'
      ? { initialData: initialFiles }
      : {}),
  } as const;

  const { data: filesResponse, isLoading, error: queryError, refetch } = useQuery(queryOptions);

  const files = filesResponse?.data?.files || [];
  const totalFiles = filesResponse?.data?.totalFiles || 0;
  const hasMore = filesResponse?.data?.hasMore || false;

  // Calculate pagination info
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Reset to first page when filters change
  const handleFilterChange = (
    newFileType?: 'all' | 'screenshot' | 'pdf',
    newSortBy?: 'created_at' | 'filename',
    newOrder?: 'asc' | 'desc',
  ) => {
    if (newFileType !== undefined) setFileType(newFileType);
    if (newSortBy !== undefined) setSortBy(newSortBy);
    if (newOrder !== undefined) setOrder(newOrder);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: filesApi.delete,
    onMutate: async (deleteRequest) => {
      await queryClient.cancelQueries({ queryKey: ['files'] });

      // Update all cached pages by removing the deleted file
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll({ queryKey: ['files'] });

      queries.forEach((query) => {
        const data = query.state.data as ListFilesResponse | undefined;
        if (data) {
          queryClient.setQueryData(query.queryKey, {
            ...data,
            data: {
              ...data.data,
              files: data.data.files.filter((file) => file.id !== deleteRequest.fileId),
              totalFiles: Math.max(0, data.data.totalFiles - 1),
            },
          });
        }
      });

      return { deletedFileId: deleteRequest.fileId };
    },
    onError: (err, deleteRequest, context) => {
      // Invalidate all file queries to refresh from server
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onSettled: () => {
      // Always refresh the current page after delete operation
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  const formatFileSize = (sizeBytes: number): string => {
    // Use decimal (1000-based) calculation to match Cloudflare R2 dashboard
    if (sizeBytes < 1000) return `${sizeBytes} B`;
    if (sizeBytes < 1000 * 1000) return `${(sizeBytes / 1000).toFixed(1)} KB`;
    if (sizeBytes < 1000 * 1000 * 1000) return `${(sizeBytes / (1000 * 1000)).toFixed(1)} MB`;
    return `${(sizeBytes / (1000 * 1000 * 1000)).toFixed(1)} GB`;
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

  const getFileSize = (metadataString: string): number => {
    try {
      const metadata = JSON.parse(metadataString);
      // Prefer R2 size (actual file size) over original metadata size
      return metadata.r2Size || metadata.size || 0;
    } catch {
      return 0;
    }
  };

  const getSourceUrl = (file: any): string => {
    try {
      const metadata = JSON.parse(file.metadata);
      return metadata.url || file.url || '';
    } catch {
      return file.url || '';
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

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleDeleteFile = (fileId: string, filename: string) => {
    const confirmMessage = `Are you sure you want to delete "${filename}"? This action cannot be undone and will remove the file from both the database and storage.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(fileId));

    deleteFileMutation.mutate(
      { fileId, deleteFromR2: true }, // Delete from both database and R2 storage
      {
        onSettled: () => {
          setDeletingIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
        },
      },
    );
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, current page area, and last page with ellipsis
      if (currentPage <= 4) {
        // Near beginning
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near end
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In middle
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // Get filter description for display
  const getFilterDescription = () => {
    const parts = [];

    if (fileType !== 'all') {
      parts.push(`${fileType}s`);
    } else {
      parts.push('all files');
    }

    const sortLabel = sortBy === 'created_at' ? 'date' : 'name';
    const orderLabel = order === 'desc' ? 'newest first' : 'oldest first';

    if (sortBy === 'filename') {
      parts.push(`sorted by ${sortLabel} (${order === 'asc' ? 'A-Z' : 'Z-A'})`);
    } else {
      parts.push(`sorted by ${sortLabel} (${orderLabel})`);
    }

    return parts.join(', ');
  };

  // Show loading state while React Query is fetching
  if (isLoading) {
    return <ActivityLoading className={className} />;
  }

  // Show error state
  if (queryError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Files</span>
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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>Files</span>
            {totalFiles > 0 && (
              <Badge variant="secondary">
                Page {currentPage} of {totalPages} ({totalFiles} total)
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Sorting Controls */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* File Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={fileType}
                onValueChange={(value: 'all' | 'screenshot' | 'pdf') => handleFilterChange(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="File type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All files</SelectItem>
                  <SelectItem value="screenshot">Screenshots</SelectItem>
                  <SelectItem value="pdf">PDFs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By Field */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select
                value={sortBy}
                onValueChange={(value: 'created_at' | 'filename') => handleFilterChange(undefined, value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date</SelectItem>
                  <SelectItem value="filename">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <Select
              value={order}
              onValueChange={(value: 'asc' | 'desc') => handleFilterChange(undefined, undefined, value)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                {sortBy === 'created_at' ? (
                  <>
                    <SelectItem value="desc">Newest first</SelectItem>
                    <SelectItem value="asc">Oldest first</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="asc">A to Z</SelectItem>
                    <SelectItem value="desc">Z to A</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Active filters description */}
          {(fileType !== 'all' || sortBy !== 'created_at' || order !== 'desc') && (
            <div className="text-sm text-muted-foreground self-center">Showing {getFilterDescription()}</div>
          )}
        </div>

        {/* Error Messages */}
        {deleteFileMutation.isError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
            Failed to delete file: {getErrorMessage(deleteFileMutation.error)}
          </div>
        )}

        {totalFiles === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-lg font-medium mb-2">No files found</h3>
            <p className="text-sm text-muted-foreground">
              {fileType === 'all'
                ? 'Files generated from screenshots, PDFs, and other API operations will appear here.'
                : `No ${fileType}s found. Try changing your filter or creating some files.`}
            </p>
          </div>
        ) : (
          <>
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const metadata = getFileMetadata(file.metadata);
                    const size = getFileSize(file.metadata);
                    const isDeleting = deletingIds.has(file.id);

                    return (
                      <TableRow key={file.id} className={cn(isDeleting && 'opacity-50')}>
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
                            <a
                              href={getSourceUrl(file)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white hover:text-white/80 underline"
                            >
                              {getSourceUrl(file)}
                            </a>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {size > 0 ? formatFileSize(size) : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{formatDate(file.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <a
                              href={file.public_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-white hover:text-white/80 text-sm"
                            >
                              <span>Open</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFile(file.id, file.filename)}
                              disabled={isDeleting}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete file</span>
                            </Button>
                          </div>
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
                const size = getFileSize(file.metadata);
                const isDeleting = deletingIds.has(file.id);

                return (
                  <Card key={file.id} className={cn('p-4', isDeleting && 'opacity-50')}>
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
                        <span className="break-all">
                          <a
                            href={getSourceUrl(file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-white/80 underline"
                          >
                            {getSourceUrl(file)}
                          </a>
                        </span>
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

                      <div className="flex items-center justify-between pt-2">
                        <a
                          href={file.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-white hover:text-white/80 text-sm"
                        >
                          <span>Open file</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFile(file.id, file.filename)}
                          disabled={isDeleting}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete file</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (hasPrevPage) handlePageChange(currentPage - 1);
                      }}
                      className={!hasPrevPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {getPageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === 'ellipsis' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page as number);
                          }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (hasNextPage) handlePageChange(currentPage + 1);
                      }}
                      className={!hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}

            {/* Results summary */}
            <div className="text-center text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, totalFiles)} of{' '}
              {totalFiles} files
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
