/** Mind Map page - visual relationship graph */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  Connection,
  useReactFlow,
  OnNodesChange,
  OnEdgesChange,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { api } from '@/services/api'
import { useStore } from '@/hooks/useStore'
import { PersonNode } from '@/components/PersonNode'
import { RelationshipEdge } from '@/components/RelationshipEdge'
import { Search, ZoomIn, ZoomOut, RotateCcw, Home, UserPlus, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { RelationshipType } from '@/types'

// Custom node and edge types
const nodeTypes: NodeTypes = {
  person: PersonNode,
}

const edgeTypes: EdgeTypes = {
  relationship: RelationshipEdge,
}

export function MindMapPage() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()
  const {
    setMindMapData,
    setCurrentPerson,
    persons: storePersons,
  } = useStore()

  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [depth, setDepth] = useState(2)
  const [showMiniMap, setShowMiniMap] = useState(true)
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  const [connectionType, setConnectionType] = useState<RelationshipType>('friend')
  const [savingConnection, setSavingConnection] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const { fitView, setCenter, zoomIn, zoomOut } = useReactFlow()

  // Load mind map data
  const loadMindMap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMindMap(
        personId ? parseInt(personId) : undefined,
        depth
      )

      // Convert to React Flow nodes and edges
      const rfNodes: Node[] = data.nodes.map((n) => ({
        id: String(n.id),
        type: 'person',
        position: { x: 0, y: 0 }, // Will be auto-layouted
        data: {
          id: n.id,
          label: n.label,
          name: n.name,
          referencePhotoId: n.reference_photo_id,
          size: n.size,
        },
      }))

      const rfEdges: Edge[] = data.edges.map((e) => ({
        id: `${e.from}-${e.to}-${e.type}`,
        source: String(e.from),
        target: String(e.to),
        type: 'relationship',
        data: {
          type: e.type,
          confidence: e.confidence,
          verified: e.verified,
          label: e.label,
        },
        animated: e.verified,
        style: {
          strokeWidth: e.verified ? 3 : 2,
          stroke: e.verified ? '#22c55e' : '#94a3b8',
        },
      }))

      setNodes(rfNodes)
      setEdges(rfEdges)
      setMindMapData(data)

      // Fit view after layout
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 100)
    } catch (err) {
      setError('Failed to load mind map')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [personId, depth, fitView, setMindMapData])

  useEffect(() => {
    loadMindMap()
  }, [loadMindMap])

  // Handle node double-click to navigate
  const onNodeDoubleClick = (_event: React.MouseEvent, node: Node) => {
    const personId = node.data.id
    navigate(`/person/${personId}`)
  }

  // Handle node click to select in sidebar
  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    const personId = node.data.id
    const person = storePersons.find((p) => p.id === personId)
    if (person) {
      setCurrentPerson(person)
    }
  }

  // Persist manually drawn connections only after the user confirms a type.
  const onConnect = (connection: Connection) => {
    if (connection.source && connection.target && connection.source !== connection.target) {
      setConnectionError(null)
      setConnectionType('friend')
      setPendingConnection(connection)
    }
  }

  const handleCreateConnection = async () => {
    if (!pendingConnection?.source || !pendingConnection.target) return
    setSavingConnection(true)
    setConnectionError(null)
    try {
      await api.createRelationship({
        person_id: Number(pendingConnection.source),
        related_person_id: Number(pendingConnection.target),
        relationship_type: connectionType,
        is_verified: false,
        is_current: true,
      })
      setPendingConnection(null)
      await loadMindMap()
    } catch {
      setConnectionError('Could not save this relationship. It may already exist.')
    } finally {
      setSavingConnection(false)
    }
  }

  const handleFitView = () => fitView({ padding: 0.2, duration: 500 })
  const handleZoomIn = () => zoomIn()
  const handleZoomOut = () => zoomOut()
  const handleReset = () => setCenter(0, 0, { zoom: 1, duration: 300 })

  // Correct handlers for React Flow
  const onNodesChange: OnNodesChange = (changes) => {
    setNodes((nds) => {
      // Apply changes manually since we're using useState
      let newNodes = [...nds]
      for (const change of changes) {
        if (change.type === 'position' && change.dragging) {
          newNodes = newNodes.map((n) =>
            n.id === change.id ? { ...n, position: change.position as { x: number; y: number } } : n
          )
        } else if (change.type === 'remove') {
          newNodes = newNodes.filter((n) => n.id !== change.id)
        } else if (change.type === 'add') {
          newNodes = [...newNodes, change.item]
        }
      }
      return newNodes
    })
  }

  const onEdgesChange: OnEdgesChange = (changes) => {
    setEdges((eds) => {
      let newEdges = [...eds]
      for (const change of changes) {
        if (change.type === 'remove') {
          newEdges = newEdges.filter((e) => e.id !== change.id)
        } else if (change.type === 'add') {
          newEdges = [...newEdges, change.item]
        }
      }
      return newEdges
    })
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Mind Map</h2>

          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-64"
              aria-label="Search people in mind map"
            />
          </div>

          {/* Depth selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Depth:</label>
            <select
              value={depth}
              onChange={(e) => setDepth(parseInt(e.target.value))}
              className="input py-1.5 text-sm w-24"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-secondary p-2" onClick={handleZoomOut} aria-label="Zoom out">
            <ZoomOut size={18} />
          </button>
          <button className="btn-secondary p-2" onClick={handleZoomIn} aria-label="Zoom in">
            <ZoomIn size={18} />
          </button>
          <button className="btn-secondary p-2" onClick={handleFitView} aria-label="Fit view">
            <RotateCcw size={18} />
          </button>
          <button className="btn-secondary p-2" onClick={handleReset} aria-label="Reset view">
            <Home size={18} />
          </button>
          <button className="btn-secondary p-2" onClick={() => setShowMiniMap(!showMiniMap)} aria-label="Toggle minimap">
            <svg className={clsx('w-5 h-5', showMiniMap ? 'text-gray-900' : 'text-gray-400')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
            <button className="btn-primary" onClick={() => window.dispatchEvent(new Event('open-create-person'))}>
              <UserPlus size={18} className="mr-1" />
            Add Person
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="animate-spin h-10 w-10 text-primary-600" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center text-red-500">
              <p>{error}</p>
              <button className="btn-primary mt-4" onClick={loadMindMap}>Retry</button>
            </div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="text-center text-gray-500">
              <svg className="mx-auto text-6xl text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-lg font-medium mb-2">No connections found</p>
              <p>Scan photos and process faces to build the mind map</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView={false}
            attributionPosition="bottom-left"
          >
            <Background
              color="#e5e7eb"
              gap={16}
            />
            <Controls
              showZoom={false}
              showFitView={false}
              showInteractive={false}
            />
            {showMiniMap && (
              <MiniMap
                nodeColor={(node) => node.data.verified ? '#22c55e' : '#0ea5e9'}
                maskColor="rgba(14, 165, 233, 0.1)"
              />
            )}
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur rounded-lg p-3 shadow-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Legend</h4>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-green-500" />
              <span className="text-gray-600">Verified relationship</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 border-2 border-gray-400 rounded" />
              <span className="text-gray-600">Inferred/Unverified</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 border-2 border-amber-500 rounded border-dashed" />
              <span className="text-gray-600">Family</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 border-2 border-blue-500 rounded border-dashed" />
              <span className="text-gray-600">Social</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 border-2 border-green-500 rounded border-dashed" />
              <span className="text-gray-600">Professional</span>
            </div>
          </div>
        </div>
      </div>
      {pendingConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingConnection) setPendingConnection(null) }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="mindmap-relationship-title">
            <h3 id="mindmap-relationship-title" className="text-lg font-semibold">Create relationship</h3>
            <p className="my-3 text-sm text-gray-600">Choose the relationship type. It will remain unverified until you review it.</p>
            {connectionError && <p role="alert" className="mb-3 text-sm text-red-600">{connectionError}</p>}
            <label className="block">
              <span className="label">Relationship type</span>
              <select className="input" value={connectionType} onChange={(event) => setConnectionType(event.target.value as RelationshipType)}>
                {(['spouse','partner','parent','child','sibling','grandparent','grandchild','uncle_aunt','niece_nephew','cousin','in_law','friend','close_friend','acquaintance','colleague','classmate','neighbor','manager','reports_to','mentor','mentee','business_partner','custom'] as RelationshipType[]).map((type) => (
                  <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setPendingConnection(null)} disabled={savingConnection}>Cancel</button>
              <button className="btn-primary" onClick={() => void handleCreateConnection()} disabled={savingConnection}>{savingConnection ? 'Saving…' : 'Save relationship'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}