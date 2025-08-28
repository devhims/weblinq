import * as HttpStatusPhrases from 'stoker/http-status-phrases';
import { createMessageObjectSchema } from 'stoker/openapi/schemas';

export const ZOD_ERROR_MESSAGES = {
  REQUIRED: 'Required',
  EXPECTED_NUMBER: 'Expected number, received nan',
  NO_UPDATES: 'No updates provided',
};

export const ZOD_ERROR_CODES = {
  INVALID_UPDATES: 'invalid_updates',
};

export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND);

/**
 * Credit costs for different web operations
 */
export const CREDIT_COSTS = {
  SCREENSHOT: 1,
  MARKDOWN: 1,
  JSON_EXTRACTION: 2, // Higher cost due to AI processing
  CONTENT: 1,
  SCRAPE: 1,
  LINKS: 1,
  SEARCH: 1,
  PDF: 1,
  YOUTUBE_CAPTIONS: 1, // YouTube caption extraction
} as const;

export type WebOperation = keyof typeof CREDIT_COSTS;
