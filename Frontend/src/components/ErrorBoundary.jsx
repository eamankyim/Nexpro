import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hasChunkLoadError } from '../utils/chunkLoadError';

/**
 * Error Boundary Component
 *
 * Catches React errors in the component tree and displays a fallback UI.
 * Prevents the entire app from crashing when an error occurs.
 * For chunk load errors (e.g. after deploy), prompts user to refresh.
 *
 * @example
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this._isHandlingError = false;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Prevent infinite loops by checking if we're already handling an error
    if (this._isHandlingError) {
      return;
    }

    this._isHandlingError = true;
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Use setTimeout to defer setState outside of the commit phase
    // This prevents "Maximum update depth exceeded" errors
    setTimeout(() => {
      try {
        this.setState({ error, errorInfo });
      } catch (e) {
        // If setState fails, log but don't crash
        console.error('ErrorBoundary: Failed to update state:', e);
      } finally {
        this._isHandlingError = false;
      }
    }, 0);
  }

  handleReset = () => {
    this._isHandlingError = false;
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const chunkError = hasChunkLoadError(this.state.error);
    const isDev = import.meta.env.DEV;
    const title = chunkError
      ? isDev
        ? 'Could not load page module'
        : 'New version available'
      : 'Something went wrong';
    const message = chunkError
      ? isDev
        ? 'The dev server may have restarted on a different port, or another Vite instance is still running. Open the URL shown in your terminal (usually http://localhost:3000), stop duplicate "npm run dev" processes, hard-refresh (Cmd+Shift+R), and clear site data for localhost if this persists.'
        : 'A new version of the app is available. Please refresh the page to load the latest version.'
      : "We're sorry, but something unexpected happened. Our team has been notified and is working to fix the issue.";

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
        <Card className="max-w-2xl w-full border-red-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-foreground">{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{message}</p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto text-gray-800">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack && (
                      <div className="mt-2">
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </pre>
                </details>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                onClick={chunkError ? this.handleRefresh : this.handleReset}
                variant="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {chunkError ? 'Refresh page' : 'Try Again'}
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
