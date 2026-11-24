import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users, UserPlus } from 'lucide-react'
import { api } from '@/services/api'
import type { PersonSummary } from '@/types'

export function PersonsPage() {
  const [persons, setPersons] = useState<PersonSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    api.getPersons({ page: 1, per_page: 100, search: search.trim() || undefined, only_with_photos: false })
      .then((response) => {
        if (active) setPersons(response.items)
      })
      .catch(() => {
        if (active) setError('Could not load people. Check the local app connection and try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [search])

  return (
    <section className="flex-1 min-h-0" aria-labelledby="people-heading">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 id="people-heading" className="text-2xl font-bold text-gray-900">People</h1>
          <p className="mt-1 text-sm text-gray-500">Browse people recognized or added in your local library.</p>
        </div>
        <label className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
          <input
            type="search"
            className="input w-full pl-10"
            placeholder="Search people..."
            aria-label="Search people"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button className="btn-primary" onClick={() => window.dispatchEvent(new Event('open-create-person'))}>
          <UserPlus size={18} className="mr-2" />Add Person
        </button>
      </div>

      {loading ? (
        <p role="status" className="py-12 text-center text-gray-500">Loading people…</p>
      ) : error ? (
        <div role="alert" className="py-12 text-center text-red-600">{error}</div>
      ) : persons.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          <Users className="mx-auto mb-3 text-gray-300" size={44} aria-hidden="true" />
          <h2 className="text-lg font-medium text-gray-900">{search ? 'No matching people' : 'No people yet'}</h2>
          <p className="mt-1">{search ? 'Try a different search.' : 'People will appear here after you add them or review face matches.'}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="People">
          {persons.map((person) => (
            <li key={person.id}>
              <Link to={`/person/${person.id}`} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  {person.reference_photo_id ? (
                    <img src={`/api/v1/photos/${person.reference_photo_id}/thumbnail`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Users className="m-auto mt-3 text-gray-400" size={24} aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{person.display_name || person.name}</p>
                  <p className="text-sm text-gray-500">{person.photo_count} {person.photo_count === 1 ? 'photo' : 'photos'}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
