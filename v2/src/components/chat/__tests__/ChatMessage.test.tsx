// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    it('shows blinking cursor when streaming', () => {
      const { container } = render(<ChatMessage role="assistant" content="Typing" isStreaming />);
      expect(container.querySelector('.animate-blink')).toBeInTheDocument();
    });

    it('does not show cursor when not streaming', () => {
      const { container } = render(<ChatMessage role="assistant" content="Complete" />);
      expect(container.querySelector('.animate-blink')).not.toBeInTheDocument();
    });

    it('shows cursor with empty content as loading indicator', () => {
      const { container } = render(<ChatMessage role="assistant" content="" isStreaming />);
      expect(container.querySelector('.animate-blink')).toBeInTheDocument();
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
});
