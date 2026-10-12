// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * The history list grows with every conversation the person starts, so it
 * shows a page at a time, says how many there are, and says how many are left.
 */

const many = Array.from({ length: 73 }, (_, i) => ({
  _id: `c${i}`,
  title: `Conversation ${i + 1}`,
  updatedAt: Date.UTC(2026, 8, 29) - i * 60_000,
}));
let list: typeof many = many;

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => list),
  useMutation: vi.fn(() => vi.fn()),
}));
vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuthContext: () => ({ isSigningOut: false }),
}));

import { ChatHistory } from '../ChatHistory';

const props = {
  isOpen: true,
  onClose: () => {},
  currentConversationId: null,
  onSelectConversation: () => {},
  onNewConversation: () => {},
};

describe('ChatHistory', () => {
  it('shows the first page, the total, and a button for the rest', () => {
    list = many;
    render(<ChatHistory {...props} />);
    expect(screen.getByText('73 conversations')).toBeInTheDocument();
    expect(screen.getByText('Conversation 30')).toBeInTheDocument();
    expect(screen.queryByText('Conversation 31')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show 30 more (43 left)' }));
    expect(screen.getByText('Conversation 60')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show 13 more' }));
    expect(screen.getByText('Conversation 73')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument();
  });

  it('shows no paging for a short list', () => {
    list = many.slice(0, 3);
    render(<ChatHistory {...props} />);
    expect(screen.getByText('3 conversations')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument();
  });

  it('keeps the delete button reachable without a mouse', () => {
    list = many.slice(0, 1);
    render(<ChatHistory {...props} />);
    const del = screen.getByRole('button', { name: 'Delete conversation Conversation 1' });
    // Shown on keyboard focus and on touch screens, not only on hover.
    expect(del.parentElement!.className).toMatch(/group-focus-within:opacity-100/);
    expect(del.parentElement!.className).toMatch(/max-md:opacity-100/);
  });

  // A keyboard can open a past conversation: each row is a button (they were
  // clickable divs), and the open one says so (Oct 12 2026).
  it('opens a conversation from a button, and marks the current one', () => {
    list = many.slice(0, 2);
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<ChatHistory {...props} currentConversationId={'c1' as never} onSelectConversation={onSelect} onClose={onClose} />);
    const row = screen.getByRole('button', { name: /^Conversation 1 / });
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('c0');
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Conversation 2 / })).toHaveAttribute('aria-current', 'true');
  });

  it('is a dialog named Chat history that Escape closes', () => {
    list = many.slice(0, 2);
    const onClose = vi.fn();
    render(<ChatHistory {...props} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Chat history' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('says when it lists only the newest conversations', () => {
    list = Array.from({ length: 200 }, (_, i) => ({ _id: `c${i}`, title: `Conversation ${i + 1}`, updatedAt: Date.UTC(2026, 8, 29) - i * 60_000 }));
    render(<ChatHistory {...props} />);
    expect(screen.getByText('Your 200 most recent conversations')).toBeInTheDocument();
  });
});
