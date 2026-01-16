'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';

interface ChatMarkdownProps {
  content: string;
  /** Whether this is a user message (affects link colors) */
  isUser?: boolean;
}

/**
 * Neo-brutalist styled markdown renderer for chat messages.
 * Supports full GitHub Flavored Markdown including:
 * - Bold, italic, strikethrough
 * - Inline code and code blocks
 * - Links
 * - Lists (ordered and unordered)
 * - Tables
 * - Blockquotes
 * - Horizontal rules
 */
export function ChatMarkdown({ content, isUser = false }: ChatMarkdownProps) {
  const components: Components = {
    // Bold text
    strong: ({ children }) => (
      <strong className="font-bold">{children}</strong>
    ),

    // Italic text
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),

    // Strikethrough
    del: ({ children }) => (
      <del className="line-through opacity-70">{children}</del>
    ),

    // Inline code
    code: ({ className, children, ...props }) => {
      // Check if this is a code block (has language class) or inline code
      const isCodeBlock = className?.includes('language-');

      if (isCodeBlock) {
        return (
          <code
            className={cn(
              'block font-mono text-xs',
              className
            )}
            {...props}
          >
            {children}
          </code>
        );
      }

      // Inline code
      return (
        <code
          className={cn(
            'font-mono text-xs px-1.5 py-0.5',
            'border border-current/30',
            isUser
              ? 'bg-black/10'
              : 'bg-muted'
          )}
          {...props}
        >
          {children}
        </code>
      );
    },

    // Code blocks (pre wrapper)
    pre: ({ children }) => (
      <pre
        className={cn(
          'my-2 p-3 overflow-x-auto',
          'border-2 border-current/20',
          'font-mono text-xs leading-relaxed',
          isUser
            ? 'bg-black/10'
            : 'bg-muted'
        )}
      >
        {children}
      </pre>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'underline underline-offset-2 decoration-2',
          'hover:decoration-primary',
          'transition-colors duration-150',
          isUser
            ? 'decoration-current/50 hover:decoration-current'
            : 'decoration-primary/50 hover:decoration-primary'
        )}
      >
        {children}
      </a>
    ),

    // Unordered lists
    ul: ({ children }) => (
      <ul className="my-2 ml-4 space-y-1 list-none">
        {children}
      </ul>
    ),

    // Ordered lists
    ol: ({ children }) => (
      <ol className="my-2 ml-4 space-y-1 list-none counter-reset-item">
        {children}
      </ol>
    ),

    // List items
    li: ({ children, ...props }) => {
      // Check if parent is ol or ul based on ordered prop
      const isOrdered = 'ordered' in props && props.ordered;

      return (
        <li className="relative pl-4">
          <span
            className={cn(
              'absolute left-0 top-0 font-bold',
              isUser ? 'text-current' : 'text-primary'
            )}
          >
            {isOrdered ? '→' : '•'}
          </span>
          {children}
        </li>
      );
    },

    // Tables
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table
          className={cn(
            'w-full text-xs',
            'border-2 border-collapse',
            isUser ? 'border-current/30' : 'border-border'
          )}
        >
          {children}
        </table>
      </div>
    ),

    thead: ({ children }) => (
      <thead
        className={cn(
          'font-heading font-bold',
          isUser ? 'bg-black/10' : 'bg-muted'
        )}
      >
        {children}
      </thead>
    ),

    tbody: ({ children }) => <tbody>{children}</tbody>,

    tr: ({ children }) => (
      <tr className={cn('border-b', isUser ? 'border-current/20' : 'border-border')}>
        {children}
      </tr>
    ),

    th: ({ children }) => (
      <th
        className={cn(
          'px-2 py-1.5 text-left',
          'border',
          isUser ? 'border-current/20' : 'border-border'
        )}
      >
        {children}
      </th>
    ),

    td: ({ children }) => (
      <td
        className={cn(
          'px-2 py-1.5',
          'border',
          isUser ? 'border-current/20' : 'border-border'
        )}
      >
        {children}
      </td>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          'my-2 pl-3 border-l-4',
          'italic opacity-90',
          isUser ? 'border-current/50' : 'border-primary'
        )}
      >
        {children}
      </blockquote>
    ),

    // Horizontal rules
    hr: () => (
      <hr
        className={cn(
          'my-3 border-t-2',
          isUser ? 'border-current/30' : 'border-border'
        )}
      />
    ),

    // Paragraphs
    p: ({ children }) => (
      <p className="my-1 first:mt-0 last:mb-0">{children}</p>
    ),

    // Headings (rare in chat but supported)
    h1: ({ children }) => (
      <h1 className="font-heading font-bold text-base mt-3 mb-1 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-heading font-bold text-sm mt-2 mb-1 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-heading font-semibold text-sm mt-2 mb-1 first:mt-0">
        {children}
      </h3>
    ),
  };

  return (
    <div className="break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
