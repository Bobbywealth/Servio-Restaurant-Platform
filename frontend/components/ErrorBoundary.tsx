'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full bg-[var(--tablet-surface)] border border-[var(--tablet-border)] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-[var(--tablet-muted)] mb-4">
              We encountered an error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-sm text-[var(--tablet-muted)] cursor-pointer">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-[var(--tablet-border)] rounded-lg text-xs overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 bg-[var(--tablet-accent)] text-[var(--tablet-accent-contrast)] rounded-lg font-semibold"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
