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
      <div className="relative w-full h-full">
        <SyntaxHighlighter
          language={language}
          style={atomDark}
          customStyle={{
            margin: 0,
            borderRadius: '0.375rem',
            height: '100%',
            background: 'var(--color-card)',
            fontSize: '12px',
            lineHeight: '1.4',
            padding: '12px',
          }}
          wrapLongLines={wrapLongLines}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            fontSize: '11px',
            minWidth: '2em',
            paddingRight: '8px',
          }}
          className="text-xs sm:text-sm [&_pre]:!text-xs [&_pre]:sm:!text-sm [&_pre]:lg:!text-sm
                     [&_.linenumber]:!text-xs [&_.linenumber]:!min-w-[2em] 
                     sm:[&_.linenumber]:!min-w-[2.5em] [&]:!p-3 sm:[&]:!p-4"
        >
          {processedContent}
        </SyntaxHighlighter>
      </div>
    </ResultContainer>
  );
}
