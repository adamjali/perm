// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';

const defaultProps = { value: '', onChange: vi.fn(), onSend: vi.fn() };

describe('ChatInput', () => {
  describe('rendering', () => {
    it('renders textarea with placeholder and send button', () => {
      render(<ChatInput {...defaultProps} />);
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('uses custom placeholder', () => {
      render(<ChatInput {...defaultProps} placeholder="Ask anything..." />);
      expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument();
    });

    it('displays current value', () => {
      render(<ChatInput {...defaultProps} value="Hello world" />);
      expect((screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement).value).toBe('Hello world');
    });
  });

  describe('change handling', () => {
    it('calls onChange when typing', async () => {
      const onChange = vi.fn();
      render(<ChatInput {...defaultProps} onChange={onChange} />);
      fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'New message' } });
      expect(onChange).toHaveBeenCalledWith('New message');
    });
  });

  describe('send button', () => {
    it.each([
      ['empty', '', true],
      ['whitespace only', '   ', true],
      ['with content', 'Hello', false],
    ])('is disabled=%s when value is %s', (_label, value, shouldBeDisabled) => {
      render(<ChatInput {...defaultProps} value={value} />);
      const btn = screen.getByRole('button', { name: /send/i });
      shouldBeDisabled ? expect(btn).toBeDisabled() : expect(btn).toBeEnabled();
    });

    it('calls onSend when clicked', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);
      await user.click(screen.getByRole('button', { name: /send/i }));
      expect(onSend).toHaveBeenCalled();
    });
  });

  describe('keyboard handling', () => {
    it('calls onSend on Enter', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);
      await user.click(screen.getByPlaceholderText('Type a message...'));
      await user.keyboard('{Enter}');
      expect(onSend).toHaveBeenCalled();
    });

    it('does not call onSend on Shift+Enter', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput {...defaultProps} value="Hello" onSend={onSend} />);
      await user.click(screen.getByPlaceholderText('Type a message...'));
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      expect(onSend).not.toHaveBeenCalled();
    });

    it.each([
      ['empty value', '', false],
      ['disabled', 'Hello', true],
    ])('does not call onSend on Enter when %s', async (_label, value, disabled) => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput {...defaultProps} value={value} onSend={onSend} disabled={disabled || undefined} />);
      const input = screen.getByPlaceholderText('Type a message...');
      if (disabled) {
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      } else {
        await user.click(input);
        await user.keyboard('{Enter}');
      }
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('disables both input and send button', () => {
      render(<ChatInput {...defaultProps} value="Hello" disabled />);
      expect(screen.getByPlaceholderText('Type a message...')).toBeDisabled();
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });
  });

  describe('textarea behavior', () => {
    it('starts with single row and is not resizable', () => {
      const { container } = render(<ChatInput {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement;
      expect(textarea.rows).toBe(1);
      expect(container.querySelector('textarea')?.className).toContain('resize-none');
    });
  });

  describe('mic button', () => {
    const mockSpeechRecognition = vi.fn(() => ({
      continuous: false, interimResults: false, lang: '',
      start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
      onresult: null, onerror: null, onend: null,
    }));

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => {
      delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
      delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    });

    it('does not render when speech recognition unsupported', () => {
      delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
      delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      render(<ChatInput {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /voice/i })).not.toBeInTheDocument();
    });

    it('renders and is functional when speech recognition supported', async () => {
      const mockStart = vi.fn();
      function MockSpeech(this: any) {
        this.continuous = false; this.interimResults = false; this.lang = '';
        this.start = mockStart; this.stop = vi.fn(); this.abort = vi.fn();
        this.onresult = null; this.onerror = null; this.onend = null;
      }
      window.SpeechRecognition = MockSpeech as unknown as typeof SpeechRecognition;

      const user = userEvent.setup();
      render(<ChatInput {...defaultProps} />);

      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: /start voice input/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /start voice input/i }));
      expect(mockStart).toHaveBeenCalled();
    });

    it('mic button disabled when input disabled', async () => {
      window.SpeechRecognition = mockSpeechRecognition as unknown as typeof SpeechRecognition;
      render(<ChatInput {...defaultProps} disabled />);
      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: /start voice input/i })).toBeDisabled();
      });
    });
  });
});
