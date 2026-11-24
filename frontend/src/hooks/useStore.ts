/** Global state management with Zustand */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Person, Photo, PhotoSummary, Tag, Relationship, MindMapData, Settings } from '@/types'

interface AppState {
  // UI State
  sidebarOpen: boolean
  sidebarTab: 'persons' | 'tags' | 'relationships'
  viewMode: 'grid' | 'list'
  searchQuery: string
  selectedPhotoIds: number[]

  // Data State
  persons: Person[]
  currentPerson: Person | null
  photos: PhotoSummary[]
  tags: Tag[]
  relationships: Relationship[]
  mindMapData: MindMapData | null
  settings: Settings | null
  photoDirectory: string

  // Loading States
  isLoading: boolean
  isScanning: boolean
  isProcessingFaces: boolean

  // Actions
  setSidebarOpen: (open: boolean) => void
  setSidebarTab: (tab: 'persons' | 'tags' | 'relationships') => void
  setViewMode: (mode: 'grid' | 'list') => void
  setSearchQuery: (query: string) => void
  togglePhotoSelection: (photoId: number) => void
  clearPhotoSelection: () => void

  setPersons: (persons: Person[]) => void
  addPerson: (person: Person) => void
  updatePerson: (person: Person) => void
  removePerson: (personId: number) => void
  setCurrentPerson: (person: Person | null) => void

  setPhotos: (photos: PhotoSummary[]) => void
  addPhotos: (photos: PhotoSummary[]) => void
  updatePhoto: (photo: Photo) => void
  removePhoto: (photoId: number) => void

  setTags: (tags: Tag[]) => void
  addTag: (tag: Tag) => void
  updateTag: (tag: Tag) => void
  removeTag: (tagId: number) => void

  setRelationships: (relationships: Relationship[]) => void
  addRelationship: (relationship: Relationship) => void
  updateRelationship: (relationship: Relationship) => void
  removeRelationship: (relationshipId: number) => void

  setMindMapData: (data: MindMapData | null) => void

  setSettings: (settings: Settings | null) => void
  setPhotoDirectory: (dir: string) => void

  setLoading: (loading: boolean) => void
  setScanning: (scanning: boolean) => void
  setProcessingFaces: (processing: boolean) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial State
      sidebarOpen: true,
      sidebarTab: 'persons',
      viewMode: 'grid',
      searchQuery: '',
      selectedPhotoIds: [],

      persons: [],
      currentPerson: null,
      photos: [],
      tags: [],
      relationships: [],
      mindMapData: null,
  settings: null,
  photoDirectory: '',

  isLoading: false,
  isScanning: false,
  isProcessingFaces: false,

      // Actions
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      togglePhotoSelection: (photoId) =>
        set((state) => ({
          selectedPhotoIds: state.selectedPhotoIds.includes(photoId)
            ? state.selectedPhotoIds.filter((id) => id !== photoId)
            : [...state.selectedPhotoIds, photoId],
        })),
      clearPhotoSelection: () => set({ selectedPhotoIds: [] }),

      setPersons: (persons) => set({ persons }),
      addPerson: (person) => set((state) => ({ persons: [...state.persons, person] })),
      updatePerson: (person) =>
        set((state) => ({
          persons: state.persons.map((p) => (p.id === person.id ? person : p)),
          currentPerson: state.currentPerson?.id === person.id ? person : state.currentPerson,
        })),
      removePerson: (personId) =>
        set((state) => ({
          persons: state.persons.filter((p) => p.id !== personId),
          currentPerson: state.currentPerson?.id === personId ? null : state.currentPerson,
        })),
      setCurrentPerson: (person) => set({ currentPerson: person }),

      setPhotos: (photos) => set({ photos }),
      addPhotos: (photos) => set((state) => ({ photos: [...state.photos, ...photos] })),
      updatePhoto: (photo) =>
        set((state) => ({
          photos: state.photos.map((p) => (p.id === photo.id ? photo : p)),
        })),
      removePhoto: (photoId) =>
        set((state) => ({
          photos: state.photos.filter((p) => p.id !== photoId),
          selectedPhotoIds: state.selectedPhotoIds.filter((id) => id !== photoId),
        })),

      setTags: (tags) => set({ tags }),
      addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
      updateTag: (tag) =>
        set((state) => ({
          tags: state.tags.map((t) => (t.id === tag.id ? tag : t)),
        })),
      removeTag: (tagId) =>
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== tagId),
        })),

      setRelationships: (relationships) => set({ relationships }),
      addRelationship: (relationship) =>
        set((state) => ({ relationships: [...state.relationships, relationship] })),
      updateRelationship: (relationship) =>
        set((state) => ({
          relationships: state.relationships.map((r) => (r.id === relationship.id ? relationship : r)),
        })),
      removeRelationship: (relationshipId) =>
        set((state) => ({
          relationships: state.relationships.filter((r) => r.id !== relationshipId),
        })),

      setMindMapData: (data) => set({ mindMapData: data }),

      setSettings: (settings) => set({ settings }),
      setPhotoDirectory: (dir) => set({ photoDirectory: dir }),

      setLoading: (loading) => set({ isLoading: loading }),
      setScanning: (scanning) => set({ isScanning: scanning }),
      setProcessingFaces: (processing) => set({ isProcessingFaces: processing }),
    }),
    {
      name: 'jayden-photo-scrapper-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarTab: state.sidebarTab,
        viewMode: state.viewMode,
        photoDirectory: state.photoDirectory,
      }),
    }
  )
)
