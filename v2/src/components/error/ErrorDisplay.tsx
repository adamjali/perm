/**
 * ErrorDisplay Component
 *
 * Generic error display with icon, message, and actions.
 * Reusable for any error scenario (route errors, API errors, validation errors).
 */

import * as React from "react";
import { type LucideIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive";
}

export interface ErrorDisplayProps {
  title: string;
  message: string;
  icon?: LucideIcon;
  actions?: ErrorAction[];
  details?: string;
  className?: string;
}

export function ErrorDisplay({
  title,
  message,
  icon: Icon = AlertTriangle,
  actions,
  details,
  className,
}: ErrorDisplayProps) {
  return (
    <div
      className={`flex min-h-[50vh] flex-col items-center justify-center gap-6 p-8 ${className || ""}`}
    >
      <div className="flex size-16 items-center justify-center rounded-lg border-2 border-destructive bg-destructive/10 shadow-hard-sm">
        <Icon className="size-8 text-destructive" />
      </div>

      <div className="text-center">
        <h2 className="font-heading text-xl font-bold text-foreground">
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
        {details && (
          <p className="mt-1 font-mono text-xs text-muted-foreground/60">
            {details}
          </p>
        )}
      </div>

      {actions && actions.length > 0 && (
        <div className="flex gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              variant={action.variant || (index === 0 ? "default" : "outline")}
              className="gap-2"
            >
              {action.icon && <action.icon className="size-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
