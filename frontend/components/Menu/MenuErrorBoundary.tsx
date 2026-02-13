/**
 * Menu Error Boundary Component
 * Specialized error boundary for menu management with menu-specific fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Undo2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  onGoBack?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class MenuErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MenuErrorBoundary caught an error:', error, errorInfo);
    
    // Log to monitoring service
    this.logErrorToService(error, errorInfo);
    
    this.setState({ errorInfo });
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In production, send to error monitoring service
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'menu_error',
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        })
      }).catch(console.error);
    }
  };

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1
    }));
    
    this.props.onRetry?.();
  };

  handleGoBack = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    this.props.onGoBack?.();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-white dark:bg-surface-800 rounded-2xl shadow-lg border border-gray-200 dark:border-surface-700 p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center text-surface-900 dark:text-surface-100 mb-3">
              Menu Loading Error
            </h2>

            {/* Description */}
            <p className="text-center text-surface-600 dark:text-surface-400 mb-6">
              Something went wrong while loading the menu. This might be a temporary issue.
            </p>

            {/* Error Details (collapsed by default) */}
            {this.state.error && (
              <details className="mb-6">
                <summary className="cursor-pointer text-sm font-medium text-surface-700 dark:text-surface-300 hover:text-primary-600">
                  View Error Details
                </summary>
                <div className="mt-3 p-4 bg-gray-100 dark:bg-surface-900 rounded-lg">
                  <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-surface-500 overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Retry Count Warning */}
            {this.state.retryCount >= 3 && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Multiple retry attempts failed. Consider refreshing the page or contacting support.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-6 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={this.handleGoBack}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Undo2 className="w-4 h-4" />
                  Go Back
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Refresh Page
                </button>
              </div>
            </div>

            {/* Timestamp */}
            <p className="mt-6 text-center text-xs text-surface-400">
              Error occurred at {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap menu components with error boundary
 */
export function withMenuErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WithMenuErrorBoundary(props: P) {
    return (
      <MenuErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </MenuErrorBoundary>
    );
  };
}

export default MenuErrorBoundary;
