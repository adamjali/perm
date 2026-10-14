import * as React from "react";

import type { AnimationDirection } from "@/lib/animations";

/**
 * ScrollReveal, now a plain wrapper.
 *
 * It used to fade and slide its children in as they scrolled into view. The
 * site moves only when the visitor does something (Oct 14 2026), so this
 * renders its element and children as they are. The props stay so the 36
 * callers didn't have to change at once; `direction`, `delay`, `stagger`,
 * `threshold` and `once` are accepted and ignored.
 */

type ElementType = "div" | "section" | "article" | "aside" | "main" | "header" | "footer";

export interface ScrollRevealProps {
  direction?: AnimationDirection;
  delay?: number;
  stagger?: boolean;
  threshold?: number;
  once?: boolean;
  children: React.ReactNode;
  className?: string;
  as?: ElementType;
}

export function ScrollReveal({ children, className, as = "div" }: ScrollRevealProps) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}

export interface ScrollRevealItemProps {
  children: React.ReactNode;
  className?: string;
  /** Accepted and ignored: nothing animates. */
  variants?: unknown;
}

export function ScrollRevealItem({ children, className }: ScrollRevealItemProps) {
  return <div className={className}>{children}</div>;
}
