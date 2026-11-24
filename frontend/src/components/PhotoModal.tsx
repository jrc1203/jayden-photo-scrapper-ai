/** Photo detail modal with face detection overlay */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { X, Download, Share2, Tag, User, MapPin, Calendar, Camera } from 'lucide-react'
import { clsx } from 'clsx'
import type { Photo } from '@/types'

interface PhotoModalProps {
  photoId: number
  onClose: () => void
}

export function PhotoModal({ photoId, onClose }: PhotoModalProps) {
  const navigate = useNavigate()
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Load photo details
  useEffect(() => {
    const loadPhoto = async () => {
      setLoading(true)
      try {
        const data = await api.getPhoto(photoId)
        setPhoto(data)
      } catch (err) {
        setError('Failed to load photo')
      } finally {
        setLoading(false)
      }
    }
    loadPhoto()
  }, [photoId])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    )
  }

  if (error || !photo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-center text-white">
          <p>Failed to load photo</p>
          <button className="btn-primary mt-4" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  const imageUrl = `/api/v1/photos/${photo.id}/image`
  const shareUrl = `${window.location.origin}${imageUrl}`

  const handleShare = async () => {
    setShareMessage(null)
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareMessage('Photo link copied to clipboard.')
    } catch {
      setShareMessage(`Copy this local photo link: ${shareUrl}`)
    }
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo: ${photo.file_name}`}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={24} />
      </button>

      {/* Image Container */}
      <div className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center">
        <div className="relative">
          <img
            src={imageUrl}
            alt={photo.file_name}
            className="max-w-[90vw] max-h-[75vh] object-contain"
          />

          {/* Face overlays */}
          {photo.persons && photo.persons.length > 0 && (
            <>
              {photo.persons.map((pp) => (
                <FaceOverlay
                  key={pp.person_id}
                  location={pp.location}
                  personName={pp.person.display_name || pp.person.name}
                  confidence={pp.confidence}
                  isVerified={pp.is_verified}
                />
              ))}
            </>
          )}
        </div>

        {/* Photo Info */}
        <div className="w-full max-w-[90vw] mt-4 p-4 bg-black/80 rounded-xl text-white">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{photo.taken_at ? new Date(photo.taken_at).toLocaleDateString() : 'Unknown date'}</span>
            </div>

            {photo.camera_make || photo.camera_model ? (
              <div className="flex items-center gap-2">
                <Camera size={16} />
                <span>{[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}</span>
              </div>
            ) : null}

            {photo.width && photo.height ? (
              <div className="flex items-center gap-2">
                <span>{photo.width}×{photo.height}</span>
              </div>
            ) : null}

            {(photo.gps_latitude && photo.gps_longitude) ? (
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>{photo.gps_latitude.toFixed(4)}, {photo.gps_longitude.toFixed(4)}</span>
              </div>
            ) : null}
          </div>

          {/* People in photo */}
          {photo.persons && photo.persons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 text-sm mb-2">
                <User size={16} />
                <span className="font-medium">People in this photo:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {photo.persons.map((pp) => (
                  <button
                    key={pp.person_id}
                    className={clsx(
                      'badge px-3 py-1.5',
                      pp.is_verified
                        ? 'bg-green-900/50 text-green-300 border border-green-700'
                        : 'bg-primary-900/50 text-primary-300 border border-primary-700'
                    )}
                    onClick={() => {
                      onClose()
                      navigate(`/person/${pp.person_id}`)
                    }}
                  >
                    {pp.person.display_name || pp.person.name}
                    {pp.confidence < 1 && (
                      <span className="ml-1 opacity-70 text-xs">
                        ({Math.round(pp.confidence * 100)}%)
                      </span>
                    )}
                    {!pp.is_verified && (
                      <span className="ml-1 opacity-70">?</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {photo.tags && photo.tags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 text-sm mb-2">
                <Tag size={16} />
                <span className="font-medium">Tags:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {photo.tags.map((pt) => (
                  <span
                    key={pt.tag.id}
                    className="badge px-3 py-1.5"
                    style={{ backgroundColor: (pt.tag.color || '#3B82F6') + '33', borderColor: pt.tag.color || '#3B82F6', color: pt.tag.color || '#3B82F6' }}
                  >
                    {pt.tag.display_name || pt.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-2">
            <a
              href={imageUrl}
              download={photo.file_name}
              className="btn-secondary text-sm"
            >
              <Download size={16} className="mr-1" />
              Download
            </a>
            <button className="btn-secondary text-sm" onClick={() => void handleShare()}>
              <Share2 size={16} className="mr-1" />
              Share
            </button>
          </div>
          {shareMessage && <p className="mt-2 text-xs text-gray-200 break-all" role="status">{shareMessage}</p>}
        </div>
      </div>
    </div>
  )
}

interface FaceOverlayProps {
  location: { top: number; right: number; bottom: number; left: number }
  personName: string
  confidence: number
  isVerified: boolean
}

function FaceOverlay({ location, personName, confidence, isVerified }: FaceOverlayProps) {
  const borderColor = isVerified ? '#22c55e' : '#0ea5e9'
  const bgColor = isVerified ? '#22c55e33' : '#0ea5e933'
  const textBgColor = isVerified ? '#22c55e' : '#0ea5e9'
  // The image is displayed with object-contain, so we need to calculate the actual displayed dimensions
  // For simplicity, we'll use a relative approach
  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${location.top * 100}%`,
    left: `${location.left * 100}%`,
    width: `${(location.right - location.left) * 100}%`,
    height: `${(location.bottom - location.top) * 100}%`,
    border: `2px solid ${borderColor}`,
    borderRadius: '4px',
    backgroundColor: bgColor,
    pointerEvents: 'none',
    boxShadow: '0 0 0 2px white',
  }

  return (
    <div style={style} className="relative">
      <div className="absolute -top-6 left-0 w-max px-1.5 py-0.5 text-xs font-medium text-white rounded"
        style={{ backgroundColor: textBgColor }}>
        {personName}
        {confidence < 1 && <span className="ml-1 opacity-80">({Math.round(confidence * 100)}%)</span>}
      </div>
    </div>
  )
}