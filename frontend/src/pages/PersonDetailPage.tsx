/** Person detail page - shows all photos and info for a person */
import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { useStore } from '@/hooks/useStore'
import { PhotoGrid } from '@/components/PhotoGrid'
import { PhotoModal } from '@/components/PhotoModal'
import { ArrowLeft, User, Calendar, Heart, Users, Edit, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import type { Person, Relationship, RelationshipType } from '@/types'

export function PersonDetailPage() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()
  const {
    photos: storePhotos,
    setPhotos,
    addPhotos,
    selectedPhotoIds,
    viewMode,
    isLoading,
    setLoading,
    setCurrentPerson,
  } = useStore()

  const [person, setPerson] = useState<Person | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeOptions, setMergeOptions] = useState<{ id: number; name: string }[]>([])
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeSaving, setMergeSaving] = useState(false)
  const [relationshipActionError, setRelationshipActionError] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', display_name: '', birth_date: '', notes: '' })
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [suggestions, setSuggestions] = useState<{ person_id: number; person_name: string; cooccurrence_count: number; suggested_type: RelationshipType; confidence: number }[]>([])

  // Load person details
  useEffect(() => {
    if (!personId) return

    const loadPerson = async () => {
      setLoading(true)
      try {
        const [data, photoPage] = await Promise.all([
          api.getPerson(parseInt(personId)),
          api.getPersonPhotos(parseInt(personId), {
            page: 1,
            per_page: viewMode === 'grid' ? 50 : 25,
          }),
        ])
        setPerson(data)
        setCurrentPerson(data)
        setPhotos(photoPage.items)
        setPage(1)
        setTotalPages(photoPage.total_pages)
        setHasMore(photoPage.total_pages > 1)
        setRelationships(data.relationships || [])

        // Load suggestions
        const sugg = await api.getRelationshipSuggestions(parseInt(personId))
        setSuggestions(sugg.suggestions)
      } catch (err) {
        setError('Failed to load person')
      } finally {
        setLoading(false)
      }
    }

    loadPerson()
  }, [personId, viewMode, setLoading, setCurrentPerson, setPhotos, setRelationships])

  const loadMorePhotos = useCallback(async () => {
    if (!personId) return
    setLoading(true)
    try {
      const response = await api.getPersonPhotos(parseInt(personId), {
        page: page + 1,
        per_page: viewMode === 'grid' ? 50 : 25,
      })
      addPhotos(response.items)
      setTotalPages(response.total_pages)
      setHasMore(page + 1 < response.total_pages)
      setPage(page + 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [addPhotos, page, personId, setLoading, viewMode])

  // Load more photos on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 500
      ) {
        if (hasMore && !isLoading && page < totalPages && personId) {
          void loadMorePhotos()
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, isLoading, loadMorePhotos, page, personId, totalPages])

  const handlePhotoClick = (photoId: number) => {
    setSelectedPhoto(photoId)
  }

  const handleEditClick = () => {
    if (person) {
      setEditData({
        name: person.name,
        display_name: person.display_name || '',
        birth_date: person.birth_date ? person.birth_date.split('T')[0] : '',
        notes: person.notes || '',
      })
      setShowEditModal(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!personId) return
    try {
      await api.updatePerson(parseInt(personId), editData)
      const data = await api.getPerson(parseInt(personId))
      setPerson(data)
      setShowEditModal(false)
    } catch (err) {
      setError('Could not save person details. Try again.')
    }
  }

  const openMergeModal = async () => {
    if (!person) return
    setMergeError(null)
    try {
      const response = await api.getPersons({ page: 1, per_page: 500 })
      setMergeOptions(response.items
        .filter((candidate) => candidate.id !== person.id)
        .map((candidate) => ({ id: candidate.id, name: candidate.display_name || candidate.name })))
      setShowMergeModal(true)
    } catch {
      setMergeError('Could not load people to merge.')
    }
  }

  const handleMerge = async () => {
    if (!person || !mergeTargetId) return
    setMergeSaving(true)
    setMergeError(null)
    try {
      const result = await api.mergePersons(person.id, Number(mergeTargetId))
      setShowMergeModal(false)
      navigate(`/person/${result.merged_person_id}`)
    } catch {
      setMergeError('Merge failed. The people may not be mergeable.')
    } finally {
      setMergeSaving(false)
    }
  }

  const handleVerifyRelationship = async (relationshipId: number, verified: boolean) => {
    try {
      await api.updateRelationship(relationshipId, { is_verified: verified })
      setRelationships((current) => current.map((rel) => rel.id === relationshipId ? { ...rel, is_verified: verified } : rel))
    } catch {
      setRelationshipActionError('Could not update relationship verification.')
    }
  }

  const handleAddSuggestion = async (suggestion: typeof suggestions[number]) => {
    if (!person) return
    try {
      const relationship = await api.createRelationship({
        person_id: person.id,
        related_person_id: suggestion.person_id,
        relationship_type: suggestion.suggested_type,
        confidence: suggestion.confidence,
        is_verified: false,
        is_current: true,
      })
      setRelationships((current) => [...current, relationship])
      setSuggestions((current) => current.filter((item) => item.person_id !== suggestion.person_id))
    } catch {
      setRelationshipActionError('Could not add the suggested relationship.')
    }
  }

  const handleRejectRelationship = async (relationshipId: number) => {
    if (!window.confirm('Remove this relationship?')) return
    try {
      await api.deleteRelationship(relationshipId)
      setRelationships((current) => current.filter((rel) => rel.id !== relationshipId))
    } catch {
      setRelationshipActionError('Could not remove relationship.')
    }
  }

  
  if (isLoading && !person) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin h-10 w-10 text-primary-600" />
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertCircle className="text-6xl text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Person not found</h2>
        <button className="btn-primary" onClick={() => navigate('/gallery')}>
          Back to Gallery
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button className="btn-ghost p-2" onClick={() => navigate('/gallery')}>
          <ArrowLeft size={20} />
        </button>

        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {person.display_name || person.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={handleEditClick}>
            <Edit size={18} className="mr-1" />
            Edit
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 ring-4 ring-white shadow-lg">
              {person.reference_photo_id && (
                <img
                  src={`/api/v1/photos/${person.reference_photo_id}/thumbnail`}
                  alt={person.display_name || person.name}
                  className="w-full h-full object-cover"
                />
              )}
              {!person.reference_photo_id && (
                <User className="w-full h-full text-gray-400" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-900">
                {person.display_name || person.name}
              </h2>
              {person.name !== person.display_name && (
                <p className="text-gray-500 mt-1">{person.name}</p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4 text-sm text-gray-600">
                {person.birth_date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={16} />
                    {new Date(person.birth_date).toLocaleDateString()}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Heart size={16} />
                  {person.photo_count} photo{person.photo_count !== 1 ? 's' : ''}
                </span>
              </div>

              {person.notes && (
                <p className="mt-4 text-gray-700 italic">{person.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 md:flex-row">
              <button className="btn-primary" onClick={handleEditClick}>
                <Edit size={18} className="mr-1" />
                Edit Profile
              </button>
              <button className="btn-secondary" onClick={() => void openMergeModal()} disabled={isLoading}>
                <Users size={18} className="mr-1" />
                Merge
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Relationships Section */}
      {(relationships.length > 0 || suggestions.length > 0) && (
        <div className="card overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Relationships</h3>
          </div>
          <div className="p-4">
            {relationshipActionError && <p role="alert" className="mb-4 text-sm text-red-600">{relationshipActionError}</p>}
            {/* Current relationships */}
            {relationships.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Known Relationships</h4>
                <div className="space-y-2">
                  {relationships.map((rel) => (
                    <RelationshipCard
                      key={rel.id}
                      relationship={rel}
                      currentPersonId={person.id}
                      onVerify={(verified) => void handleVerifyRelationship(rel.id, verified)}
                      onReject={() => void handleRejectRelationship(rel.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Suggested Relationships</h4>
                <div className="space-y-2">
                  {suggestions.slice(0, 5).map((sugg) => (
                    <SuggestionCard
                      key={sugg.person_id}
                      suggestion={sugg}
                      onAdd={() => void handleAddSuggestion(sugg)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos Section */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Photos ({person.photo_count})
          </h3>
        </div>

        {storePhotos.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center">
            <User className="text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No photos yet</h3>
            <p className="text-gray-500">Process faces to find photos of this person</p>
          </div>
        ) : (
          <PhotoGrid
            photos={storePhotos}
            viewMode={viewMode}
            selectedIds={selectedPhotoIds}
            onPhotoClick={handlePhotoClick}
            onLoadMore={hasMore && !isLoading ? loadMorePhotos : undefined}
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

      {/* Edit Modal */}
      {showEditModal && (
        <EditPersonModal
          data={editData}
          onChange={setEditData}
          onSave={handleSaveEdit}
          onCancel={() => setShowEditModal(false)}
        />
      )}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !mergeSaving) setShowMergeModal(false) }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="merge-person-title">
            <h2 id="merge-person-title" className="text-lg font-semibold">Merge person records</h2>
            <p className="my-3 text-sm text-amber-700">This permanently combines the selected record into {person.display_name || person.name}. Review the selection before continuing.</p>
            {mergeError && <p role="alert" className="mb-3 text-sm text-red-600">{mergeError}</p>}
            {mergeOptions.length === 0 ? (
              <p className="text-sm text-gray-600">No other person records are available to merge.</p>
            ) : (
              <label className="block">
                <span className="label">Record to merge into this person</span>
                <select className="input" value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}>
                  <option value="">Choose a person</option>
                  {mergeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowMergeModal(false)} disabled={mergeSaving}>Cancel</button>
              {mergeOptions.length > 0 && <button className="btn-primary" onClick={() => void handleMerge()} disabled={!mergeTargetId || mergeSaving}>{mergeSaving ? 'Merging…' : 'Merge records'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RelationshipCard({
  relationship,
  currentPersonId,
  onVerify,
  onReject,
}: {
  relationship: Relationship
  currentPersonId: number
  onVerify: (verified: boolean) => void
  onReject: () => void
}) {
  const isFromCurrent = relationship.person_id === currentPersonId
  const otherPerson = isFromCurrent
    ? { id: relationship.related_person_id, name: relationship.related_person_name }
    : { id: relationship.person_id, name: relationship.person_name }

  const typeLabel = relationship.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
        {otherPerson.name?.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{otherPerson.name}</span>
          <span className="badge bg-primary-100 text-primary-700 text-xs">{typeLabel}</span>
          {relationship.custom_type && (
            <span className="badge bg-purple-100 text-purple-700 text-xs">{relationship.custom_type}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          {relationship.confidence < 1 && (
            <span>{Math.round(relationship.confidence * 100)}% confidence</span>
          )}
          {relationship.source === 'inferred' && (
            <span className="text-amber-600">Inferred from {relationship.inferred_from_photo_count} photos</span>
          )}
          {relationship.is_verified && (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle size={12} /> Verified
            </span>
          )}
          {!relationship.is_verified && (
            <span className="text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Unverified">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Unverified
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost p-1"
          onClick={() => onVerify(true)}
          disabled={relationship.is_verified}
        >
          <CheckCircle size={16} className="text-green-600" />
        </button>
        <button className="btn-ghost p-1" onClick={onReject} aria-label={`Remove relationship with ${otherPerson.name}`}>
          <XCircle size={16} className="text-red-600" />
        </button>
      </div>
    </div>
  )
}

function SuggestionCard({
  suggestion,
  onAdd,
}: {
  suggestion: { person_id: number; person_name: string; cooccurrence_count: number; suggested_type: RelationshipType; confidence: number }
  onAdd: (type: RelationshipType) => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-medium">
        {suggestion.person_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{suggestion.person_name}</span>
          <span className="badge bg-amber-100 text-amber-700 text-xs">
            {suggestion.cooccurrence_count} shared photos
          </span>
        </div>
        <div className="text-sm text-gray-500">
          Suggested: {suggestion.suggested_type.replace(/_/g, ' ')} ({Math.round(suggestion.confidence * 100)}% confidence)
        </div>
      </div>
      <button
        className="btn-primary text-sm"
        onClick={() => onAdd(suggestion.suggested_type)}
      >
        Add
      </button>
    </div>
  )
}

function EditPersonModal({
  data,
  onChange,
  onSave,
  onCancel,
}: {
  data: { name: string; display_name: string; birth_date: string; notes: string }
  onChange: (data: { name: string; display_name: string; birth_date: string; notes: string }) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Person</h3>
          <button className="btn-ghost p-1" onClick={onCancel}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="label">Name (Internal)</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Display Name</label>
            <input
              type="text"
              value={data.display_name}
              onChange={(e) => onChange({ ...data, display_name: e.target.value })}
              className="input"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="label">Birth Date</label>
            <input
              type="date"
              value={data.birth_date}
              onChange={(e) => onChange({ ...data, birth_date: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              value={data.notes}
              onChange={(e) => onChange({ ...data, notes: e.target.value })}
              className="input min-h-[100px] resize-y"
              placeholder="Optional notes about this person"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
