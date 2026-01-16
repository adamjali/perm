'use client';

import { useRef, useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Mic, MicOff, Square } from 'lucide-react';
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
  onStop?: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isProcessing = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Track cursor position for voice input insertion
  const cursorPositionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const [isRecording, setIsRecording] = useState(false);
  const [showMicButton, setShowMicButton] = useState(false);

  /**
   * Resize textarea to fit content.
   * Uses scrollHeight with a max of 120px.
   */
  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  // Auto-resize when value changes (handles all update paths: typing, voice, paste, etc.)
  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

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

  // Handle textarea changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Resize is handled by useEffect on value change
  };

  // Track cursor position on selection change (for voice input insertion)
  const handleSelect = () => {
    if (textareaRef.current) {
      cursorPositionRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  };

  /**
   * Insert transcript at the current cursor position.
   * - Appends at cursor (or end if no focus)
   * - Only replaces text if user has selected/highlighted text
   * - Adds space before if needed for natural flow
   */
  const insertTranscriptAtCursor = useCallback((transcript: string) => {
    // Get fresh cursor position from textarea (most accurate)
    let start = cursorPositionRef.current.start;
    let end = cursorPositionRef.current.end;

    // If textarea is focused, use its current selection
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      start = textareaRef.current.selectionStart;
      end = textareaRef.current.selectionEnd;
    }

    const currentValue = value || '';

    // If cursor is at 0 and end is 0, and we have content, append to end
    // This handles the case where focus was lost
    if (start === 0 && end === 0 && currentValue.length > 0) {
      start = currentValue.length;
      end = currentValue.length;
    }

    // Determine if we need a space before the transcript
    // Add space if: there's content before AND it doesn't end with whitespace
    const needsSpaceBefore = start > 0 && !/\s$/.test(currentValue.slice(0, start));

    // Determine if we need a space after the transcript
    // Add space if: there's content after AND it doesn't start with whitespace
    const hasContentAfter = end < currentValue.length;
    const needsSpaceAfter = hasContentAfter && !/^\s/.test(currentValue.slice(end));

    // Build the text to insert
    let textToInsert = transcript;
    if (needsSpaceBefore) textToInsert = ' ' + textToInsert;
    if (needsSpaceAfter) textToInsert = textToInsert + ' ';

    // Build new value: before cursor + transcript + after cursor
    // If start !== end, user has selected text - this will replace it (expected behavior)
    const newValue =
      currentValue.substring(0, start) +
      textToInsert +
      currentValue.substring(end);

    // Update value via React state
    onChange(newValue);

    // Calculate new cursor position (after inserted text)
    const newCursorPos = start + textToInsert.length;

    // Use requestAnimationFrame to ensure React has updated the DOM
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
      }
      // Update cursor position ref for next insertion
      cursorPositionRef.current = { start: newCursorPos, end: newCursorPos };
    });
  }, [value, onChange]);

  /**
   * Start speech recognition.
   */
  const startRecognition = () => {
    if (!isSpeechSupported() || disabled || isProcessing) return;

    // Cleanup any existing recognition session first
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    // Save current cursor position before starting
    // This allows inserting at cursor when textarea loses focus to mic button
    if (textareaRef.current) {
      cursorPositionRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    } else {
      // If no textarea ref, default to end of current value
      const len = value?.length || 0;
      cursorPositionRef.current = { start: len, end: len };
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

  // Determine which button to show: Stop (during processing) or Send
  const showStopButton = isProcessing && onStop;

  return (
    <div className="flex gap-2 p-3 border-t-2 border-border bg-background">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onFocus={handleSelect}
        onClick={handleSelect}
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

      {/* Mic Button - Only show if speech recognition is supported and not processing */}
      {showMicButton && !isProcessing && (
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

      {/* Stop Button - Shows during AI processing */}
      {showStopButton ? (
        <Button
          onClick={onStop}
          size="icon"
          variant="destructive"
          className="shrink-0 shadow-hard-sm"
          aria-label="Stop generating"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      ) : (
        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className="shrink-0 shadow-hard-sm"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
