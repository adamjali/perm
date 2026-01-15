/**
 * EmptyState Component
 *
 * Generic empty state pattern for any empty list/content scenario.
 * Provides consistent structure: icon, heading, description, and optional CTA.
 *
 * Features:
 * - Customizable icon
 * - Flexible heading and description
 * - Optional action button or link
 * - Neobrutalist styling
 * - Dark mode support
 *
 * @see v2/docs/DESIGN_SYSTEM.md
 */

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  "data-testid"?: string;
}

export function EmptyState({
  icon: Icon,
  heading,
  description,
  action,
  "data-testid": testId,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center justify-center py-20 px-6 border-4 border-border bg-background shadow-hard"
    >
      <div
        className="mb-6 p-6 border-4 border-border bg-muted shadow-hard-sm"
        aria-hidden="true"
      >
        <Icon className="size-24 text-muted-foreground" strokeWidth={1.5} />
      </div>

      <h2 className="font-heading text-2xl font-bold mb-2">{heading}</h2>

      <p className="text-muted-foreground text-center max-w-md mb-6">
        {description}
      </p>

      {action && (
        <>
          {action.onClick ? (
            <Button onClick={action.onClick} size="lg" className="bg-primary">
              {action.label}
            </Button>
          ) : action.href ? (
            <Button asChild size="lg" className="bg-primary">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
