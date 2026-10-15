'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';
import { ScrollBox } from "@/components/ui/scroll-box";

interface ChatMarkdownProps {
  content: string;
  /** Whether this is a user message (affects link colors) */
  isUser?: boolean;
}

/**
 * The markdown renderer for chat messages.
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
              'block font-mono text-sm',
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
            'font-mono text-sm px-1.5 py-0.5',
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
          'my-2 p-3 overflow-x-auto overscroll-x-none',
          'border-current/20 border',
          'font-mono text-sm leading-relaxed',
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
          'hover:decoration-primary-text',
          'transition-colors duration-150',
          isUser
            ? 'decoration-current/50 hover:decoration-current'
            : 'decoration-primary/50 hover:decoration-primary-text'
        )}
      >
        {children}
      </a>
    ),

    // Lists use the browser's own markers. react-markdown 10 no longer tells a
    // list item whether its list is numbered, so a custom marker drew numbered
    // steps as bullets.
    ul: ({ children }) => (
      <ul className={cn('my-2 ml-5 space-y-1 list-disc', isUser ? 'marker:text-current' : 'marker:text-primary-text')}>
        {children}
      </ul>
    ),

    ol: ({ children, start }) => (
      <ol
        start={start}
        className={cn('my-2 ml-5 space-y-1 list-decimal marker:font-bold', isUser ? 'marker:text-current' : 'marker:text-primary-text')}
      >
        {children}
      </ol>
    ),

    li: ({ children }) => <li className="pl-1">{children}</li>,

    // An image is shown as a link, never loaded: a reply can quote a web page
    // or a note, and loading an image from any address would let such text
    // send the conversation's details to that address in the image's URL.
    img: ({ src, alt }) =>
      typeof src === 'string' && /^https:\/\//i.test(src) ? (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="link"
        >
          {alt ? `Image: ${alt}` : 'Image link'}
        </a>
      ) : (
        <span>{alt ? `[Image: ${alt}]` : '[Image]'}</span>
      ),

    // Tables
    table: ({ children }) => (
      <ScrollBox label="A table in the reply" className="my-2 overscroll-x-none">
        <table
          className={cn(
            'w-full text-sm',
            'border-collapse border',
            isUser ? 'border-current/30' : 'border-border'
          )}
        >
          {children}
        </table>
      </ScrollBox>
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
        {children}{" "}
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
      {" "}</td>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          // A thin neutral rule: the conventional quote mark, not a colored bar.
          'my-2 pl-3 border-l-2 border-current/40',
          'italic opacity-90'
        )}
      >
        {children}
      </blockquote>
    ),

    // Horizontal rules
    hr: () => (
      <hr
        className={cn(
          'my-3 border-t-2 border-border',
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
