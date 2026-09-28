// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  it('renders user message content', () => {
    render(<ChatMessage role="user" content="Hello!" />);
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(<ChatMessage role="assistant" content="Hi there!" />);
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  describe('timestamp', () => {
    it.each([
      ['afternoon', '2024-01-15T14:30:00', /2:30 PM/i],
      ['morning', '2024-01-15T09:15:00', /9:15 AM/i],
    ])('formats %s time correctly', (_label, dateStr, expected) => {
      render(<ChatMessage role="user" content="Test" timestamp={new Date(dateStr).getTime()} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('does not show timestamp when not provided', () => {
      const { container } = render(<ChatMessage role="user" content="Test" />);
      expect(container.querySelector('.font-mono.text-xs')).not.toBeInTheDocument();
    });
  });

  describe('streaming', () => {
    it('shows the cursor while streaming', () => {
      const { container } = render(<ChatMessage role="assistant" content="Typing" isStreaming />);
      expect(container.querySelector('span[aria-hidden="true"].bg-current')).toBeInTheDocument();
    });

    it('does not show cursor when not streaming', () => {
      const { container } = render(<ChatMessage role="assistant" content="Complete" />);
      expect(container.querySelector('span[aria-hidden="true"].bg-current')).not.toBeInTheDocument();
    });

    it('shows cursor with empty content as loading indicator', () => {
      const { container } = render(<ChatMessage role="assistant" content="" isStreaming />);
      expect(container.querySelector('span[aria-hidden="true"].bg-current')).toBeInTheDocument();
    });
  });

  describe('markdown rendering', () => {
    it('renders bold text', () => {
      render(<ChatMessage role="assistant" content="This is **bold** text" />);
      expect(screen.getByText('bold').tagName).toBe('STRONG');
    });

    it('renders inline code', () => {
      render(<ChatMessage role="assistant" content="Use `console.log()` for debugging" />);
      expect(screen.getByText('console.log()').tagName).toBe('CODE');
    });

    it('renders lists', () => {
      const { container } = render(<ChatMessage role="assistant" content={`- Item 1\n- Item 2`} />);
      expect(container.querySelector('ul')).toBeInTheDocument();
      expect(container.querySelectorAll('li')).toHaveLength(2);
    });
  });

  describe('live replies (2026-09-28: no vanish, no replay)', () => {
    // Frames run only when the test says so.
    let frames: FrameRequestCallback[] = [];
    const flushFrames = (n = 200) => {
      for (let i = 0; i < n && frames.length; i++) {
        const batch = frames;
        frames = [];
        act(() => batch.forEach((cb) => cb(performance.now())));
      }
    };
    const stubFrames = () => {
      frames = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', () => {});
    };
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const TEXT = 'The prevailing wage determination arrives before recruitment.';

    it('reveals a live reply gradually and ends on the whole text', () => {
      stubFrames();
      const { container, rerender } = render(
        <ChatMessage role="assistant" content="" isStreaming animateText />
      );
      rerender(<ChatMessage role="assistant" content={TEXT} isStreaming animateText />);
      // Nothing has been painted yet: the text is still arriving.
      expect(container.textContent).not.toContain(TEXT);
      flushFrames(1);
      const partial = container.textContent ?? '';
      expect(partial.length).toBeGreaterThan(0);
      expect(partial).not.toContain(TEXT);
      flushFrames();
      expect(container.textContent).toContain(TEXT);
    });

    it('the end of the stream does not restart or blank the text', () => {
      stubFrames();
      const { container, rerender } = render(
        <ChatMessage role="assistant" content={TEXT} isStreaming animateText />
      );
      flushFrames();
      expect(container.textContent).toContain(TEXT);
      rerender(<ChatMessage role="assistant" content={TEXT} isStreaming={false} animateText />);
      // Still whole on the very next render: no reset to an empty reveal.
      expect(container.textContent).toContain(TEXT);
      expect(frames).toHaveLength(0);
    });

    it('shows saved history at once, without animating', () => {
      stubFrames();
      const { container } = render(<ChatMessage role="assistant" content={TEXT} />);
      expect(container.textContent).toContain(TEXT);
      expect(frames).toHaveLength(0);
    });

    it('keeps a stopped reply and says it was stopped', () => {
      render(<ChatMessage role="assistant" content="Partial answer" wasStopped />);
      expect(screen.getByText('Partial answer')).toBeInTheDocument();
      expect(screen.getByText('Stopped')).toBeInTheDocument();
    });
  });
});
