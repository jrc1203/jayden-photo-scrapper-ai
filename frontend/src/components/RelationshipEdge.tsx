/** Custom relationship edge for React Flow mind map */
import type { EdgeProps } from 'reactflow'

interface RelationshipEdgeData {
  type: string
  confidence: number
  verified: boolean
  label: string
}

const getTypeColor = (type: string) => {
  const familyTypes = ['spouse', 'partner', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'uncle_aunt', 'niece_nephew', 'cousin', 'in_law']
  const socialTypes = ['friend', 'close_friend', 'acquaintance', 'colleague', 'classmate', 'neighbor']
  const professionalTypes = ['manager', 'reports_to', 'mentor', 'mentee', 'business_partner']

  if (familyTypes.includes(type)) return '#f59e0b'
  if (socialTypes.includes(type)) return '#3b82f6'
  if (professionalTypes.includes(type)) return '#22c55e'
  return '#a855f7'
}

export function RelationshipEdge({
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  id,
  selected,
}: EdgeProps<RelationshipEdgeData> & { id: string; selected?: boolean }) {
  const { type, confidence, verified, label } = data || { type: '', confidence: 1, verified: false, label: '' }

  const baseColor = getTypeColor(type)
  const strokeColor = verified ? '#22c55e' : baseColor
  const strokeWidth = selected ? 4 : (verified ? 3 : 2)
  const strokeDasharray = verified ? 'none' : '6 4'

  // Format label
  const formattedLabel = label.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  // Calculate angle for label rotation
  const angle = Math.atan2(targetY - sourceY, targetX - sourceX) * (180 / Math.PI)
  const labelRotation = angle > 90 || angle < -90 ? angle + 180 : angle

  return (
    <svg
      id={id}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <path
        d={`M${sourceX},${sourceY} Q${(sourceX + targetX) / 2},${(sourceY + targetY) / 2} ${targetX},${targetY}`}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={strokeDasharray}
        opacity={confidence}
        style={{ transition: 'all 0.2s' }}
      />
      <defs>
        <marker
          id={`arrowhead-${strokeColor.replace('#', '')}`}
          markerWidth={12}
          markerHeight={12}
          refX={10}
          refY={6}
          orient="auto"
        >
          <path d="M0,0 L12,6 L0,12 Z" fill={strokeColor} />
        </marker>
      </defs>
      <text
        x={(sourceX + targetX) / 2}
        y={(sourceY + targetY) / 2 - 10}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight={500}
        fill="#374151"
        pointerEvents="none"
        transform={`rotate(${labelRotation} ${(sourceX + targetX) / 2} ${(sourceY + targetY) / 2 - 10})`}
      >
        {formattedLabel}
      </text>
    </svg>
  )
}