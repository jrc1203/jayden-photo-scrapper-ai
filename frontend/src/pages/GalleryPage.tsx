/** Gallery page - main photo browsing view */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useStore } from '@/hooks/useStore'
import { api } from '@/services/api'
import { PhotoGrid } from '@/components/PhotoGrid'
import { PhotoModal } from '@/components/PhotoModal'
import { Loader2 } from 'lucide-react'

export function GalleryPage() {
  const {
    viewMode,
    photos: storePhotos,
    setPhotos,
    addPhotos,
    selectedPhotoIds,
    isLoading,
    isScanning,
    setLoading,
    setScanning,
    currentPerson,
    setCurrentPerson,
    searchQuery,
    setSearchQuery,
  } = useStore()

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery.trim())
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const requestId = useRef(0)

  // Debounce typing and invalidate any request for the previous query.
  useEffect(() => {
    const normalizedQuery = searchQuery.trim()
    if (normalizedQuery === debouncedSearchQuery) return

    const timeoutId = window.setTimeout(() => {
      requestId.current += 1
      setDebouncedSearchQuery(normalizedQuery)
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [searchQuery, debouncedSearchQuery])

  // Load photos
  const loadPhotos = useCallback(async (pageNum: number, append = false) => {
    const currentRequestId = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const personId = currentPerson?.id
      const response = await api.getPhotos({
        page: pageNum,
        per_page: viewMode === 'grid' ? 50 : 25,
        person_id: personId,
        search: debouncedSearchQuery || undefined,
      })

      if (currentRequestId !== requestId.current) return

      if (append) {
        addPhotos(response.items)
      } else {
        setPhotos(response.items)
      }
      setTotalPages(response.total_pages)
      setHasMore(pageNum < response.total_pages)
    } catch (err) {
      if (currentRequestId !== requestId.current) return
      setError('Failed to load photos')
      console.error(err)
    } finally {
      if (currentRequestId === requestId.current) setLoading(false)
    }
  }, [currentPerson?.id, viewMode, debouncedSearchQuery, setPhotos, addPhotos, setLoading])

  // Reset pagination and reload when the active person, view, or search changes.
  useEffect(() => {
    setPage(1)
    loadPhotos(1, false)
  }, [currentPerson?.id, loadPhotos])

  // Refresh the gallery after a scan started from the global sidebar action.
  useEffect(() => {
    const refreshAfterScan = () => {
      setPage(1)
      void loadPhotos(1, false)
    }
    window.addEventListener('photos:updated', refreshAfterScan)
    return () => window.removeEventListener('photos:updated', refreshAfterScan)
  }, [loadPhotos])

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 500
      ) {
        if (hasMore && !isLoading && page < totalPages) {
          loadPhotos(page + 1, true)
          setPage(page + 1)
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, isLoading, page, totalPages, loadPhotos])

  const handlePhotoClick = (photoId: number) => {
    setSelectedPhoto(photoId)
  }

  const handleScanPhotos = async () => {
    setScanning(true)
    setError(null)
    try {
      await api.scanPhotos(false)
      setPage(1)
      await loadPhotos(1, false)
    } catch (err) {
      setError('Photo scan failed. Check the source folder and try again.')
    } finally {
      setScanning(false)
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="mx-auto text-6xl text-red-500 mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header with person context */}
      {currentPerson && (
        <div className="mb-4 flex items-center justify-between p-4 bg-primary-50 rounded-xl border border-primary-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
              {currentPerson.reference_photo_id && (
                <img
                  src={`/api/v1/photos/${currentPerson.reference_photo_id}/thumbnail`}
                  alt={currentPerson.display_name || currentPerson.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {currentPerson.display_name || currentPerson.name}
              </h2>
              <p className="text-sm text-gray-600">
                {storePhotos.length} photo{storePhotos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            className="btn-ghost"
            onClick={() => setCurrentPerson(null)}
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Photo Grid */}
      <div className="flex-1 overflow-auto">
        {storePhotos.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="text-6xl text-gray-300 mb-4">📷</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No photos found</h3>
            <p className="text-gray-500 mb-6">
              {currentPerson
                ? debouncedSearchQuery
                  ? 'No photos for this person match your search.'
                  : 'This person has no photos yet.'
                : debouncedSearchQuery
                  ? `No photos match "${debouncedSearchQuery}". Search checks file names and camera make or model.`
                  : 'Scan your photo folder to get started.'}
            </p>
            {debouncedSearchQuery ? (
              <button className="btn-secondary" onClick={() => setSearchQuery('')}>
                Clear search
              </button>
            ) : !currentPerson && (
              <button className="btn-primary" onClick={handleScanPhotos} disabled={isScanning || isLoading}>
                {isScanning ? 'Scanning…' : 'Scan Photos'}
              </button>
            )}
          </div>
        ) : (
          <PhotoGrid
            photos={storePhotos}
            viewMode={viewMode}
            selectedIds={selectedPhotoIds}
            onPhotoClick={handlePhotoClick}
            onLoadMore={hasMore && !isLoading ? () => loadPhotos(page + 1, true) : undefined}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <PhotoModal
          photoId={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </div>
  )
}
