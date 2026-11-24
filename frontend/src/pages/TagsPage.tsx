/** Tags page - manage hierarchical tags and tag-photo associations */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/services/api'
import { TagSidebar } from '@/components/TagSidebar'
import { PhotoGrid } from '@/components/PhotoGrid'
import { PhotoModal } from '@/components/PhotoModal'
import { Plus, Search, Tag as TagIcon, Trash2, Edit, X } from 'lucide-react'
import { useStore } from '@/hooks/useStore'
import type { Tag } from '@/types'

export function TagsPage() {
  const {
    photos: storePhotos,
    setPhotos,
    addPhotos,
    selectedPhotoIds,
    viewMode,
    isLoading,
  } = useStore()

  const [tags, setTagsLocal] = useState<Tag[]>([])
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoadingLocal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '', color: '#3b82f6', parent_id: undefined as number | undefined })
  const [searchQuery, setSearchQuery] = useState('')

  // Load tags
  useEffect(() => {
    const loadTags = async () => {
      setLoadingLocal(true)
      try {
        const response = await api.getTags()
        setTagsLocal(response.items || [])
      } catch (err) {
        console.error('Failed to load tags:', err)
      } finally {
        setLoadingLocal(false)
      }
    }
    loadTags()
  }, [])

  // Load photos for selected tag
  useEffect(() => {
    const loadPhotos = async () => {
      setLoadingLocal(true)
      try {
        const response = await api.getPhotos({ tag_id: selectedTagId ?? undefined, page: 1, per_page: viewMode === 'grid' ? 50 : 25 })
        setPhotos(response.items)
        setTotalPages(response.total_pages)
        setHasMore(response.total_pages > 1)
        setPage(1)
      } catch (err) {
        console.error('Failed to load photos:', err)
      } finally {
        setLoadingLocal(false)
      }
    }
    void loadPhotos()
  }, [selectedTagId, viewMode, setPhotos])

  const loadMorePhotos = useCallback(async () => {
    if (!selectedTagId) return
    setLoadingLocal(true)
    try {
      const response = await api.getPhotos({ tag_id: selectedTagId, page: page + 1, per_page: viewMode === 'grid' ? 50 : 25 })
      addPhotos(response.items)
      setTotalPages(response.total_pages)
      setHasMore(page + 1 < response.total_pages)
      setPage(page + 1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingLocal(false)
    }
  }, [addPhotos, page, selectedTagId, setLoadingLocal, viewMode])

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 500
      ) {
        if (hasMore && !isLoading && page < totalPages && selectedTagId) {
          void loadMorePhotos()
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, isLoading, loadMorePhotos, page, totalPages, selectedTagId])

  const handleTagSelect = (tagId: number) => {
    setSelectedTagId(tagId === selectedTagId ? null : tagId)
  }

  const handleCreateTag = async () => {
    try {
      await api.createTag(formData)
      setShowCreateModal(false)
      setFormData({ name: '', description: '', color: '#3b82f6', parent_id: undefined })
      // Reload tags
      const response = await api.getTags()
      setTagsLocal(response.items || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleEditTag = async () => {
    if (!editingTag) return
    try {
      await api.updateTag(editingTag.id, formData)
      setShowEditModal(false)
      setEditingTag(null)
      // Reload tags
      const response = await api.getTags()
      setTagsLocal(response.items || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('Delete this tag? This will remove it from all photos.')) return
    try {
      await api.deleteTag(tagId)
      // Reload tags
      const response = await api.getTags()
      setTagsLocal(response.items || [])
      if (selectedTagId === tagId) setSelectedTagId(null)
    } catch (err) {
      console.error(err)
    }
  }

  const openCreateModal = (parentId?: number) => {
    setFormData({ name: '', description: '', color: '#3b82f6', parent_id: parentId })
    setShowCreateModal(true)
  }

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag)
    setFormData({ name: tag.name, description: tag.description || '', color: tag.color || '#3b82f6', parent_id: tag.parent_id ?? undefined })
    setShowEditModal(true)
  }

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
        <button className="btn-primary" onClick={() => openCreateModal()}>
          <Plus size={18} className="mr-1" />
          Create Tag
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Tag Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white hidden lg:block">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="search"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <TagSidebar
            tags={filteredTags}
            selectedTagId={selectedTagId}
            onTagSelect={handleTagSelect}
            loading={loading}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Mobile tag selector */}
          <div className="lg:hidden p-4 border-b border-gray-200">
            <select
              value={selectedTagId || ''}
              onChange={(e) => setSelectedTagId(e.target.value ? parseInt(e.target.value) : null)}
              className="input w-full"
            >
              <option value="">All Photos</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>{'  '.repeat(tag.level || 0)} {tag.name} ({tag.usage_count})</option>
              ))}
            </select>
          </div>

          {/* Tag info header */}
          {selectedTagId && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const tag = tags.find(t => t.id === selectedTagId)
                    if (!tag) return null
                    return (
                      <>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (tag.color as string | undefined) ?? '#6b7280' }}>
                          <TagIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">{tag.name}</h2>
                          <p className="text-sm text-gray-500">{tag.usage_count} photos</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary text-sm" onClick={() => {
                    const tag = tags.find(t => t.id === selectedTagId)
                    if (tag) openEditModal(tag)
                  }}>
                    <Edit size={16} className="mr-1" />
                    Edit
                  </button>
                  <button className="btn-ghost text-red-600 hover:bg-red-50 text-sm" onClick={() => handleDeleteTag(selectedTagId!)}>
                    <Trash2 size={16} className="mr-1" />
                    Delete
                  </button>
                  <button className="btn-ghost" onClick={() => setSelectedTagId(null)}>
                    <X size={16} className="mr-1" />
                    Clear
                  </button>
                </div>
              </div>
              {(() => {
                const tag = tags.find(t => t.id === selectedTagId)
                if (!tag?.description) return null
                return <p className="mt-2 text-gray-600">{tag.description}</p>
              })()}
            </div>
          )}

          {/* Photos Grid */}
          <div className="flex-1 min-h-0">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedTagId
                  ? `Photos in "${tags.find(t => t.id === selectedTagId)?.name}"`
                  : 'All Photos'}
                <span className="text-normal font-normal text-gray-500 ml-2">({storePhotos.length})</span>
              </h3>
            </div>

            {storePhotos.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-[40vh] text-center">
                <TagIcon className="text-6xl text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {selectedTagId ? 'No photos with this tag' : 'No photos yet'}
                </h3>
                <p className="text-gray-500">
                  {selectedTagId
                    ? 'Add this tag to photos from the gallery'
                    : 'Scan photos and add tags to organize them'}
                </p>
              </div>
            ) : (
              <PhotoGrid
                photos={storePhotos}
                viewMode={viewMode}
                selectedIds={selectedPhotoIds}
                onPhotoClick={(id) => setSelectedPhoto(id)}
                onLoadMore={hasMore && !isLoading ? loadMorePhotos : undefined}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <PhotoModal
          photoId={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}

      {/* Create Tag Modal */}
      {showCreateModal && (
        <TagModal
          title="Create Tag"
          data={formData}
          onChange={setFormData}
          onSave={handleCreateTag}
          onCancel={() => { setShowCreateModal(false); setFormData({ name: '', description: '', color: '#3b82f6', parent_id: undefined }) }}
          tags={tags}
        />
      )}

      {/* Edit Tag Modal */}
      {showEditModal && (
        <TagModal
          title="Edit Tag"
          data={formData}
          onChange={setFormData}
          onSave={handleEditTag}
          onCancel={() => { setShowEditModal(false); setEditingTag(null) }}
          tags={tags.filter(t => t.id !== editingTag?.id)}
          excludeId={editingTag?.id}
        />
      )}
    </div>
  )
}

function TagModal({
  title,
  data,
  onChange,
  onSave,
  onCancel,
  tags,
  excludeId,
}: {
  title: string
  data: { name: string; description: string; color: string; parent_id: number | undefined }
  onChange: (data: { name: string; description: string; color: string; parent_id: number | undefined }) => void
  onSave: () => void
  onCancel: () => void
  tags: Tag[]
  excludeId?: number
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost p-1" onClick={onCancel}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={data.description}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              className="input min-h-[80px] resize-y"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="label">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={data.color}
                onChange={(e) => onChange({ ...data, color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={data.color}
                onChange={(e) => onChange({ ...data, color: e.target.value })}
                className="input flex-1 font-mono text-sm"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          <div>
            <label className="label">Parent Tag</label>
            <select
              value={data.parent_id ?? ''}
              onChange={(e) => onChange({ ...data, parent_id: e.target.value ? parseInt(e.target.value) : undefined })}
              className="input"
            >
              <option value="">None (Root level)</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id} disabled={tag.id === excludeId}>
                  {'  '.repeat(tag.level || 0)} {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onSave}>{title}</button>
        </div>
      </div>
    </div>
  )
}
