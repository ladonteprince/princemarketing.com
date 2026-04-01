"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error?: Error };

/**
 * React error boundary that catches rendering errors in child components
 * and displays a friendly fallback UI instead of crashing the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development; in production this could go to an error service
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-coral/10">
              <AlertCircle className="text-coral" size={20} />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-cloud">
              Something went wrong
            </h3>
            <p className="mb-3 text-xs text-ash">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="cursor-pointer text-xs text-royal hover:underline"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
