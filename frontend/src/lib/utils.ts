import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getFrontendUrl } from '@/config/env';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the correct callback URL for OAuth flows
 * Uses centralized config for consistent URL handling
 */
export function getCallbackURL(path: string = '/dashboard'): string {
  return getFrontendUrl(path);
}
