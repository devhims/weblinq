'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import pretty from 'pretty';
import { ResultContainer } from './ResultContainer';

interface CodeDisplayProps {
  content: string | object;
  language: string;
  loading?: boolean;
  error?: string | null;
  showLineNumbers?: boolean;
  wrapLongLines?: boolean;
  formatHtml?: boolean;
  darkBackground?: boolean;
}

export function CodeDisplay({
  content,
  language,
  loading = false,
  error = null,
  showLineNumbers = true,
  wrapLongLines = true,
  formatHtml = false,
  darkBackground = true,
}: CodeDisplayProps) {
  // Process content based on type and formatting options
  const processedContent = (() => {
    if (typeof content === 'string') {
      if (formatHtml && language === 'html') {
        try {
          return pretty(content);
        } catch {
          return content;
        }
      }
      return content;
    }

    // Handle objects (like JSON)
    return JSON.stringify(content, null, 2);
  })();

  return (
    <ResultContainer loading={loading} error={error} copyContent={processedContent} darkBackground={darkBackground}>
      <SyntaxHighlighter
        language={language}
        style={atomDark}
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
          height: '100%',
          background: 'var(--color-card)',
          fontSize: language === 'html' ? '14px' : undefined,
        }}
        wrapLongLines={wrapLongLines}
        showLineNumbers={showLineNumbers}
      >
        {processedContent}
      </SyntaxHighlighter>
    </ResultContainer>
  );
}
