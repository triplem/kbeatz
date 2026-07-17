import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden'
import { ArrowLeft, Pencil } from 'lucide-react'
import { type Album, type AlbumDetail as AlbumDetailModel } from '../../api/generated'
import { AlbumHeroHeader } from './album-hero-header'
import { AlbumTrackListView } from './album-tracklist-view'
import { AlbumCreditsSection } from './album-credits-section'
import { SyncPanel } from '../sync/sync-panel'

export interface AlbumDetailViewProps {
  /** Album data to display in read-only mode. */
  readonly album: AlbumDetailModel
  /** Called when the user clicks the Edit button to enter edit mode. */
  readonly onEnterEditMode: () => void
  /** Ref attached to the Edit button for focus management. */
  readonly editButtonRef: React.RefObject<HTMLButtonElement | null>
  /** Called when Discogs sync completes successfully; updates the displayed album. */
  readonly onSyncComplete: (updated: Album) => void
}

/**
 * AlbumDetailView - read-only presentation of album metadata.
 *
 * Renders a Back button, a visually-hidden h1 (album title), the hero header
 * (cover art + metadata summary), an Edit button, the read-only tracklist, and
 * the album-level credits section (hidden when all absent). No input fields.
 *
 * A "Hide/Show credits" toggle is rendered in the tracklist section heading when
 * at least one track has a composer tag. Default state: credits visible.
 */
export function AlbumDetailView({ album, onEnterEditMode, editButtonRef, onSyncComplete }: AlbumDetailViewProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [showCredits, setShowCredits] = useState(true)

  const hasAnyComposer = album.tracks.some(
    (track) => track.composer !== undefined && track.composer !== null && track.composer !== '',
  )

  return (
    <article
      aria-label={t('albumDetail.albumTagsSection')}
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Visually-hidden page heading anchoring the outline (WCAG 1.3.1 / 2.4.6). */}
      <VisuallyHidden>
        <h1>{album.album}</h1>
      </VisuallyHidden>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="secondary"
          icon={<Icon icon={ArrowLeft} />}
          onClick={() => { navigate(-1) }}
          data-testid="back-button"
          label={t('common.back')}
        />

        <Button
          ref={editButtonRef}
          type="button"
          variant="primary"
          icon={<Icon icon={Pencil} />}
          onClick={onEnterEditMode}
          data-testid="edit-button"
          label={t('albumDetail.editButton')}
        />
      </div>

      <AlbumHeroHeader album={album} />

      <section aria-label={t('albumDetail.tracksSection')} data-testid="tracklist-section" style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <Heading level={2}>{t('albumDetail.tracksSectionTitle')}</Heading>
          {hasAnyComposer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowCredits((prev) => !prev) }}
              aria-expanded={showCredits}
              aria-controls="composer-credits-region"
              aria-label={showCredits ? t('albumDetail.hideCredits') : t('albumDetail.showCredits')}
              data-testid="credits-toggle"
              label={showCredits ? t('albumDetail.hideCredits') : t('albumDetail.showCredits')}
            />
          )}
        </div>
        <AlbumTrackListView tracks={album.tracks} showCredits={showCredits} />
      </section>

      <AlbumCreditsSection
        composer={album.composer}
        conductor={album.conductor}
        ensemble={album.ensemble}
      />

      {album.discogsId !== undefined && (
        <section aria-label={t('albumDetail.discogsSection')}>
          <SyncPanel album={album} onSyncComplete={onSyncComplete} hasLocalEdits={false} />
        </section>
      )}
    </article>
  )
}
