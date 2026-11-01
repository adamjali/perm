// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from '../ChatPanel';
import { ToolCallCard } from '../ToolCallCard';

/**
 * Room in the panel (owner, Oct 31 2026: "too small and cramped"): the not-legal-advice note folds behind an icon,
 * the mode strip carries no explaining line, and a finished tool step is one line with its inputs folded.
 */

const base = { input: '', onInputChange: () => {}, onSend: () => {}, onClose: () => {}, status: 'ready' as const, messages: [] };

describe('ChatPanel room', () => {
  it('folds the not-legal-advice note behind the title bar icon', () => {
    render(<ChatPanel {...base} />);
    expect(screen.queryByText(/not legal advice/)).not.toBeInTheDocument();
    const button = () => screen.getByRole('button', { name: 'About these answers' });
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button());
    // Looked up again: the test setup's stand-in for motion remounts the panel on each render.
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/not legal advice/)).toBeInTheDocument();
  });

  it('says what a mode means in its tooltip, not in a line under the strip', () => {
    render(<ChatPanel {...base} actionMode="confirm" onActionModeChange={() => {}} />);
    const ask = screen.getByRole('radio', { name: /Ask first/ });
    expect(ask).toHaveAttribute('title', 'Ask first: it shows each change and waits for your OK.');
    // Still read out to screen readers, never drawn.
    const line = screen.getByText('Ask first: it shows each change and waits for your OK.', { selector: 'p' });
    expect(line.className).toContain('sr-only');
  });
});

describe('ToolCallCard', () => {
  it('draws a finished step as one line, with its inputs folded under it', () => {
    const { container } = render(
      <ToolCallCard tool="queryCases" arguments={JSON.stringify({ caseStatus: 'eta9089', countOnly: true })} result={JSON.stringify({ count: 0 })} status="success" />,
    );
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(container.querySelector('summary')?.textContent).toMatch(/·/);
  });

  it('keeps the full card while a step runs', () => {
    const { container } = render(<ToolCallCard tool="queryCases" arguments="{}" status="pending" />);
    expect(container.querySelector('details')).toBeNull();
  });
});
