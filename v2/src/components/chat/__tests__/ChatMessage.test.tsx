// @vitest-environment jsdom
/**
 * ChatMessage Component Tests
 * Tests for chat message rendering with user/assistant styling.
 *
 * Component Requirements:
 * - Renders message content with correct role-based styling
 * - User messages: bg-primary, right-aligned
 * - Assistant messages: bg-card, left-aligned
 * - Optional timestamp display
 * - Streaming cursor animation when isStreaming=true
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  // ============================================================================
  // USER MESSAGE TESTS
  // ============================================================================

  describe('user message', () => {
    it('renders user message with correct styling', () => {
      render(<ChatMessage role="user" content="Hello!" />);

      const message = screen.getByText('Hello!');
      expect(message).toBeInTheDocument();

      // Check parent container has user styling (bg-primary)
      const container = message.closest('div[class*="bg-primary"]');
      expect(container).toBeInTheDocument();
    });

    it('aligns user message to the right', () => {
      const { container } = render(<ChatMessage role="user" content="Test" />);

      // Outer wrapper should have items-end for right alignment (flex column)
      const wrapper = container.querySelector('div[class*="items-end"]');
      expect(wrapper).toBeInTheDocument();
    });

    it('has user text styling', () => {
      const { container } = render(<ChatMessage role="user" content="User message" />);

      // text-sm is on the content wrapper div
      const textWrapper = container.querySelector('.text-sm');
      expect(textWrapper).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ASSISTANT MESSAGE TESTS
  // ============================================================================

  describe('assistant message', () => {
    it('renders assistant message with correct styling', () => {
      render(<ChatMessage role="assistant" content="Hi there!" />);

      const message = screen.getByText('Hi there!');
      expect(message).toBeInTheDocument();

      // Check parent container has assistant styling (bg-card)
      const container = message.closest('div[class*="bg-card"]');
      expect(container).toBeInTheDocument();
    });

    it('aligns assistant message to the left', () => {
      const { container } = render(<ChatMessage role="assistant" content="Test" />);

      // Outer wrapper should have items-start for left alignment (flex column)
      const wrapper = container.querySelector('div[class*="items-start"]');
      expect(wrapper).toBeInTheDocument();
    });

    it('has assistant text styling', () => {
      const { container } = render(<ChatMessage role="assistant" content="Assistant message" />);

      // text-sm is on the content wrapper div
      const textWrapper = container.querySelector('.text-sm');
      expect(textWrapper).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TIMESTAMP TESTS
  // ============================================================================

  describe('timestamp', () => {
    it('shows timestamp when provided', () => {
      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      render(<ChatMessage role="user" content="Test" timestamp={timestamp} />);

      // Should show time in h:mm a format
      expect(screen.getByText(/2:30 PM/i)).toBeInTheDocument();
    });

    it('does not show timestamp when not provided', () => {
      const { container } = render(<ChatMessage role="user" content="Test" />);

      // Timestamp element should not exist (look for font-mono element)
      const timestampElement = container.querySelector('.font-mono.text-xs');
      expect(timestampElement).not.toBeInTheDocument();
    });

    it('formats morning time correctly', () => {
      const timestamp = new Date('2024-01-15T09:15:00').getTime();
      render(<ChatMessage role="assistant" content="Test" timestamp={timestamp} />);

      expect(screen.getByText(/9:15 AM/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // STREAMING TESTS
  // ============================================================================

  describe('streaming', () => {
    it('shows streaming cursor when streaming', () => {
      const { container } = render(
        <ChatMessage role="assistant" content="Typing" isStreaming />
      );

      // Should have animate-blink class element (the cursor)
      const cursor = container.querySelector('.animate-blink');
      expect(cursor).toBeInTheDocument();
    });

    it('does not pulse the message container when streaming (only cursor blinks)', () => {
      const { container } = render(
        <ChatMessage role="assistant" content="Typing" isStreaming />
      );

      // Container should NOT have animate-pulse class (removed to prevent flash)
      const animatedContainer = container.querySelector('.animate-pulse');
      expect(animatedContainer).not.toBeInTheDocument();
    });

    it('does not show streaming cursor when not streaming', () => {
      const { container } = render(
        <ChatMessage role="assistant" content="Complete" />
      );

      const cursor = container.querySelector('.animate-blink');
      expect(cursor).not.toBeInTheDocument();
    });

    it('shows cursor when streaming even with empty content (loading indicator)', () => {
      const { container } = render(
        <ChatMessage role="assistant" content="" isStreaming />
      );

      // Cursor shows during streaming as a loading indicator
      const cursor = container.querySelector('.animate-blink');
      expect(cursor).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CONTENT RENDERING TESTS
  // ============================================================================

  describe('content rendering', () => {
    it('renders markdown paragraphs', () => {
      render(<ChatMessage role="user" content={'Line 1\n\nLine 2'} />);

      // Content should be rendered
      const paragraph = screen.getByText(/Line 1/);
      expect(paragraph).toBeInTheDocument();
    });

    it('handles long words with break-words', () => {
      const { container } = render(
        <ChatMessage role="user" content="Superlongwordwithoutspaces" />
      );

      // break-words is on the markdown wrapper
      const markdownWrapper = container.querySelector('.break-words');
      expect(markdownWrapper).toBeInTheDocument();
    });

    it('limits max width of message bubble', () => {
      const { container } = render(
        <ChatMessage role="user" content="Test message" />
      );

      // Message bubble should have max-w constraint
      const bubble = container.querySelector('[class*="max-w-"]');
      expect(bubble).toBeInTheDocument();
    });

    it('renders markdown bold text', () => {
      render(<ChatMessage role="assistant" content="This is **bold** text" />);

      const boldText = screen.getByText('bold');
      expect(boldText.tagName).toBe('STRONG');
    });

    it('renders markdown code inline', () => {
      render(<ChatMessage role="assistant" content="Use `console.log()` for debugging" />);

      const codeText = screen.getByText('console.log()');
      expect(codeText.tagName).toBe('CODE');
    });

    it('renders markdown lists', () => {
      // Use template literal to ensure proper line breaks
      const content = `- Item 1
- Item 2`;
      const { container } = render(<ChatMessage role="assistant" content={content} />);

      // Should render as a list
      const list = container.querySelector('ul');
      expect(list).toBeInTheDocument();
      const listItems = container.querySelectorAll('li');
      expect(listItems).toHaveLength(2);
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe('neobrutalist styling', () => {
    it('has border styling', () => {
      const { container } = render(
        <ChatMessage role="user" content="Test" />
      );

      const bubble = container.querySelector('[class*="border-2"]');
      expect(bubble).toBeInTheDocument();
    });

    it('has shadow styling', () => {
      const { container } = render(
        <ChatMessage role="assistant" content="Test" />
      );

      const bubble = container.querySelector('[class*="shadow-hard"]');
      expect(bubble).toBeInTheDocument();
    });

    it('has rounded-none for sharp corners', () => {
      const { container } = render(
        <ChatMessage role="user" content="Test" />
      );

      const bubble = container.querySelector('.rounded-none');
      expect(bubble).toBeInTheDocument();
    });
  });
});
