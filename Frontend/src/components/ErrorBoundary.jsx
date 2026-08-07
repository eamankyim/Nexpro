import React from 'react';
import { AlertTriangle, Smile, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hasChunkLoadError } from '../utils/chunkLoadError';

/**
 * Error Boundary Component
 *
 * Catches React errors in the component tree and displays a fallback UI.
 * Prevents the entire app from crashing when an error occurs.
 * For chunk load errors (e.g. after deploy), shows a friendly update prompt.
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
      updating: false,
    };
    this._isHandlingError = false;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (this._isHandlingError) {
      return;
    }

    this._isHandlingError = true;
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    setTimeout(() => {
      try {
        this.setState({ error, errorInfo });
      } catch (e) {
        console.error('ErrorBoundary: Failed to update state:', e);
      } finally {
        this._isHandlingError = false;
      }
    }, 0);
  }

  handleReset = () => {
    this._isHandlingError = false;
    this.setState({ hasError: false, error: null, errorInfo: null, updating: false });
  };

  handleUpdate = () => {
    if (this.state.updating) return;
    this.setState({ updating: true });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const chunkError = hasChunkLoadError(this.state.error);
    const isDev = import.meta.env.DEV;

    if (chunkError && !isDev) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7]">
              <Smile className="h-7 w-7 text-[#166534]" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold text-foreground">New version of ABS is available</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We’ve improved ABS. Update now to keep using the latest version.
            </p>
            <Button
              type="button"
              className="mt-6 h-11 w-full bg-[#166534] text-base hover:bg-[#14532d]"
              disabled={this.state.updating}
              onClick={this.handleUpdate}
            >
              {this.state.updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update now'
              )}
            </Button>
          </div>
        </div>
      );
    }

    const title = chunkError ? 'Could not load page module' : 'Something went wrong';
    const message = chunkError
      ? 'The dev server may have restarted on a different port, or another Vite instance is still running. Open the URL shown in your terminal (usually http://localhost:3000), stop duplicate "npm run dev" processes, hard-refresh (Cmd+Shift+R), and clear site data for localhost if this persists.'
      : "We're sorry, but something unexpected happened. Our team has been notified and is working to fix the issue.";

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-2xl border-red-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-foreground">{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{message}</p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 rounded-lg bg-muted p-4">
                <details className="text-sm">
                  <summary className="mb-2 cursor-pointer font-semibold text-gray-700">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 overflow-auto text-xs text-gray-800">
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

            <div className="mt-6 flex gap-3">
              <Button onClick={chunkError ? this.handleUpdate : this.handleReset} variant="default">
                {chunkError ? 'Update now' : 'Try Again'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
