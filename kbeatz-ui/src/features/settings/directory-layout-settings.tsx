import { type ReactElement, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Album, LayoutPreview } from '../../api/generated'
import { useLayoutSettings } from './useLayoutSettings'
import { useLayoutPreview } from './useLayoutPreview'
import { useAlbumOptions } from './useAlbumOptions'

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
      <Alert severity="warning" data-testid="layout-preview-conflict">
        {preview.message ?? t('directoryLayout.conflict')}
      </Alert>
    )
  }

  const alreadyInPlace = preview.plannedDirectory === preview.currentDirectory

  return (
    <Stack spacing={1} data-testid="layout-preview-result">
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t('directoryLayout.currentDirectory')}
        </Typography>
        <Typography variant="body2" component="p" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {preview.currentDirectory}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t('directoryLayout.plannedDirectory')}
        </Typography>
        <Typography variant="body2" component="p" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {preview.plannedDirectory}
        </Typography>
      </Box>
      {alreadyInPlace && (
        <Alert severity="success" data-testid="layout-preview-in-place">
          {t('directoryLayout.alreadyInPlace')}
        </Alert>
      )}
    </Stack>
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
      <Typography variant="body2" color="text.secondary" data-testid="layout-preview-empty">
        {t('directoryLayout.selectPrompt')}
      </Typography>
    )
  }
  if (isPending) {
    return <Skeleton variant="rounded" height={64} data-testid="layout-preview-loading" />
  }
  if (isError || !preview) {
    return (
      <Alert severity="error" data-testid="layout-preview-error">
        {t('directoryLayout.previewError')}
      </Alert>
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

  const selectId = useId()

  return (
    <Stack spacing={2} sx={{ py: 1 }} data-testid="directory-layout-settings">
      <div>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t('directoryLayout.heading')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('directoryLayout.description')}
        </Typography>
      </div>

      {settingsError && <Alert severity="error">{t('directoryLayout.settingsError')}</Alert>}
      {settingsPending && !settingsError && (
        <Skeleton variant="rounded" height={48} data-testid="layout-settings-loading" />
      )}
      {settings && (
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('directoryLayout.templateLabel')}
            </Typography>
            <Typography
              variant="body2"
              component="p"
              data-testid="layout-template"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              {settings.directoryTemplate}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('directoryLayout.readOnlyNote')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
              {t('directoryLayout.tokensLabel')}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {settings.supportedTokens.map((token) => (
                <Chip key={token} label={token} size="small" data-testid="layout-token" />
              ))}
            </Stack>
          </Box>
        </Stack>
      )}

      <Box>
        <TextField
          id={selectId}
          select
          fullWidth
          size="small"
          label={t('directoryLayout.albumSelectLabel')}
          value={selectedAlbumId ?? ''}
          onChange={(e) => setSelectedAlbumId(e.target.value === '' ? null : e.target.value)}
          disabled={albumsPending || albumsError || albums.length === 0}
          helperText={albumsError ? t('directoryLayout.albumsError') : undefined}
          error={albumsError}
        >
          <MenuItem value="">
            <em>{t('directoryLayout.noAlbumSelected')}</em>
          </MenuItem>
          {albums.map((album) => (
            <MenuItem key={album.id} value={album.id}>
              {albumOptionLabel(album)}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <AlbumPreview albumId={selectedAlbumId} />
    </Stack>
  )
}
