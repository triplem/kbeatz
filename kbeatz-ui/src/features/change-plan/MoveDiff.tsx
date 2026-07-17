import { useTranslation } from 'react-i18next'
import { Text } from '@astryxdesign/core/Text'
import type { DirectoryMove } from '../../api/generated'

interface MoveDiffProps {
  /** The planned move, or null/undefined when the directory is already in place. */
  readonly move: DirectoryMove | null | undefined
}

/**
 * MoveDiff - renders a single release's directory relocation as a "from -> to"
 * pair, or an "already in place" note when no move is planned.
 *
 * Merged source directories (when several folders collapse into one target) are
 * listed below the primary source path.
 */
export function MoveDiff({ move }: MoveDiffProps) {
  const { t } = useTranslation()

  if (!move) {
    return (
      <p data-testid="move-diff-none" style={{ margin: 0 }}>
        <Text type="supporting">{t('changePlan.alreadyInPlace')}</Text>
      </p>
    )
  }

  return (
    <div data-testid="move-diff" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <p style={{ margin: 0, wordBreak: 'break-all' }}>
        <Text type="supporting">{t('changePlan.moveFrom')}: </Text>
        <span data-testid="move-from">
          <Text type="supporting">{move.fromPath}</Text>
        </span>
      </p>
      <p style={{ margin: 0, wordBreak: 'break-all' }}>
        <Text type="supporting">{t('changePlan.moveTo')}: </Text>
        <span data-testid="move-to">
          <Text type="supporting" weight="semibold">
            {move.toPath}
          </Text>
        </span>
      </p>
      {move.mergedFromPaths.length > 0 && (
        <ul data-testid="move-merged" style={{ margin: '4px 0 0', paddingLeft: 24 }}>
          <li style={{ listStyle: 'none', marginLeft: -16 }}>
            <Text type="supporting">{t('changePlan.mergedFrom')}:</Text>
          </li>
          {move.mergedFromPaths.map((path) => (
            <li key={path} style={{ wordBreak: 'break-all' }}>
              <Text type="supporting">{path}</Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
