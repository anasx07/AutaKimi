import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Clipboard } from 'lucide-react'
import { Button } from './Button'

interface Props {
  children?: ReactNode
  /** Optional label shown in the fallback to identify which section crashed, e.g. "Library" */
  label?: string
  /** Fully custom fallback — overrides the built-in UI when set */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  showStack: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showStack: false
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, showStack: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, showStack: false })
  }

  private toggleStack = () => {
    this.setState((s) => ({ showStack: !s.showStack }))
  }

  private copyToClipboard = () => {
    const { error } = this.state
    if (!error) return
    const text = `Error: ${error.message}\n\nStack:\n${error.stack ?? 'unavailable'}`
    navigator.clipboard.writeText(text).catch(() => {})
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const { error, showStack } = this.state
      const { label } = this.props

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-background text-center">
          <div className="flex flex-col items-center gap-4 max-w-md w-full">
            {/* Icon */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-destructive/10 blur-xl" />
              <AlertTriangle className="relative h-12 w-12 text-destructive" />
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">
                {label ? `${label} ran into a problem` : 'Something went wrong'}
              </h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. You can try again or restart the app if it persists.
              </p>
            </div>

            {/* Error message */}
            {error?.message && (
              <div className="w-full rounded-md bg-muted/50 border border-border px-4 py-3 text-left">
                <p className="text-sm text-foreground font-mono break-words">{error.message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={this.handleReset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button variant="outline" onClick={this.copyToClipboard} className="gap-2">
                <Clipboard className="h-4 w-4" />
                Copy Error
              </Button>
            </div>

            {/* Collapsible stack trace */}
            {error?.stack && (
              <div className="w-full text-left">
                <button
                  onClick={this.toggleStack}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showStack ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {showStack ? 'Hide' : 'Show'} stack trace
                </button>
                {showStack && (
                  <pre className="mt-2 text-[10px] text-muted-foreground bg-muted/40 border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
