/**
 * Utility functions for API key handling and display
 */

/**
 * Masks an API key for display purposes
 * Shows first few and last few characters with dots in between
 */
export function maskApiKey(key: string, showLength: number = 4): string {
  if (key.length <= showLength * 2) {
    return '•'.repeat(key.length);
  }

  const start = key.substring(0, showLength);
  const end = key.substring(key.length - showLength);
  return `${start}${'•'.repeat(8)}${end}`;
}

/**
 * Format API key display with prefix and start characters
 */
export function formatApiKeyDisplay(
  prefix: string | null,
  start: string | null
): string {
  const displayPrefix = prefix || 'wq_';
  const displayStart = start || '****';
  return `${displayPrefix}•••${displayStart}`;
}

/**
 * Generate a secure random API key name suggestion
 */
export function generateKeyNameSuggestion(): string {
  const adjectives = [
    'Production',
    'Development',
    'Testing',
    'Staging',
    'Personal',
    'Mobile',
    'Web',
    'Server',
  ];
  const nouns = ['API', 'Key', 'Access', 'Token', 'Client', 'Service', 'App'];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective} ${noun}`;
}

/**
 * Validate API key name
 */
export function validateApiKeyName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name.trim()) {
    return { isValid: false, error: 'Name is required' };
  }

  if (name.length < 3) {
    return { isValid: false, error: 'Name must be at least 3 characters long' };
  }

  if (name.length > 50) {
    return { isValid: false, error: 'Name must be less than 50 characters' };
  }

  const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
  if (!validPattern.test(name)) {
    return {
      isValid: false,
      error:
        'Name can only contain letters, numbers, spaces, hyphens, and underscores',
    };
  }

  return { isValid: true };
}

/**
 * Format usage statistics
 */
export function formatUsageStats(
  requests: number,
  remaining: number | null
): string {
  if (remaining === null) {
    return `${requests.toLocaleString()} requests`;
  }

  const total = requests + remaining;
  const percentage = total > 0 ? Math.round((requests / total) * 100) : 0;

  return `${requests.toLocaleString()} / ${total.toLocaleString()} (${percentage}%)`;
}

/**
 * Get status color for API key
 */
export function getApiKeyStatusColor(
  enabled: boolean,
  expiresAt: Date | null
): {
  bg: string;
  text: string;
  status: string;
} {
  if (!enabled) {
    return {
      bg: 'bg-red-100',
      text: 'text-red-800',
      status: 'Disabled',
    };
  }

  if (expiresAt && new Date(expiresAt) < new Date()) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      status: 'Expired',
    };
  }

  return {
    bg: 'bg-green-100',
    text: 'text-green-800',
    status: 'Active',
  };
}
