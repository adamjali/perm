/**
 * EmptyState Component
 *
 * Generic empty state pattern for any empty list/content scenario.
 * Provides consistent structure: icon or illustration, heading, description, and optional CTA.
 *
 * Features:
 * - Customizable icon or SVG illustration
 * - Background image with subtle tint
 * - Flexible heading and description
 * - Optional action button or link
 * - Neobrutalist styling
 * - Dark mode support
 *
 * @see v2/docs/DESIGN_SYSTEM.md
 */

import * as React from "react";
import Image from "next/image";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  heading: string;
  description: string;
  bgImage?: string;
  accentColor?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  "data-testid"?: string;
}

export function EmptyState({
  icon: Icon,
  illustration,
  heading,
  description,
  bgImage,
  accentColor,
  action,
  "data-testid": testId,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="group relative flex flex-col items-center justify-center py-20 px-6 border-4 border-border bg-background shadow-hard overflow-hidden"
    >
      {/* Background image - subtle tint */}
      {bgImage && (
        <div className="absolute inset-0 opacity-[0.04] transition-opacity duration-500 group-hover:opacity-[0.07]">
          <Image
            src={bgImage}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Decorative corner accent */}
      {accentColor && (
        <div
          className="absolute -top-6 -right-6 h-16 w-16 rotate-45 opacity-10"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
      )}

      {/* Illustration or Icon */}
      <div className="relative mb-6" aria-hidden="true">
        {illustration ? (
          <div className="flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
            {illustration}
          </div>
        ) : Icon ? (
          <div className="p-6 border-4 border-border bg-muted shadow-hard-sm">
            <Icon className="size-24 text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : null}
      </div>

      <h2 className="relative font-heading text-2xl font-bold mb-2">{heading}</h2>

      <p className="relative text-muted-foreground text-center max-w-md mb-6">
        {description}
      </p>

      {action && (
        <div className="relative">
          {action.onClick ? (
            <Button onClick={action.onClick} size="lg" className="bg-primary">
              {action.label}
            </Button>
          ) : action.href ? (
            <Button asChild size="lg" className="bg-primary">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
