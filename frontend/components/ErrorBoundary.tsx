/**
 * Error Boundary Component
 * Catches React rendering errors and displays fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw, AlertTriangle, Mail } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showStack?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Update state
    this.setState({
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    window.location.href = '/'
  }

  handleReload = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-surface-800 rounded-2xl shadow-xl p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-center text-surface-900 dark:text-surface-100 mb-4">
              Something went wrong
            </h1>

            {/* Description */}
            <p className="text-center text-surface-600 dark:text-surface-400 mb-8">
              We encountered an unexpected error. Our team has been notified and will work to fix it.
            </p>

            {/* Error Details */}
            {this.state.error && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    Error Details
                  </h2>
                  {this.props.showStack && (
                    <button
                      onClick={() => this.setState(prev => ({
                        errorInfo: prev.errorInfo ? null : this.state.errorInfo
                      }))}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {this.state.errorInfo ? 'Hide Stack Trace' : 'Show Stack Trace'}
                    </button>
                  )}
                </div>
                <div className="bg-gray-100 dark:bg-surface-900 rounded-lg p-4">
                  <p className="text-sm font-mono text-surface-900 dark:text-surface-100 mb-2">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && this.props.showStack && (
                    <pre className="text-xs text-surface-600 dark:text-surface-400 overflow-auto max-h-64">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 px-6 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-200 dark:border-surface-600 text-surface-700 dark:text-surface-300 font-medium hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Contact Support
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-xs text-surface-500">
                Error ID: {this.state.error?.name || 'Unknown'} • {new Date().toISOString()}
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook to use Error Boundary in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    console.error('Error caught by hook:', error, errorInfo)
    setError(error)
  }

  return { error, handleError }
}

/**
 * Wrapper component for functional components
 */
export function withErrorHandler<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<Props, 'children'>
) {
  return function WithErrorHandler(props: P) {
    const [error, setError] = React.useState<Error | null>(null)

    const handleError = (err: Error, errorInfo: ErrorInfo) => {
      console.error('Error caught by withErrorHandler:', err, errorInfo)
      setError(err)
    }

    if (error) {
      return (
        <ErrorBoundary
          {...options}
          onError={handleError}
          showStack={options?.showStack ?? true}
        >
          {options?.fallback}
        </ErrorBoundary>
      )
    }

    return <Component {...props} />
  }
}
