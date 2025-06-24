export const ENDPOINT_IDS = ['scrape', 'visual', 'structured', 'search'] as const;

export type EndpointId = (typeof ENDPOINT_IDS)[number];

export const ACTION_IDS = [
  // Scrape
  'elements',
  'markdown',
  'html',
  'links',
  // Visual
  'screenshot',
  'pdf',
  // Structured
  'json',
  // Search
  'web',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];
