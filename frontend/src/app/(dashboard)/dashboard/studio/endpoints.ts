/*
 * Endpoint metadata & component registry for Studio dashboard
 *
 *  ––– Circular-dependency fix (Option 2 from discussion) –––
 *   We export the pure-data identifier arrays **before** importing any action
 *   components (which themselves import `useStudioParams`, which imports these
 *   identifiers).  This guarantees the identifiers are fully initialised when
 *   `useStudioParams` needs them, eliminating the "Cannot access … before
 *   initialization" error without relying on an extra helper file.
 */

import { Code, Camera, FileJson, Search, LucideIcon } from 'lucide-react';

// Note: We intentionally do NOT re-export IDs and types here anymore.
// Consumers should import from '../constants' for identifier data.

/* ──────────────────────────────────────────────────────────
 * 1.  Pure identifier data (no React, no component imports)
 * ─────────────────────────────────────────────────────────*/

/* ──────────────────────────────────────────────────────────
 * 2.  Component imports (safe now)
 * ─────────────────────────────────────────────────────────*/

import React from 'react';
import {
  ScrapeElementsActions,
  ScrapeHtmlActions,
  ScrapeLinksActions,
  ScrapeMarkdownActions,
} from './components/ScrapeActions';
import { ScreenshotActions, PdfActions } from './components/VisualActions';
import { JsonActions } from './components/StructuredActions';
import { SearchActions } from './components/SearchActions';

/* -------------------------------------------------------------
 * Types (improved with better type safety)
 * -----------------------------------------------------------*/
export type ApiSubAction = {
  id: string;
  name: string;
  description: string;
  Component: React.ComponentType; // renders the ui for this action
};

export type ApiEndpoint = {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  subActions: ApiSubAction[];
};

/* -------------------------------------------------------------
 * Placeholder component(s)
 * -----------------------------------------------------------*/

/* -------------------------------------------------------------
 * Endpoint configuration (single source of truth)
 * -----------------------------------------------------------*/
export const API_ENDPOINTS = [
  {
    id: 'scrape',
    name: 'Scrape',
    icon: Code,
    description: 'Extract content and data from a webpage',
    subActions: [
      {
        id: 'markdown',
        name: 'Markdown',
        description: 'Extract content as Markdown from a webpage',
        Component: ScrapeMarkdownActions,
      },

      {
        id: 'html',
        name: 'HTML Content',
        description: 'Fetch raw HTML content from a webpage',
        Component: ScrapeHtmlActions,
      },
      {
        id: 'links',
        name: 'Links',
        description: 'Extract all links from a webpage',
        Component: ScrapeLinksActions,
      },
      {
        id: 'elements',
        name: 'Selective Scrape',
        description: 'Scrape specific HTML elements using CSS selectors',
        Component: ScrapeElementsActions,
      },
    ],
  },
  {
    id: 'visual',
    name: 'Visual Capture',
    icon: Camera,
    description: 'Capture visual representations of a webpage',
    subActions: [
      {
        id: 'screenshot',
        name: 'Screenshot',
        description: 'Capture a screenshot of a webpage',
        Component: ScreenshotActions,
      },
      {
        id: 'pdf',
        name: 'PDF',
        description: 'Render a webpage as PDF',
        Component: PdfActions,
      },
    ],
  },
  {
    id: 'structured',
    name: 'Structured Data',
    icon: FileJson,
    description: 'Extract structured data from a webpage',
    subActions: [
      {
        id: 'json',
        name: 'JSON',
        description: 'Extract structured data in JSON format',
        Component: JsonActions,
      },
    ],
  },
  {
    id: 'search',
    name: 'Search',
    icon: Search,
    description: 'Search the web for relevant results',
    subActions: [
      {
        id: 'web',
        name: 'Web Search',
        description: 'Search for information across the web',
        Component: SearchActions,
      },
    ],
  },
] as const satisfies readonly ApiEndpoint[];

/* -------------------------------------------------------------
 * Helper functions
 * -----------------------------------------------------------*/

// NOTE: getActionParams removed - using simplified parameter cleanup approach
// All parameters except endpoint, action, and url are reset when switching actions
