/** Tag sidebar for browsing and managing tags */
import { useState } from 'react'
import { Tag as TagIcon, Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import type { Tag } from '@/types'

interface TagSidebarProps {
  tags: Tag[]
  selectedTagId: number | null
  onTagSelect: (tagId: number) => void
  loading?: boolean
}

export function TagSidebar({
  tags,
  selectedTagId,
  onTagSelect,
  loading,
}: TagSidebarProps) {
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set())

  const toggleExpand = (tagId: number) => {
    setExpandedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        next.add(tagId)
      }
      return next
    })
  }

  const renderTagTree = (tagList: Tag[], depth = 0) => (
    <ul className="space-y-1" role="tree" aria-label="Tags">
      {tagList.map((tag) => (
        <li key={tag.id}>
          <TagTreeNode
            tag={tag}
            depth={depth}
            isExpanded={expandedTags.has(tag.id)}
            onToggle={() => toggleExpand(tag.id)}
            isSelected={selectedTagId === tag.id}
            onSelect={onTagSelect}
          />
        </li>
      ))}
    </ul>
  )

  const TagTreeNode = ({
    tag,
    depth,
    isExpanded,
    onToggle,
    isSelected,
    onSelect,
  }: {
    tag: Tag
    depth: number
    isExpanded: boolean
    onToggle: () => void
    isSelected: boolean
    onSelect: (tagId: number) => void
  }) => {
    const hasChildren = tag.children && tag.children.length > 0

    return (
      <div className="flex items-center gap-1">
        <div
          className={clsx(
            'flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer transition-colors',
            depth > 0 && 'ml-4',
            isSelected && 'bg-primary-50 border-l-2 border-primary-500'
          )}
          onClick={() => onSelect(tag.id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}

          <TagIcon
            size={16}
            className="flex-shrink-0"
            style={{ color: tag.color || '#3B82F6' }}
          />
          <span className="font-medium text-gray-900 truncate">
            {tag.display_name || tag.name}
          </span>
          {tag.usage_count > 0 && (
            <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {tag.usage_count}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l border-gray-200 pl-2">
            {renderTagTree(tag.children!, depth + 1)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin h-8 w-8 text-primary-600" />
        </div>
      ) : tags.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          <TagIcon className="mx-auto text-4xl text-gray-300 mb-2" />
          <p>No tags yet</p>
        </div>
      ) : (
        renderTagTree(tags)
      )}
    </div>
  )
}