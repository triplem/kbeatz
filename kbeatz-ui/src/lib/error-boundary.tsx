import { Component, type ReactNode, type ErrorInfo } from 'react'
import { useTranslation } from 'react-i18next'
import { logger } from './logger'

// Internal props used by the class component. `t` is injected by the thin
// functional wrapper below so the class never imports a hook directly.
interface ErrorBoundaryInternalProps {
  children: ReactNode
  fallback?: ReactNode
  t: (key: string) => string
}

interface ErrorBoundaryState {
  hasError: boolean
}

// Public props that callers pass to <ErrorBoundary>.
export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

class ErrorBoundaryBase extends Component<ErrorBoundaryInternalProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInternalProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error(
      { err: error.message, componentStack: info.componentStack },
      'react_render_error',
    )
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    const { t, children, fallback } = this.props
    const { hasError } = this.state

    if (!hasError) {
      return children
    }

    if (fallback !== undefined) {
      return fallback
    }

    return (
      <div role="alert" data-testid="error-boundary-fallback">
        <p>{t('errorBoundary.message')}</p>
        <button type="button" onClick={this.handleReload}>
          {t('errorBoundary.reloadButton')}
        </button>
      </div>
    )
  }
}

// Thin functional wrapper: uses the project-standard useTranslation hook and
// injects `t` into the class component. Callers import only ErrorBoundary.
export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps): ReactNode {
  const { t } = useTranslation()
  return (
    <ErrorBoundaryBase t={t} fallback={fallback}>
      {children}
    </ErrorBoundaryBase>
  )
}
