// @vitest-environment jsdom
/**
 * ChatInput Component Tests
 * Tests for chat input with send button and keyboard handling.
 *
 * Component Requirements:
 * - Renders textarea and send button
 * - Calls onChange when typing
 * - Calls onSend when clicking send button
 * - Calls onSend on Enter key (but not Shift+Enter)
 * - Disables input and button when disabled prop is true
 * - Auto-resizes textarea based on content
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  // ============================================================================
  // BASIC RENDERING TESTS
  // ============================================================================

  describe('basic rendering', () => {
    it('renders input and send button', () => {
      render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('uses custom placeholder when provided', () => {
      render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
          placeholder="Ask anything..."
        />
      );

      expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument();
    });

    it('displays current value in textarea', () => {
      render(
        <ChatInput
          value="Hello world"
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Hello world');
    });
  });

  // ============================================================================
  // CHANGE HANDLING TESTS
  // ============================================================================

  describe('change handling', () => {
    it('calls onChange when typing', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(
        <ChatInput
          value=""
          onChange={onChange}
          onSend={() => {}}
        />
      );

      const input = screen.getByPlaceholderText('Type a message...');
      await user.type(input, 'Hello');

      expect(onChange).toHaveBeenCalled();
    });

    it('passes new value to onChange handler', async () => {
      const onChange = vi.fn();

      render(
        <ChatInput
          value=""
          onChange={onChange}
          onSend={() => {}}
        />
      );

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'New message' } });

      expect(onChange).toHaveBeenCalledWith('New message');
    });
  });

  // ============================================================================
  // SEND BUTTON TESTS
  // ============================================================================

  describe('send button', () => {
    it('calls onSend when clicking send button', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();

      render(
        <ChatInput
          value="Hello"
          onChange={() => {}}
          onSend={onSend}
        />
      );

      await user.click(screen.getByRole('button', { name: /send/i }));
      expect(onSend).toHaveBeenCalled();
    });

    it('disables send button when value is empty', () => {
      render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('disables send button when value is only whitespace', () => {
      render(
        <ChatInput
          value="   "
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('enables send button when value has content', () => {
      render(
        <ChatInput
          value="Hello"
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
    });
  });

  // ============================================================================
  // KEYBOARD HANDLING TESTS
  // ============================================================================

  describe('keyboard handling', () => {
    it('calls onSend on Enter key', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();

      render(
        <ChatInput
          value="Hello"
          onChange={() => {}}
          onSend={onSend}
        />
      );

      const input = screen.getByPlaceholderText('Type a message...');
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(onSend).toHaveBeenCalled();
    });

    it('does not call onSend on Shift+Enter', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();

      render(
        <ChatInput
          value="Hello"
          onChange={() => {}}
          onSend={onSend}
        />
      );

      const input = screen.getByPlaceholderText('Type a message...');
      await user.click(input);
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not call onSend on Enter when value is empty', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();

      render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={onSend}
        />
      );

      const input = screen.getByPlaceholderText('Type a message...');
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not call onSend on Enter when disabled', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();

      render(
        <ChatInput
          value="Hello"
          onChange={() => {}}
          onSend={onSend}
          disabled
        />
      );

      const input = screen.getByPlaceholderText('Type a message...');
      // Focus won't work on disabled input, so we fire event directly
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DISABLED STATE TESTS
  // ============================================================================

  describe('disabled state', () => {
    it('disables input when disabled prop is true', () => {
      render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
          disabled
        />
      );

      expect(screen.getByPlaceholderText('Type a message...')).toBeDisabled();
    });

    it('disables send button when disabled prop is true', () => {
      render(
        <ChatInput
          value="Hello"
          onChange={() => {}}
          onSend={() => {}}
          disabled
        />
      );

      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('has disabled styling on input', () => {
      const { container } = render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
          disabled
        />
      );

      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('disabled:');
    });
  });

  // ============================================================================
  // STYLING TESTS
  // ============================================================================

  describe('styling', () => {
    it('has border on container', () => {
      const { container } = render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      const wrapper = container.querySelector('[class*="border-t"]');
      expect(wrapper).toBeInTheDocument();
    });

    it('textarea has focus ring styling', () => {
      const { container } = render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('focus:ring');
    });

    it('send button has hard shadow styling', () => {
      render(
        <ChatInput
          value="Test"
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      const button = screen.getByRole('button', { name: /send/i });
      expect(button.className).toContain('shadow-hard');
    });
  });

  // ============================================================================
  // TEXTAREA BEHAVIOR TESTS
  // ============================================================================

  describe('textarea behavior', () => {
    it('starts with single row', () => {
      render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement;
      expect(textarea.rows).toBe(1);
    });

    it('is not resizable manually', () => {
      const { container } = render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
        />
      );

      const textarea = container.querySelector('textarea');
      expect(textarea?.className).toContain('resize-none');
    });
  });
});
