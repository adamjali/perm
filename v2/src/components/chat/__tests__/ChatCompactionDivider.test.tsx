// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatCompactionDivider } from '../ChatCompactionDivider';

describe('ChatCompactionDivider', () => {
  describe('label', () => {
    it('renders with singular "message" when count is 1', () => {
      render(<ChatCompactionDivider messageCount={1} summary="hello" />);
      expect(screen.getByText(/1 message$/i)).toBeInTheDocument();
    });

    it('renders with plural "messages" for count > 1', () => {
      render(<ChatCompactionDivider messageCount={14} summary="hello" />);
      expect(screen.getByText(/14 messages$/i)).toBeInTheDocument();
    });

    it('always shows the "Earlier context archived" small-caps label', () => {
      render(<ChatCompactionDivider messageCount={5} summary="hello" />);
      expect(screen.getByText(/earlier context archived/i)).toBeInTheDocument();
    });
  });

  describe('role & accessibility', () => {
    it('exposes a separator role with descriptive aria-label', () => {
      render(<ChatCompactionDivider messageCount={7} summary="test" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveAttribute(
        'aria-label',
        'Earlier 7 messages archived',
      );
    });

    it('toggle button has aria-expanded reflecting state', () => {
      render(<ChatCompactionDivider messageCount={7} summary="test" />);
      const toggle = screen.getByRole('button');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('expand / collapse', () => {
    it('shows prose summary when expanded', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary="a detailed recap of earlier turns"
        />,
      );
      expect(screen.queryByText(/a detailed recap/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/a detailed recap/)).toBeInTheDocument();
    });

    it('collapses again on second click', () => {
      render(<ChatCompactionDivider messageCount={5} summary="content here" />);
      const btn = screen.getByRole('button');
      fireEvent.click(btn);
      expect(screen.getByText(/content here/)).toBeInTheDocument();
      fireEvent.click(btn);
      // AnimatePresence exit animation — check aria-expanded instead
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });

    it('disables the toggle when there is no summary and no facts', () => {
      render(<ChatCompactionDivider messageCount={5} summary="" />);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
    });

    it('is expandable when only facts are present (no prose)', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary=""
          facts={{ cases: ['X-1'] }}
        />,
      );
      const btn = screen.getByRole('button');
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(screen.getByText(/X-1/)).toBeInTheDocument();
    });
  });

  describe('facts rendering', () => {
    it('renders case IDs', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary="sum"
          facts={{ cases: ['JOHN-DOE-AMZN', { id: 'JANE-GOOG', status: 'pending' }] }}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/JOHN-DOE-AMZN/)).toBeInTheDocument();
      expect(screen.getByText(/JANE-GOOG \(pending\)/)).toBeInTheDocument();
    });

    it('renders people with roles', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary="sum"
          facts={{
            people: [
              { name: 'John Doe', role: 'beneficiary' },
              { name: 'Jane Smith' },
            ],
          }}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(
        screen.getByText(/John Doe \(beneficiary\) · Jane Smith/),
      ).toBeInTheDocument();
    });

    it('renders dates', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary="sum"
          facts={{ dates: { pwdFiling: '2024-06-15', recruitment: '2024-09-01' } }}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(
        screen.getByText(/pwdFiling 2024-06-15 · recruitment 2024-09-01/),
      ).toBeInTheDocument();
    });

    it('accepts facts as a JSON string', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary="sum"
          facts={JSON.stringify({ cases: ['A-1'] })}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/A-1/)).toBeInTheDocument();
    });

    it('gracefully handles invalid facts JSON', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary="prose works"
          facts={'{not valid'}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/prose works/)).toBeInTheDocument();
      // No "KEY FACTS" heading because no valid facts parsed
      expect(screen.queryByText(/key facts/i)).not.toBeInTheDocument();
    });

    it('does not render empty fact categories', () => {
      render(
        <ChatCompactionDivider
          messageCount={5}
          summary="sum"
          facts={{ cases: ['X-1'], people: [], dates: {}, preferences: [] }}
        />,
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/X-1/)).toBeInTheDocument();
      expect(screen.queryByText(/People/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Dates/)).not.toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('merges custom className with defaults', () => {
      const { container } = render(
        <ChatCompactionDivider
          messageCount={5}
          summary="sum"
          className="custom-class-xyz"
        />,
      );
      expect(
        container.querySelector('[data-testid="chat-compaction-divider"]'),
      ).toHaveClass('custom-class-xyz');
    });
  });
});
