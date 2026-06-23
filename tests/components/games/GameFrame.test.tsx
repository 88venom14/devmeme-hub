import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GameFrame from '@/components/games/GameFrame';

// GameFrame is the single source of truth for isolating untrusted games. These
// tests pin the sandbox contract so a regression can't silently weaken it.
describe('GameFrame', () => {
  const game = { slug: 'demo-abcd1234', entry_path: 'index.html', title: 'Demo' };

  it('sandboxes the iframe without granting same-origin access', () => {
    const { container } = render(<GameFrame game={game} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();

    const sandbox = iframe!.getAttribute('sandbox') ?? '';
    const tokens = sandbox.split(/\s+/);
    expect(tokens).toContain('allow-scripts');
    // The critical guarantee: never same-origin, so the game can't read the
    // app's cookies / localStorage / JWT.
    expect(tokens).not.toContain('allow-same-origin');
    expect(tokens).not.toContain('allow-top-navigation');
    expect(tokens).not.toContain('allow-forms');
    expect(tokens).not.toContain('allow-modals');
    expect(tokens).not.toContain('allow-popups');
  });

  it('points the iframe at the games-static route for the slug', () => {
    const { container } = render(<GameFrame game={game} />);
    const src = container.querySelector('iframe')!.getAttribute('src') ?? '';
    expect(src).toContain('/games-static/demo-abcd1234/index.html');
    expect(iframeReferrer(container)).toBe('no-referrer');
  });
});

function iframeReferrer(container: HTMLElement): string {
  return container.querySelector('iframe')!.getAttribute('referrerpolicy') ?? '';
}
