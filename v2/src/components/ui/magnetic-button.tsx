import * as React from "react";

/**
 * MagneticButton, now a plain wrapper. It used to pull its button toward the
 * pointer; a button that moves when you approach it is harder to press, and
 * the site no longer moves on its own (Oct 14 2026).
 */
interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  /** Accepted and ignored. */
  strength?: number;
  /** Accepted and ignored. */
  radius?: number;
}

export function MagneticButton({ children, className }: MagneticButtonProps) {
  return <div className={className}>{children}</div>;
}
