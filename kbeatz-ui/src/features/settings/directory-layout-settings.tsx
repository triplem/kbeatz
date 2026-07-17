import { type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '@astryxdesign/core/Banner'
import { Selector } from '@astryxdesign/core/Selector'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { Text } from '@astryxdesign/core/Text'
import { Heading } from '@astryxdesign/core/Heading'
import { Token } from '@astryxdesign/core/Token'
import type { Album, LayoutPreview } from '../../api/generated'
import { useLayoutSettings } from './useLayoutSettings'
import { useLayoutPreview } from './useLayoutPreview'
import { useAlbumOptions } from './useAlbumOptions'

const monoStyle: React.CSSProperties = { fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }

/** Build a human-readable label for an album option in the selector. */
function albumOptionLabel(album: Album): string {
  return album.albumArtist ? `${album.albumArtist} - ${album.album}` : album.album
}

interface PreviewResultProps {
  readonly preview: LayoutPreview
}

/**
 * Renders the outcome of a single album preview: a conflict alert when the planner
 * rejected the album, an "already in place" notice when nothing would move, or the
 * current -> planned directory mapping otherwise.
 */
function PreviewResult({ preview }: PreviewResultProps): ReactElement {
  const { t } = useTranslation()

  if (!preview.withinLibraryRoot) {
    return (
      <div data-testid="layout-preview-conflict">
        <Banner status="warning" title={preview.message ?? t('directoryLayout.conflict')} />
      </div>
    )
  }

  const alreadyInPlace = preview.plannedDirectory === preview.currentDirectory

  return (
    <div data-testid="layout-preview-result" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <Text type="supporting">{t('directoryLayout.currentDirectory')}</Text>
        <p style={monoStyle}>{preview.currentDirectory}</p>
      </div>
      <div>
        <Text type="supporting">{t('directoryLayout.plannedDirectory')}</Text>
        <p style={monoStyle}>{preview.plannedDirectory}</p>
      </div>
      {alreadyInPlace && (
        <div data-testid="layout-preview-in-place">
          <Banner status="success" title={t('directoryLayout.alreadyInPlace')} />
        </div>
      )}
    </div>
  )
}

interface AlbumPreviewProps {
  readonly albumId: string | null
}

/** Fetches and renders the preview for the selected album. */
function AlbumPreview({ albumId }: AlbumPreviewProps): ReactElement | null {
  const { t } = useTranslation()
  const { preview, isPending, isError } = useLayoutPreview(albumId)

  if (albumId === null) {
    return (
      <div data-testid="layout-preview-empty">
        <Text type="supporting">{t('directoryLayout.selectPrompt')}</Text>
      </div>
    )
  }
  if (isPending) {
    return <Skeleton height={64} data-testid="layout-preview-loading" />
  }
  if (isError || !preview) {
    return (
      <div data-testid="layout-preview-error">
        <Banner status="error" title={t('directoryLayout.previewError')} />
      </div>
    )
  }
  return <PreviewResult preview={preview} />
}

export type DirectoryLayoutSettingsProps = Record<string, never>

/**
 * Read-only directory-layout settings section.
 *
 * Shows the active operator-configured template and the tokens it supports (neither
 * is editable here), then lets the user pick an album to see a live preview of where
 * that album would be moved under the template, before any relayout runs.
 */
export function DirectoryLayoutSettings(): ReactElement {
  const { t } = useTranslation()
  const { settings, isPending: settingsPending, isError: settingsError } = useLayoutSettings()
  const { albums, isPending: albumsPending, isError: albumsError } = useAlbumOptions()
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)

  const albumOptions = [
    { value: '', label: t('directoryLayout.noAlbumSelected') },
    ...albums.map((album) => ({ value: album.id, label: albumOptionLabel(album) })),
  ]

  return (
    <div data-testid="directory-layout-settings" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
      <div>
        <Heading level={2}>{t('directoryLayout.heading')}</Heading>
        <Text type="supporting">{t('directoryLayout.description')}</Text>
      </div>

      {settingsError && <Banner status="error" title={t('directoryLayout.settingsError')} />}
      {settingsPending && !settingsError && (
        <Skeleton height={48} data-testid="layout-settings-loading" />
      )}
      {settings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text type="supporting">{t('directoryLayout.templateLabel')}</Text>
            <p data-testid="layout-template" style={monoStyle}>{settings.directoryTemplate}</p>
            <Text type="supporting">{t('directoryLayout.readOnlyNote')}</Text>
          </div>
          <div>
            <p style={{ margin: '0 0 4px' }}>
              <Text type="supporting">{t('directoryLayout.tokensLabel')}</Text>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {settings.supportedTokens.map((token) => (
                <span key={token} data-testid="layout-token">
                  <Token label={token} size="sm" color="gray" />
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <Selector
          label={t('directoryLayout.albumSelectLabel')}
          value={selectedAlbumId ?? ''}
          onChange={(v) => setSelectedAlbumId(v === '' ? null : v)}
          options={albumOptions}
          isDisabled={albumsPending || albumsError || albums.length === 0}
          {...(albumsError
            ? { status: { type: 'error' as const, message: t('directoryLayout.albumsError') } }
            : {})}
        />
      </div>

      <AlbumPreview albumId={selectedAlbumId} />
    </div>
  )
}
