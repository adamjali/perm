// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from '../ChatPanel';
import type { DisplayMessage } from '@/hooks/useChatWithPersistence';

/**
 * A limit that ends or refuses a turn says which limit and what to do. Before
 * Sep 29 2026 a capped reply just stopped, and every refused turn read "The AI
 * services didn't respond" whatever the server had said.
 */

const base = {
  input: '',
  onInputChange: () => {},
  onSend: () => {},
  onClose: () => {},
};

const convo = (last: Partial<DisplayMessage>): DisplayMessage[] => [
  { id: 'u1', role: 'user', content: 'list every case' },
  { id: 'a1', role: 'assistant', content: 'Here are the first', ...last },
];

describe('ChatPanel limits', () => {
  it('says why a reply stopped at the output cap, with a Continue button', () => {
    const onContinue = vi.fn();
    render(<ChatPanel {...base} status="ready" messages={convo({ cutShort: 'length' })} onContinue={onContinue} />);
    expect(screen.getByText(/hit the length limit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('names the step cap the same way', () => {
    render(<ChatPanel {...base} status="ready" messages={convo({ cutShort: 'steps' })} onContinue={() => {}} />);
    expect(screen.getByText(/stopped after 10 tool steps/)).toBeInTheDocument();
  });

  it('keeps the reason but drops Continue once a newer message follows, or while a reply runs', () => {
    const later: DisplayMessage[] = [...convo({ cutShort: 'length' }), { id: 'u2', role: 'user', content: 'thanks' }];
    const { rerender } = render(<ChatPanel {...base} status="ready" messages={later} onContinue={() => {}} />);
    expect(screen.getByText(/hit the length limit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();

    rerender(<ChatPanel {...base} status="submitted" messages={convo({ cutShort: 'length' })} onContinue={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('shows the server\'s own refusal with its wait, not "the AI services didn\'t respond"', () => {
    const error = new Error(
      JSON.stringify({ error: 'rate_limited', message: 'Too many chat messages from this network in the last minute. Try again in 39 seconds.', retryAfter: 39 }),
    );
    render(<ChatPanel {...base} status="error" messages={convo({})} error={error} />);
    expect(screen.getByText(/Try again in 39 seconds/)).toBeInTheDocument();
    expect(screen.queryByText(/AI services didn/)).not.toBeInTheDocument();
  });

  it('keeps the plain message for a failure it cannot read', () => {
    render(<ChatPanel {...base} status="error" messages={convo({})} error={new Error('Failed to fetch')} />);
    expect(screen.getByText(/AI services didn/)).toBeInTheDocument();
  });
});

describe('ChatPanel long conversations', () => {
  const long: DisplayMessage[] = Array.from({ length: 75 }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i + 1}`,
  }));

  it('shows the latest page and a button for the earlier messages, with the count', () => {
    render(<ChatPanel {...base} status="ready" messages={long} />);
    expect(screen.getByText('Message 75')).toBeInTheDocument();
    expect(screen.getByText('Message 16')).toBeInTheDocument();
    expect(screen.queryByText('Message 15')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show 15 earlier messages' }));
    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /earlier messages/ })).not.toBeInTheDocument();
  });

  it('keeps the compaction divider at its message when the page starts after it', () => {
    render(
      <ChatPanel
        {...base}
        status="ready"
        messages={long}
        summaryMetadata={{ messageCountAtSummary: 40, summary: 'Earlier talk', facts: null }}
      />,
    );
    // Message 41 is index 40: the divider sits right before it, on the page.
    const divider = screen.getByLabelText('Earlier 40 messages archived');
    const next = screen.getByText('Message 41');
    expect(divider.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
