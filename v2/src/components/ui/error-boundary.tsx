"use client";

import { Component, type ReactNode } from "react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  /** Fallback UI to show when an error occurs */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI instead of crashing the entire app.
 *
 * @example
 * <ErrorBoundary>
 *   <SomeComponent />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary
 *   fallback={<div>Something went wrong</div>}
 *   onError={(error) => console.error(error)}
 * >
 *   <SomeComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 border-2 border-destructive bg-destructive/10 rounded-lg">
          <h2 className="font-heading text-xl font-bold text-destructive mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            An error occurred while loading this section.
            {process.env.NODE_ENV === "development" && this.state.error && (
              <span className="block mt-2 font-mono text-xs text-destructive">
                {this.state.error.message}
              </span>
            )}
          </p>
          <Button onClick={this.handleReset} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Dashboard-specific error fallback component
 */
export function DashboardErrorFallback({
  error,
  onRetry,
}: {
  error?: Error | null;
  onRetry?: () => void;
}): ReactNode {
  return (
    <div className="p-6 border-2 border-destructive bg-destructive/10 rounded-lg">
      <h2 className="font-heading text-xl font-bold text-destructive mb-2">
        Unable to load dashboard
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        There was a problem loading your dashboard data. Please try refreshing the page.
        {process.env.NODE_ENV === "development" && error && (
          <span className="block mt-2 font-mono text-xs text-destructive">
            {error.message}
          </span>
        )}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Try Again
        </Button>
      )}
    </div>
  );
}
