import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MarkdownContent from '@/components/common/MarkdownContent';

describe('MarkdownContent', () => {
  it('renders markdown text and headings', () => {
    const { container, getByText } = render(<MarkdownContent>{'# Title\n\nsome **bold** text'}</MarkdownContent>);
    expect(getByText('Title')).toBeInTheDocument();
    expect(container.querySelector('h1')).not.toBeNull();
  });

  it('neutralizes javascript: links (XSS guard)', () => {
    const { container } = render(<MarkdownContent>{'[click me](javascript:alert(1))'}</MarkdownContent>);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    // The dangerous scheme must be stripped. Depending on react-markdown's own
    // sanitization the result is either '#' or an empty href — never executable.
    const href = anchor?.getAttribute('href') ?? '';
    expect(href.startsWith('javascript:')).toBe(false);
    expect(['', '#']).toContain(href);
  });

  it('preserves safe http(s) links and opens them safely', () => {
    const { container } = render(<MarkdownContent>{'[site](https://example.com)'}</MarkdownContent>);
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com');
    expect(anchor?.getAttribute('rel')).toContain('noopener');
    expect(anchor?.getAttribute('target')).toBe('_blank');
  });

  it('renders fenced code blocks', () => {
    const { container } = render(<MarkdownContent>{'```js\nconst x = 1;\n```'}</MarkdownContent>);
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.querySelector('code')).not.toBeNull();
  });
});
