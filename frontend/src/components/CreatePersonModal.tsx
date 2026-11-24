import { useState, type FormEvent } from 'react'
import { api } from '@/services/api'

interface CreatePersonModalProps {
  onClose: () => void
  onCreated: (personId: number) => void
}

export function CreatePersonModal({ onClose, onCreated }: CreatePersonModalProps) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Enter a name to create this person.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const person = await api.createPerson({
        name: name.trim(),
        display_name: displayName.trim() || undefined,
        birth_date: birthDate || undefined,
        notes: notes.trim() || undefined,
      })
      onCreated(person.id)
    } catch {
      setError('Could not create the person. Check the name and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="w-full max-w-md rounded-xl bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="create-person-title" onSubmit={handleSubmit}>
        <div className="border-b border-gray-200 p-4">
          <h2 id="create-person-title" className="text-lg font-semibold">Add Person</h2>
        </div>
        <div className="space-y-4 p-4">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">Name *</span>
            <input className="input" autoFocus required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Display name</span>
            <input className="input" maxLength={255} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Birth date</span>
            <input className="input" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Notes</span>
            <textarea className="input min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Person'}</button>
        </div>
      </form>
    </div>
  )
}
