import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';

interface Props {
  children: string;
  clamp?: number;
}

const MarkdownContent: React.FC<Props> = ({ children, clamp }) => {
  // webkit-line-clamp doesn't work with block elements like <pre>, so use maxHeight instead
  const lineHeightPx = 22; // 14px font * 1.6 line-height ≈ 22px
  const wrapperStyle: React.CSSProperties = clamp
    ? { maxHeight: `${clamp * lineHeightPx}px`, overflow: 'hidden' }
    : {};

  return (
    <div style={wrapperStyle}>
      <ReactMarkdown
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins={[[rehypeHighlight as any, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children: c }) => (
            <pre style={{
              margin: '8px 0',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              overflow: 'auto',
              fontSize: '13px',
              lineHeight: '1.6',
            }}>
              {c}
            </pre>
          ),
          code: ({ className, children: c, ...props }) => {
            if (className) {
              // block code — highlighted by rehype-highlight
              return <code className={className} {...(props as React.HTMLAttributes<HTMLElement>)}>{c}</code>;
            }
            // inline code
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
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
