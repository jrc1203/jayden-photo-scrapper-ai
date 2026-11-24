/** Person sidebar for browsing and selecting people */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/services/api'
import { useStore } from '@/hooks/useStore'
import { Search, UserPlus, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { Person } from '@/types'

interface PersonSidebarProps {
  onPersonSelect: (personId: number) => void
}

export function PersonSidebar({ onPersonSelect }: PersonSidebarProps) {
  const {
    persons: storePersons,
    setPersons,
    currentPerson,
    setCurrentPerson,
    isLoading,
    setLoading,
  } = useStore()

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadPersons = useCallback(async (pageNum: number, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getPersons({
        page: pageNum,
        per_page: 50,
        search: searchQuery || undefined,
      })

      const persons: Person[] = response.items.map((person) => ({
        ...person,
        birth_date: null,
        notes: null,
        confidence_threshold: 0.6,
      }))
      setPersons(append ? [...useStore.getState().persons, ...persons] : persons)
      setHasMore(pageNum < response.total_pages)
    } catch (err) {
      setError('Failed to load people')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, setLoading, setPersons])

  const initialLoad = useRef(true)
  useEffect(() => {
    const delay = initialLoad.current ? 0 : 300
    initialLoad.current = false
    const timer = window.setTimeout(() => {
      void loadPersons(1, false)
      setPage(1)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [loadPersons])

  const handlePersonClick = (person: Person) => {
    if (currentPerson?.id === person.id) {
      setCurrentPerson(null)
      onPersonSelect(0) // Clear filter
    } else {
      setCurrentPerson(person)
      onPersonSelect(person.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">People</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
            aria-label="Search people"
          />
        </div>
      </div>

      {/* Person List */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : storePersons.length === 0 && !isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <p>No people found</p>
            <button className="btn-primary mt-2 text-sm" onClick={() => api.scanPhotos(false)}>
              Scan Photos
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100" role="listbox" aria-label="People">
            {storePersons.map((person) => (
              <PersonListItem
                key={person.id}
                person={person}
                isSelected={currentPerson?.id === person.id}
                onClick={() => handlePersonClick(person)}
              />
            ))}
            {hasMore && !isLoading && (
              <li className="p-4 text-center">
                <button
                  className="btn-secondary text-sm"
                  onClick={() => loadPersons(page + 1, true)}
                >
                  Load more
                </button>
              </li>
            )}
            {isLoading && page === 1 && (
              <li className="p-4 text-center">
                <Loader2 className="mx-auto animate-spin h-8 w-8 text-primary-600" />
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button className="w-full btn-secondary justify-center gap-2" onClick={() => window.dispatchEvent(new Event('open-create-person'))}>
          <UserPlus size={18} />
          <span>Add Person Manually</span>
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          {storePersons.length} person{storePersons.length !== 1 ? 's' : ''} total
        </p>
      </div>
    </div>
  )
}

function PersonListItem({
  person,
  isSelected,
  onClick,
}: {
  person: Person
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        className={clsx(
          'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
          isSelected
            ? 'bg-primary-50 border-l-2 border-primary-500'
            : 'hover:bg-gray-50'
        )}
        onClick={onClick}
        role="option"
        aria-selected={isSelected}
      >
        {/* Avatar */}
        <div className="relative w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
          {person.reference_photo_id && (
            <img
              src={`/api/v1/photos/${person.reference_photo_id}/thumbnail`}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
          {!person.reference_photo_id && (
            <svg className="w-full h-full text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {person.display_name || person.name}
          </p>
          <p className="text-sm text-gray-500 truncate">
            {person.photo_count} photo{person.photo_count !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    </li>
  )
}
