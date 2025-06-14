'use client';

import { ScreenshotActions } from './VisualActions';
import { JsonActions } from './StructuredActions';
import {
  ScrapeMarkdownActions,
  ScrapeHtmlActions,
  ScrapeLinksActions,
  ScrapeElementsActions,
} from './ScrapeActions';
import { SearchActions } from './SearchActions';
import { useSearchParams } from 'next/navigation';

export function EndpointActions() {
  const searchParams = useSearchParams();
  const selectedEndpoint = searchParams.get('endpoint') || 'scrape';
  const selectedAction = searchParams.get('action') || 'markdown';

  if (selectedEndpoint === 'visual') {
    if (selectedAction === 'screenshot') {
      return <ScreenshotActions />;
    }
    return null;
  }
  if (selectedEndpoint === 'structured') {
    if (selectedAction === 'json') {
      return <JsonActions />;
    }
    return null;
  }
  if (selectedEndpoint === 'search') {
    if (selectedAction === 'web') {
      return <SearchActions />;
    }
    return null;
  }
  if (selectedEndpoint === 'scrape') {
    if (selectedAction === 'html') {
      return <ScrapeHtmlActions />;
    }
    if (selectedAction === 'markdown') {
      return <ScrapeMarkdownActions />;
    }
    if (selectedAction === 'links') {
      return <ScrapeLinksActions />;
    }
    if (selectedAction === 'elements') {
      return <ScrapeElementsActions />;
    }
  }
  return null;
}
