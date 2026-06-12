import { Component, type ReactNode, type ErrorInfo } from 'react'
import { withTranslation, type WithTranslation } from 'react-i18next'

const logger = {
  error: (ctx: object, msg: string) => {
    console.error(JSON.stringify({ level: 'error', ...ctx, msg }))
  },
}

interface ErrorBoundaryProps extends WithTranslation {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryBase extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
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

export const ErrorBoundary = withTranslation()(ErrorBoundaryBase)
