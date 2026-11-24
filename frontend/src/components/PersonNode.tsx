/** Custom person node for React Flow mind map */
import { Handle, Position } from 'reactflow'
import { clsx } from 'clsx'

interface PersonNodeProps {
  data: {
    id: number
    label: string
    name: string
    referencePhotoId: number | null
    size: number
  }
  selected?: boolean
}

export function PersonNode({ data, selected }: PersonNodeProps) {
  const { label, referencePhotoId, size } = data

  return (
    <div
      className={clsx(
        'react-flow__node-person flex flex-col items-center gap-2',
        selected && 'selected'
      )}
      style={{ minWidth: Math.max(140, size * 4) }}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-transparent" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-transparent" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-transparent" />

      {/* Avatar */}
      <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 ring-2 ring-white shadow-md">
        {referencePhotoId ? (
          <img
            src={`/api/v1/photos/${referencePhotoId}/thumbnail`}
            alt={label}
            className="person-avatar w-full h-full object-cover"
          />
        ) : (
          <svg className="w-full h-full text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
        {selected && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center ring-2 ring-white">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="text-center px-2">
        <p className="font-medium text-gray-900 text-sm truncate w-full max-w-[140px]" title={label}>
          {label}
        </p>
        <p className="text-xs text-gray-500 truncate w-full max-w-[140px]" title={data.name}>
          {data.name}
        </p>
      </div>
    </div>
  )
}