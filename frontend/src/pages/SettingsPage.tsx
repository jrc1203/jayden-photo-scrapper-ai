/** Settings page - configure the application */
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useStore } from '@/hooks/useStore'
import { FolderOpen, Cpu, MemoryStick, Database, Save, Loader2, AlertCircle, CheckCircle, Trash2, RefreshCw } from 'lucide-react'
import type { ScanStats } from '@/types'

export function SettingsPage() {
  const {
    settings: storeSettings,
    setSettings,
    setPhotoDirectory,
    setScanning: setGlobalScanning,
  } = useStore()

  const [settings, setSettingsLocal] = useState<typeof storeSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState<ScanStats | null>(null)
  const [scanning, setScanning] = useState(false)
  const [editingPhotoDirectory, setEditingPhotoDirectory] = useState(false)
  const [stats, setStats] = useState<{
    total_photos: number
    total_persons: number
    total_relationships: number
    total_tags: number
    db_size_mb: number
    photos_with_faces: number
    photos_without_faces: number
  } | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.getSettings()
      setSettingsLocal(data)
      setSettings(data)
    } catch (err) {
      setError('Failed to load settings')
    }
  }, [setSettings])

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [])

  // Load settings on mount
  useEffect(() => {
    void loadSettings()
    void loadStats()
  }, [loadSettings, loadStats])

  const handleSaveSettings = async () => {
    if (!settings) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const savedSettings = await api.updateSettings({
        thumbnail_quality: settings.thumbnail_quality,
        photo_directory: settings.photo_directory,
      })
      setSettingsLocal(savedSettings)
      setSettings(savedSettings)
      setEditingPhotoDirectory(false)
      setSuccess('Settings saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save settings. Check the folder path and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleScanPhotos = async () => {
    setScanning(true)
    setGlobalScanning(true)
    setScanProgress(null)
    setError(null)
    try {
      const result = await api.scanPhotos()
      setScanProgress(result)
      setSuccess(`Scan complete: ${result.new_photos} new photos, ${result.updated_photos} updated`)
      loadStats()
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError('Scan failed')
    } finally {
      setScanning(false)
      setGlobalScanning(false)
      setScanProgress(null)
    }
  }

  const handleInferRelationships = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.inferRelationships()
      setSuccess('Relationship inference complete')
      loadStats()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Relationship inference failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClearDatabase = async () => {
    if (!window.confirm('This permanently deletes all people, relationships, tags, face links, and indexed photos. Your source photo files are not deleted. Continue?')) return
    if (window.prompt('Type DELETE to confirm clearing the local database.') !== 'DELETE') return
    setLoading(true)
    try {
      await api.clearDatabase()
      setSuccess('Database cleared')
      loadStats()
      loadSettings()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to clear database')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      {/* Photo Directory */}
      <section className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FolderOpen size={24} className="text-primary-600" />
          Photo Directory
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Source Folder</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings?.photo_directory || ''}
                onChange={(e) => {
                  const newSettings = { ...settings, photo_directory: e.target.value } as typeof settings
                  setSettingsLocal(newSettings)
                  setSettings(newSettings)
                  setPhotoDirectory(e.target.value)
                }}
                className="input flex-1 font-mono text-sm bg-gray-50"
                readOnly={!editingPhotoDirectory}
                aria-label="Source photo folder path"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditingPhotoDirectory((editing) => !editing)}
              >
                {editingPhotoDirectory ? 'Lock path' : 'Edit path'}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              This web build cannot open a native folder picker. Select Edit path, paste the full local folder path, then Save Settings. Photos remain in place; the app reads them and generates thumbnails.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              className="btn-primary"
              onClick={handleScanPhotos}
              disabled={scanning || loading}
            >
              {scanning ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw size={18} className="mr-2" />
                  Scan Photos
                </>
              )}
            </button>
            {scanProgress && (
              <div className="text-sm text-gray-600">
                {scanProgress.new_photos} new, {scanProgress.updated_photos} updated, {scanProgress.errors} errors
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Face Recognition */}
      <section className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Cpu size={24} className="text-primary-600" />
          Face Recognition
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Model</label>
              <select
                value={settings?.face_recognition_model || 'hog'}
                onChange={(e) => {
                  const newSettings = { ...settings, face_recognition_model: e.target.value } as typeof settings
                  setSettingsLocal(newSettings)
                  setSettings(newSettings)
                }}
                className="input"
                disabled
              >
                <option value="hog">HOG (Faster, CPU)</option>
                <option value="cnn">CNN (More accurate, GPU)</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">HOG is faster on CPU. CNN requires GPU but is more accurate.</p>
            </div>
            <div>
              <label className="label">Tolerance</label>
              <input
                type="range"
                min="0.3"
                max="0.6"
                step="0.01"
                disabled
                value={settings?.face_tolerance || 0.5}
                onChange={(e) => {
                  const newSettings = { ...settings, face_tolerance: parseFloat(e.target.value) } as typeof settings
                  setSettingsLocal(newSettings)
                  setSettings(newSettings)
                }}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Strict (0.3)</span>
                <span>{settings?.face_tolerance?.toFixed(2) || '0.50'}</span>
                <span>Lenient (0.6)</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Lower = stricter matching. Higher = more matches but more false positives.</p>
            </div>
          </div>

          <div>
            <label className="label">Min Face Size</label>
            <input
              type="number"
              value={settings?.min_face_size || 50}
              onChange={(e) => {
                const newSettings = { ...settings, min_face_size: parseInt(e.target.value) } as typeof settings
                setSettingsLocal(newSettings)
                setSettings(newSettings)
              }}
              min="20"
              max="200"
              className="input w-32"
              disabled
            />
            <p className="text-sm text-gray-500 mt-1">Minimum face size in pixels to detect. Smaller = detects distant faces but slower.</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
            Face matching is paused until a review step is available. This prevents automatic identity assignment without your confirmation.
          </div>
        </div>
      </section>

      {/* Thumbnail Settings */}
      <section className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MemoryStick size={24} className="text-primary-600" />
          Thumbnails
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Thumbnail Size</label>
            <select
              value={settings?.thumbnail_size || 300}
              disabled
              onChange={(e) => {
                const newSettings = { ...settings, thumbnail_size: parseInt(e.target.value) } as typeof settings
                setSettingsLocal(newSettings)
                setSettings(newSettings)
              }}
              className="input"
            >
              <option value="150">150px (Small)</option>
              <option value="300">300px (Medium)</option>
              <option value="500">500px (Large)</option>
              <option value="800">800px (Extra Large)</option>
            </select>
          </div>
          <div>
            <label className="label">Quality</label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={settings?.thumbnail_quality || 85}
              onChange={(e) => {
                const newSettings = { ...settings, thumbnail_quality: parseInt(e.target.value) } as typeof settings
                setSettingsLocal(newSettings)
                setSettings(newSettings)
              }}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>50</span>
              <span>{settings?.thumbnail_quality || 85}</span>
              <span>95</span>
            </div>
          </div>
          <div>
            <label className="label">Format</label>
            <select
              value={settings?.thumbnail_format || 'webp'}
              disabled
              onChange={(e) => {
                const newSettings = { ...settings, thumbnail_format: e.target.value } as typeof settings
                setSettingsLocal(newSettings)
                setSettings(newSettings)
              }}
              className="input"
            >
              <option value="webp">WebP (Best compression)</option>
              <option value="jpeg">JPEG (Wide compatibility)</option>
              <option value="png">PNG (Lossless)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Database */}
      <section className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database size={24} className="text-primary-600" />
          Database
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Database Size</p>
              <p className="text-2xl font-bold text-gray-900">{stats ? formatBytes(stats.db_size_mb * 1024 * 1024) : '—'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Photos</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_photos || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Persons</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_persons || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Relationships</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_relationships || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Tags</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_tags || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Photos with Faces</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.photos_with_faces || 0}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              className="btn-secondary"
              onClick={handleInferRelationships}
              disabled={loading}
            >
              <RefreshCw size={18} className="mr-2" />
              Infer Relationships
            </button>
            <button
              className="btn-ghost text-red-600 hover:bg-red-50"
              onClick={handleClearDatabase}
              disabled={loading}
            >
              <Trash2 size={18} className="mr-2" />
              Clear Database
            </button>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Photo directory and thumbnail quality are saved. Other displayed settings are not persisted yet.
          </p>
          <button
            className="btn-primary self-start sm:self-auto whitespace-nowrap"
            onClick={handleSaveSettings}
            disabled={loading || !settings}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  )
}
