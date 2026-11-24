/** Main application layout with sidebar and navigation */
import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '@/hooks/useStore'
import { api } from '@/services/api'
import { CreatePersonModal } from '@/components/CreatePersonModal'
import {
  LayoutDashboard,
  Users,
  GitBranch,
  Tag,
  Settings,
  Search,
  Grid,
  List,
  RotateCcw,
  Plus,
  Menu,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showCreatePerson, setShowCreatePerson] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const {
    sidebarOpen,
    viewMode,
    searchQuery,
    isScanning,
    setSidebarOpen,
    setViewMode,
    setSearchQuery,
    setScanning,
  } = useStore()

  useEffect(() => {
    const openCreatePerson = () => setShowCreatePerson(true)
    window.addEventListener('open-create-person', openCreatePerson)
    return () => window.removeEventListener('open-create-person', openCreatePerson)
  }, [])

  const handleScan = async () => {
    setActionError(null)
    setActionMessage(null)
    setScanning(true)
    try {
      const result = await api.scanPhotos(false)
      setActionMessage(`Scan complete: ${result.new_photos} new, ${result.updated_photos} updated.`)
      window.dispatchEvent(new Event('photos:updated'))
    } catch {
      setActionError('Photo scan failed. Check the source folder and try again.')
    } finally {
      setScanning(false)
    }
  }

  const handleCreatePerson = (personId: number) => {
    setShowCreatePerson(false)
    window.dispatchEvent(new Event('persons:updated'))
    navigate(`/person/${personId}`)
  }

  const navItems = [
    { path: '/gallery', label: 'Gallery', icon: LayoutDashboard },
    { path: '/mindmap', label: 'Mind Map', icon: GitBranch },
    { path: '/persons', label: 'People', icon: Users },
    { path: '/tags', label: 'Tags', icon: Tag },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu button */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden btn-secondary"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Jayden Photo AI</h1>
          <button
            className="lg:hidden btn-ghost p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            className="w-full btn-secondary justify-start gap-3"
            onClick={handleScan}
            disabled={isScanning}
          >
            <RotateCcw size={18} className={isScanning ? 'animate-spin' : ''} />
            <span>{isScanning ? 'Scanning...' : 'Scan Photos'}</span>
          </button>

          <button
            className="w-full btn-secondary justify-start gap-3 opacity-60 cursor-not-allowed"
            disabled
            title="Face assignment is paused until the review-before-assign workflow is available."
          >
            <Users size={18} />
            <span>Face Review Required</span>
          </button>

          <button
            className="w-full btn-primary justify-start gap-3"
            onClick={() => setShowCreatePerson(true)}
          >
            <Plus size={18} />
            <span>Add Person</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={clsx(
          'flex-1 flex flex-col overflow-hidden',
          sidebarOpen ? 'lg:ml-72' : 'lg:ml-0'
        )}
      >
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden btn-ghost p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex bg-gray-100 rounded-lg p-1" role="group" aria-label="View mode">
              <button
                className={clsx(
                  'p-2 rounded transition-colors',
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                )}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <Grid size={18} />
              </button>
              <button
                className={clsx(
                  'p-2 rounded transition-colors',
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                )}
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="search"
                placeholder="Search photos by name or camera..."
                className="input pl-10 w-64 sm:w-80"
                aria-label="Search photos by name or camera"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {actionError && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{actionError}</div>}
          {actionMessage && <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">{actionMessage}</div>}
          <Outlet />
        </div>
      </main>
      {showCreatePerson && (
        <CreatePersonModal
          onClose={() => setShowCreatePerson(false)}
          onCreated={handleCreatePerson}
        />
      )}
    </div>
  )
}
