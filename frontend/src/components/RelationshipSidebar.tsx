/** Relationship sidebar for viewing and managing relationships */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useStore } from '@/hooks/useStore'
import { Search, Plus, GitBranch, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { Relationship, RelationshipType } from '@/types'

// Relationship type categories
const RELATIONSHIP_CATEGORIES: Record<string, { types: RelationshipType[]; label: string; color: string }> = {
  family: {
    types: ['spouse', 'partner', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'uncle_aunt', 'niece_nephew', 'cousin', 'in_law'],
    label: 'Family',
    color: 'amber',
  },
  social: {
    types: ['friend', 'close_friend', 'acquaintance', 'colleague', 'classmate', 'neighbor'],
    label: 'Social',
    color: 'blue',
  },
  professional: {
    types: ['manager', 'reports_to', 'mentor', 'mentee', 'business_partner'],
    label: 'Professional',
    color: 'green',
  },
  custom: {
    types: ['custom'],
    label: 'Custom',
    color: 'purple',
  },
}

export function RelationshipSidebar() {
  const {
    setRelationships,
    currentPerson,
  } = useStore()

  const [relationships, setLocalRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<RelationshipType | 'all'>('all')
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false)
  const [relationshipSearch, setRelationshipSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [peopleOptions, setPeopleOptions] = useState<{ id: number; name: string }[]>([])
  const [relatedPersonId, setRelatedPersonId] = useState('')
  const [newRelationshipType, setNewRelationshipType] = useState<RelationshipType>('friend')
  const [savingRelationship, setSavingRelationship] = useState(false)

  const openCreateRelationship = async () => {
    if (!currentPerson) return
    setError(null)
    try {
      const response = await api.getPersons({ page: 1, per_page: 500 })
      setPeopleOptions(response.items
        .filter((person) => person.id !== currentPerson.id)
        .map((person) => ({ id: person.id, name: person.display_name || person.name })))
      setShowCreateModal(true)
    } catch {
      setError('Could not load people for the relationship.')
    }
  }

  const createRelationship = async () => {
    if (!currentPerson || !relatedPersonId) return
    setSavingRelationship(true)
    setError(null)
    try {
      await api.createRelationship({
        person_id: currentPerson.id,
        related_person_id: Number(relatedPersonId),
        relationship_type: newRelationshipType,
        is_verified: false,
        is_current: true,
      })
      setShowCreateModal(false)
      setRelatedPersonId('')
      await loadRelationships()
    } catch {
      setError('Could not create relationship. Check whether it already exists.')
    } finally {
      setSavingRelationship(false)
    }
  }

  const loadRelationships = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getRelationships({
        person_id: currentPerson?.id,
        relationship_type: filterType !== 'all' ? filterType : undefined,
        only_verified: showVerifiedOnly,
      })
      setLocalRelationships(response.relationships)
      setRelationships(response.relationships)
    } catch (err) {
      setError('Failed to load relationships')
    } finally {
      setLoading(false)
    }
  }, [currentPerson?.id, filterType, setRelationships, showVerifiedOnly])

  useEffect(() => {
    void loadRelationships()
  }, [loadRelationships])

  const getTypeLabel = (type: RelationshipType) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const visibleRelationships = relationships.filter((relationship) => {
    const query = relationshipSearch.trim().toLowerCase()
    return !query || relationship.related_person_name.toLowerCase().includes(query) || relationship.type.replace(/_/g, ' ').toLowerCase().includes(query)
  })

  if (!currentPerson) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8">
        <GitBranch className="text-4xl text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a person</h3>
        <p className="text-gray-500">Choose a person from the People tab to view their relationships</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Relationships</h3>
          <button className="btn-ghost p-1" onClick={() => void openCreateRelationship()} aria-label="Add relationship">
            <Plus size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              placeholder="Filter relationships..."
              className="input pl-10"
              value={relationshipSearch}
              onChange={(event) => setRelationshipSearch(event.target.value)}
              aria-label="Filter relationships"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as RelationshipType | 'all')}
              className="input py-1.5 text-sm flex-1 min-w-0"
            >
              <option value="all">All Types</option>
              {Object.entries(RELATIONSHIP_CATEGORIES).map(([key, cat]) => (
                <optgroup key={key} label={cat.label}>
                  {cat.types.map((type) => (
                    <option key={type} value={type}>{getTypeLabel(type)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showVerifiedOnly}
                onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Verified only
            </label>
          </div>
        </div>
      </div>

      {/* Relationship List */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-red-500 flex items-center justify-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin h-8 w-8 text-primary-600" />
          </div>
        ) : relationships.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <GitBranch className="mx-auto text-4xl text-gray-300 mb-2" />
            <p>No relationships yet</p>
            <button className="btn-primary mt-2 text-sm" onClick={() => void openCreateRelationship()}>
              Add Relationship
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100" role="list">
            {Object.entries(RELATIONSHIP_CATEGORIES).map(([catKey, cat]) => {
              const catRelationships = visibleRelationships.filter((r) =>
                cat.types.includes(r.type as RelationshipType)
              )
              if (catRelationships.length === 0) return null

              return (
                <li key={catKey}>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </h4>
                  </div>
                  {catRelationships.map((rel) => (
                    <RelationshipListItem key={rel.id} relationship={rel} />
                  ))}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Stats */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{relationships.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {relationships.filter((r) => r.is_verified).length}
            </p>
            <p className="text-xs text-gray-500">Verified</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">
              {relationships.filter((r) => r.source === 'inferred').length}
            </p>
            <p className="text-xs text-gray-500">Inferred</p>
          </div>
        </div>
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreateModal(false) }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="relationship-dialog-title">
            <h3 id="relationship-dialog-title" className="mb-4 text-lg font-semibold">Add relationship</h3>
            {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
            {peopleOptions.length === 0 ? (
              <p className="text-sm text-gray-600">Add another person before creating a relationship.</p>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Person</span>
                  <select className="input" value={relatedPersonId} onChange={(event) => setRelatedPersonId(event.target.value)}>
                    <option value="">Choose a person</option>
                    {peopleOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Relationship type</span>
                  <select className="input" value={newRelationshipType} onChange={(event) => setNewRelationshipType(event.target.value as RelationshipType)}>
                    {Object.values(RELATIONSHIP_CATEGORIES).flatMap((category) => category.types).map((type) => (
                      <option key={type} value={type}>{getTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-amber-700">New relationships are unverified until you review them.</p>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)} disabled={savingRelationship}>Cancel</button>
              {peopleOptions.length > 0 && <button className="btn-primary" onClick={() => void createRelationship()} disabled={!relatedPersonId || savingRelationship}>{savingRelationship ? 'Saving…' : 'Create'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function RelationshipListItem({ relationship }: { relationship: Relationship }) {
  const category = Object.values(RELATIONSHIP_CATEGORIES).find((cat) =>
    cat.types.includes(relationship.type as RelationshipType)
  ) || RELATIONSHIP_CATEGORIES.custom

  const typeLabel = relationship.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <li>
      <div className={clsx(
        'p-3 hover:bg-gray-50 transition-colors',
        `relationship-${category.label.toLowerCase()}`
      )}>
        <div className="flex items-start gap-3">
          {/* Related person avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            {relationship.related_person_name && (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <span className="font-medium text-sm">
                  {relationship.related_person_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">
                {relationship.related_person_name}
              </span>
              <span
                className={clsx(
                  'badge text-xs px-2 py-0.5',
                  `bg-${category.color}-100 text-${category.color}-700`
                )}
              >
                {typeLabel}
              </span>
            </div>

            {relationship.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {relationship.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {relationship.confidence < 1 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
                  {Math.round(relationship.confidence * 100)}% confidence
                </span>
              )}
              {relationship.source === 'inferred' && (
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Inferred from {relationship.inferred_from_photo_count} photos
                </span>
              )}
              {relationship.is_verified && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle size={12} />
                  Verified
                </span>
              )}
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-col items-end gap-1">
            {!relationship.is_current && (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Not current">
                <title>Not current</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
