import type { MouseEventHandler, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './dismissible-banner.module.css'

interface DismissibleBannerProps {
  children: ReactNode
  onDismiss: MouseEventHandler<HTMLButtonElement>
  className?: string
  role?: 'status' | 'alert'
}

export function DismissibleBanner({
  children,
  onDismiss,
  className,
  role = 'status',
}: DismissibleBannerProps) {
  const { t } = useTranslation()

  return (
    <div className={`${styles.banner}${className !== undefined ? ` ${className}` : ''}`} role={role}>
      <span className={styles.content}>{children}</span>
      <button
        type="button"
        className={styles.dismissButton}
        aria-label={t('common.dismiss')}
        onClick={onDismiss}
      >
        {'×'}
      </button>
    </div>
  )
}
