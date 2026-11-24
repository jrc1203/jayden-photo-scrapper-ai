/** Photo grid component for displaying photos */
import { useMemo } from 'react'
import type { PhotoSummary } from '@/types'
import { clsx } from 'clsx'

interface PhotoGridProps {
  photos: PhotoSummary[]
  viewMode: 'grid' | 'list'
  selectedIds: number[]
  onPhotoClick: (photoId: number) => void
  onLoadMore?: () => void
  isLoading: boolean
}

export function PhotoGrid({
  photos,
  viewMode,
  selectedIds,
  onPhotoClick,
  onLoadMore,
  isLoading,
}: PhotoGridProps) {
  const isSelected = useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  )

  if (viewMode === 'grid') {
    return (
      <div
        className="photo-grid"
        role="list"
        aria-label="Photo gallery"
      >
        {photos.map((photo) => (
          <PhotoGridItem
            key={photo.id}
            photo={photo}
            isSelected={isSelected.has(photo.id)}
            onClick={() => onPhotoClick(photo.id)}
          />
        ))}
        {isLoading && onLoadMore && (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2" role="list" aria-label="Photo gallery">
      {photos.map((photo) => (
        <PhotoListItem
          key={photo.id}
          photo={photo}
          isSelected={isSelected.has(photo.id)}
          onClick={() => onPhotoClick(photo.id)}
        />
      ))}
      {isLoading && onLoadMore && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}
    </div>
  )
}

function PhotoGridItem({
  photo,
  isSelected,
  onClick,
}: {
  photo: PhotoSummary
  isSelected: boolean
  onClick: () => void
}) {
  const thumbnailUrl = photo.thumbnail_url || (photo.thumbnail_path
    ? `/thumbnails/${photo.thumbnail_path.split('/').pop()}`
    : `/api/v1/photos/${photo.id}/thumbnail`)

  return (
    <article
      className={clsx(
        'photo-item relative group',
        isSelected && 'ring-2 ring-primary-500 ring-offset-2'
      )}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      role="listitem"
      aria-selected={isSelected}
    >
      <img
        src={thumbnailUrl}
        alt={photo.file_name}
        loading="lazy"
        className="w-full h-full object-cover"
      />
      <div className="photo-overlay">
        <div className="text-white text-center p-4">
          <h4 className="font-medium truncate">{photo.file_name}</h4>
          {photo.taken_at && (
            <p className="text-sm opacity-80 mt-1">
              {new Date(photo.taken_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Person indicators */}
      {photo.persons && photo.persons.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 flex gap-1 justify-center">
          {photo.persons.slice(0, 5).map((pp) => (
            <div
              key={pp.person_id}
              className="w-6 h-6 rounded-full bg-white/90 border-2 border-white flex items-center justify-center overflow-hidden"
              title={pp.person.display_name || pp.person.name}
            >
              {pp.person.reference_photo_id && (
                <img
                  src={`/api/v1/photos/${pp.person.reference_photo_id}/thumbnail`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
          {photo.persons.length > 5 && (
            <div className="w-6 h-6 rounded-full bg-gray-800/90 border-2 border-white flex items-center justify-center text-white text-xs font-medium">
              +{photo.persons.length - 5}
            </div>
          )}
        </div>
      )}

      {/* Selection checkbox */}
      <div className="absolute top-2 right-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 accent-primary-600"
          aria-label="Select photo"
        />
      </div>
    </article>
  )
}

function PhotoListItem({
  photo,
  isSelected,
  onClick,
}: {
  photo: PhotoSummary
  isSelected: boolean
  onClick: () => void
}) {
  const thumbnailUrl = photo.thumbnail_url || (photo.thumbnail_path
    ? `/thumbnails/${photo.thumbnail_path.split('/').pop()}`
    : `/api/v1/photos/${photo.id}/thumbnail`)

  return (
    <article
      className={clsx(
        'flex items-center gap-4 p-3 rounded-lg bg-white border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer',
        isSelected && 'bg-primary-50 border-primary-200'
      )}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      role="listitem"
      aria-selected={isSelected}
    >
      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
        <img
          src={thumbnailUrl}
          alt={photo.file_name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 truncate">{photo.file_name}</h4>
        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
          {photo.taken_at && (
            <span>{new Date(photo.taken_at).toLocaleDateString()}</span>
          )}
          {photo.width && photo.height && (
            <span>{photo.width}×{photo.height}</span>
          )}
          {photo.camera_model && (
            <span>{photo.camera_model}</span>
          )}
        </div>
        {photo.persons && photo.persons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {photo.persons.slice(0, 3).map((pp) => (
              <span
                key={pp.person_id}
                className="badge bg-primary-100 text-primary-700"
              >
                {pp.person.display_name || pp.person.name}
              </span>
            ))}
            {photo.persons.length > 3 && (
              <span className="badge bg-gray-100 text-gray-600">
                +{photo.persons.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => e.stopPropagation()}
        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 accent-primary-600"
        aria-label="Select photo"
      />
    </article>
  )
}
