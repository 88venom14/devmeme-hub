import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';

interface Props {
  children: string;
  clamp?: number;
}

const rehypePlugins: Parameters<typeof ReactMarkdown>[0]['rehypePlugins'] =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [[rehypeHighlight as any, { detect: true, ignoreMissing: true }]];

const remarkPlugins: Parameters<typeof ReactMarkdown>[0]['remarkPlugins'] =
  [remarkGfm];

const MarkdownContent: React.FC<Props> = memo(({ children, clamp }) => {
  const isFeed = !!clamp;

  const components = useMemo<Parameters<typeof ReactMarkdown>[0]['components']>(
    () => ({
      p: ({ children: c }) => (
        <p style={{
          margin: '0 0 8px',
          lineHeight: 1.65,
          ...(isFeed ? {
            display: '-webkit-box',
            WebkitLineClamp: clamp,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          } : {}),
        }}>{c}</p>
      ),

      h1: ({ children: c }) => <h1 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-1)', lineHeight: 1.3, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{c}</h1>,
      h2: ({ children: c }) => <h2 style={{ fontSize: 18, fontWeight: 700, margin: '14px 0 6px', color: 'var(--text-1)', lineHeight: 1.3, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>{c}</h2>,
      h3: ({ children: c }) => <h3 style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 5px', color: 'var(--text-1)', lineHeight: 1.3 }}>{c}</h3>,
      h4: ({ children: c }) => <h4 style={{ fontSize: 14, fontWeight: 600, margin: '10px 0 4px', color: 'var(--text-1)' }}>{c}</h4>,
      h5: ({ children: c }) => <h5 style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 4px', color: 'var(--text-2)' }}>{c}</h5>,
      h6: ({ children: c }) => <h6 style={{ fontSize: 12, fontWeight: 600, margin: '8px 0 4px', color: 'var(--text-3)' }}>{c}</h6>,

      a: ({ href, children: c }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'underline', textDecorationColor: 'oklch(from var(--accent) l c h / 0.4)' }}>
          {c}
        </a>
      ),

      ul: ({ children: c }) => <ul style={{ margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.7 }}>{c}</ul>,
      ol: ({ children: c }) => <ol style={{ margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.7 }}>{c}</ol>,
      li: ({ children: c }) => <li style={{ margin: '2px 0', color: 'var(--text-2)' }}>{c}</li>,

      blockquote: ({ children: c }) => (
        <blockquote style={{
          margin: '8px 0', padding: '8px 14px',
          borderLeft: '3px solid var(--accent)',
          background: 'oklch(from var(--accent) l c h / 0.06)',
          borderRadius: '0 6px 6px 0',
          color: 'var(--text-2)', fontStyle: 'italic',
        }}>{c}</blockquote>
      ),

      hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />,

      img: ({ src, alt }) => (
        <img src={src} alt={alt ?? ''}
          style={{ maxWidth: '100%', borderRadius: 6, margin: '6px 0', display: 'block', border: '1px solid var(--border)' }} />
      ),

      table: ({ children: c }) => (
        <div style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{c}</table>
        </div>
      ),
      thead: ({ children: c }) => <thead style={{ background: 'var(--bg-2)' }}>{c}</thead>,
      tbody: ({ children: c }) => <tbody>{c}</tbody>,
      tr: ({ children: c }) => <tr style={{ borderBottom: '1px solid var(--border)' }}>{c}</tr>,
      th: ({ children: c }) => <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{c}</th>,
      td: ({ children: c }) => <td style={{ padding: '6px 12px', color: 'var(--text-2)' }}>{c}</td>,

      del: ({ children: c }) => <del style={{ color: 'var(--text-3)' }}>{c}</del>,

      input: ({ type, checked }) =>
        type === 'checkbox'
          ? <input type="checkbox" checked={checked} readOnly style={{ marginRight: 6, accentColor: 'var(--accent)' }} />
          : null,

      pre: ({ children: c }) => (
        <div style={{ position: 'relative', margin: '8px 0' }}>
          <pre style={{
            maxHeight: isFeed ? '80px' : undefined,
            overflow: isFeed ? 'hidden' : 'auto',
            margin: 0, borderRadius: 6,
            border: '1px solid var(--border)',
            fontSize: 13, lineHeight: 1.6,
          }}>{c}</pre>
          {isFeed && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
              background: 'linear-gradient(transparent, var(--bg-1))',
              borderRadius: '0 0 6px 6px', pointerEvents: 'none',
            }} />
          )}
        </div>
      ),

      code: ({ className, children: c, ...props }) => {
        if (className) {
          return <code className={className} {...(props as React.HTMLAttributes<HTMLElement>)}>{c}</code>;
        }
        return (
          <code style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 6px',
            fontSize: '0.875em', fontFamily: 'var(--font-mono)',
          }} {...(props as React.HTMLAttributes<HTMLElement>)}>{c}</code>
        );
      },
    }),
    [isFeed, clamp],
  );

  return (
    <div style={isFeed ? { maxHeight: '220px', overflow: 'hidden' } : { lineHeight: 1.65 }}>
      <ReactMarkdown
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';
export default MarkdownContent;
