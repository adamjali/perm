'use client';

import { useRef, useState, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

/**
 * Check if Web Speech API is supported in this browser.
 * Chrome/Edge use SpeechRecognition, Safari uses webkitSpeechRecognition.
 */
function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const cursorPositionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const [isRecording, setIsRecording] = useState(false);
  const [showMicButton, setShowMicButton] = useState(false);

  // Check for speech recognition support on mount (avoid hydration mismatch)
  useEffect(() => {
    setShowMicButton(isSpeechSupported());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);

    // Reset height to auto to recalculate
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  /**
   * Insert transcript at the saved cursor position.
   */
  const insertTranscriptAtCursor = (transcript: string) => {
    const { start, end } = cursorPositionRef.current;
    const currentValue = value || '';

    // Insert with a space if there's content before and it doesn't end with whitespace
    const needsSpaceBefore = start > 0 && currentValue[start - 1] && !/\s$/.test(currentValue.slice(0, start));
    const textToInsert = needsSpaceBefore ? ' ' + transcript : transcript;

    const newValue =
      currentValue.substring(0, start) +
      textToInsert +
      currentValue.substring(end);

    onChange(newValue);

    // Move cursor after inserted text and update textarea height
    const newCursorPos = start + textToInsert.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;

        // Recalculate height after insertion
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    }, 0);

    // Update cursor position ref for next insertion
    cursorPositionRef.current = { start: newCursorPos, end: newCursorPos };
  };

  /**
   * Start speech recognition.
   */
  const startRecognition = () => {
    if (!isSpeechSupported() || disabled) return;

    // Cleanup any existing recognition session first
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    // Save current cursor position before starting
    if (textareaRef.current) {
      cursorPositionRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Get only new results since last event
      const newResults = Array.from({ length: event.results.length - event.resultIndex })
        .map((_, i) => event.results[event.resultIndex + i])
        .filter((result): result is SpeechRecognitionResult => result !== undefined && result.isFinal)
        .map(result => result[0]?.transcript ?? '')
        .join('');

      if (newResults.trim()) {
        insertTranscriptAtCursor(newResults);
        // Note: cursor position is updated inside insertTranscriptAtCursor
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    // Handle errors during start (e.g., permission denied, service unavailable)
    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      recognitionRef.current = null;
      setIsRecording(false);
    }
  };

  /**
   * Stop speech recognition.
   */
  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  /**
   * Toggle speech recognition on/off.
   */
  const toggleRecognition = () => {
    if (isRecording) {
      stopRecognition();
    } else {
      startRecognition();
    }
  };

  return (
    <div className="flex gap-2 p-3 border-t-2 border-border bg-background">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className={cn(
          'flex-1 resize-none px-3 py-2 text-sm',
          'border-2 border-border bg-background rounded-none',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0',
          'placeholder:text-muted-foreground',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      />

      {/* Mic Button - Only show if speech recognition is supported */}
      {showMicButton && (
        <Button
          onClick={toggleRecognition}
          disabled={disabled}
          size="icon"
          variant={isRecording ? 'destructive' : 'outline'}
          className="shrink-0 shadow-hard-sm"
          aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      )}

      <Button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        size="icon"
        className="shrink-0 shadow-hard-sm"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
