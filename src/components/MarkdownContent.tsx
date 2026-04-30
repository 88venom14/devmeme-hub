import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';

interface Props {
  children: string;
  clamp?: number;
}

// Stable plugin array — avoids recreating it on every render
const rehypePlugins: Parameters<typeof ReactMarkdown>[0]['rehypePlugins'] =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [[rehypeHighlight as any, { detect: true, ignoreMissing: true }]];

const MarkdownContent: React.FC<Props> = memo(({ children, clamp }) => {
  const isFeed = !!clamp;

  const components = useMemo<Parameters<typeof ReactMarkdown>[0]['components']>(
    () => ({
      p: ({ children: c }) => (
        <p
          style={{
            margin: '0 0 6px',
            ...(isFeed
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: clamp,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {c}
        </p>
      ),

      pre: ({ children: c }) => (
        <div style={{ position: 'relative', margin: '8px 0' }}>
          <pre
            style={{
              maxHeight: isFeed ? '80px' : undefined,
              overflow: isFeed ? 'hidden' : 'auto',
              margin: 0,
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              fontSize: '13px',
              lineHeight: '1.6',
            }}
          >
            {c}
          </pre>
          {isFeed && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '32px',
                background: 'linear-gradient(transparent, #1e2127)',
                borderRadius: '0 0 6px 6px',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      ),

      code: ({ className, children: c, ...props }) => {
        if (className) {
          return (
            <code
              className={className}
              {...(props as React.HTMLAttributes<HTMLElement>)}
            >
              {c}
            </code>
          );
        }
        return (
          <code
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '0.875em',
              fontFamily: 'var(--font-mono)',
            }}
            {...(props as React.HTMLAttributes<HTMLElement>)}
          >
            {c}
          </code>
        );
      },
    }),
    [isFeed, clamp],
  );

  return (
    <div style={isFeed ? { maxHeight: '220px', overflow: 'hidden' } : {}}>
      <ReactMarkdown rehypePlugins={rehypePlugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

export default MarkdownContent;
