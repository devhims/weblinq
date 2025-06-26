import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCallbackURL(path: string = '/dashboard'): string {
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
      : 'http://localhost:3000';

  return `${baseUrl}${path}`;
}

/**
 * Download a blob as a file with the given filename
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for screenshots based on URL and timestamp
 */
export function generateScreenshotFilename(url: string, format: string = 'png', timestamp?: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const path = urlObj.pathname.replace(/\//g, '-').replace(/^-/, '') || 'home';
    const date = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

    return `screenshot-${domain}-${path}-${date}.${format}`;
  } catch {
    const date = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return `screenshot-${date}.${format}`;
  }
}

/**
 * Generate a filename for PDFs based on URL and timestamp
 */
export function generatePdfFilename(url: string, timestamp?: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const path = urlObj.pathname.replace(/\//g, '-').replace(/^-/, '') || 'home';
    const date = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

    return `${domain}-${path}-${date}.pdf`;
  } catch {
    const date = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return `page-${date}.pdf`;
  }
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Preview environment detection and API key utilities
export function isVercelPreview(): boolean {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  // Match our Vercel preview patterns
  return hostname.includes('-devhims-projects.vercel.app') && hostname.startsWith('weblinq-');
}

export function getApiKeyFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('weblinq_preview_api_key');
}

export function setApiKeyInStorage(apiKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('weblinq_preview_api_key', apiKey);
}

export function removeApiKeyFromStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('weblinq_preview_api_key');
}

export function isPreviewAuthenticated(): boolean {
  return isVercelPreview() && !!getApiKeyFromStorage();
}
