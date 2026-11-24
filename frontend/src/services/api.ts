/** API service for communicating with the backend */
import axios, { AxiosInstance, AxiosError } from 'axios'
import type {
  Photo,
  PhotoSummary,
  Person,
  PersonSummary,
  Relationship,
  Tag,
  PaginatedResponse,
  MindMapData,
  RelationshipSuggestion,
  ScanStats,
  FaceProcessStats,
  GraphStatistics,
  RelationshipType,
  Settings,
  Stats,
} from '@/types'

const viteEnvironment = import.meta as ImportMeta & {
  readonly env?: { readonly VITE_API_URL?: string }
}
const API_BASE_URL = viteEnvironment.env?.VITE_API_URL || '/api/v1'

interface PhotoListApiItem {
  id: number
  file_path: string
  file_name: string
  width: number | null
  height: number | null
  taken_at: string | null
  camera_make: string | null
  camera_model: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  thumbnail_url: string | null
  persons_count: number
  tags: { id: number; name: string }[]
}

type PhotoListApiResponse = Omit<PaginatedResponse<PhotoListApiItem>, 'items'> & {
  photos: PhotoListApiItem[]
}

interface PhotoDetailApiResponse extends Omit<Photo, 'persons' | 'tags'> {
  persons: {
    id: number
    name: string
    confidence: number
    is_verified: boolean
    is_primary: boolean
    location: { top: number; right: number; bottom: number; left: number }
  }[]
  tags: { id: number; name: string; display_name: string | null; color: string | null }[]
}

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for auth (if needed later)
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('auth_token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // Photos
  async getPhotos(params?: {
    page?: number
    per_page?: number
    person_id?: number
    tag_id?: number
    search?: string
  }): Promise<PaginatedResponse<PhotoSummary>> {
    const response = await this.client.get<PhotoListApiResponse>('/photos/', { params })
    const { photos, ...pagination } = response.data
    return {
      ...pagination,
      items: photos,
    }
  }

  async getPhoto(photoId: number): Promise<Photo> {
    const response = await this.client.get<PhotoDetailApiResponse>(`/photos/${photoId}`)
    const data = response.data
    return {
      ...data,
      persons: data.persons.map((person) => ({
        id: person.id,
        person_id: person.id,
        person: {
          id: person.id,
          name: person.name,
          display_name: person.name,
          reference_photo_id: null,
        },
        confidence: person.confidence,
        is_verified: person.is_verified,
        is_primary: person.is_primary,
        location: person.location,
      })),
      tags: data.tags.map((tag) => ({
        tag_id: tag.id,
        tag: { id: tag.id, name: tag.name, display_name: tag.display_name, color: tag.color },
        confidence: 1,
        source: 'manual',
      })),
    }
  }

  async getPhotoImage(photoId: number): Promise<string> {
    return `${API_BASE_URL}/photos/${photoId}/image`
  }

  async getPhotoThumbnail(photoId: number): Promise<string> {
    return `${API_BASE_URL}/photos/${photoId}/thumbnail`
  }

  async scanPhotos(force: boolean = false): Promise<ScanStats> {
    const response = await this.client.post('/photos/scan', null, { params: { force } })
    return response.data
  }

  async processPhotoFaces(photoId: number): Promise<FaceProcessStats> {
    const response = await this.client.post(`/photos/${photoId}/process-faces`)
    return response.data
  }

  async processAllFaces(batchSize: number = 50): Promise<FaceProcessStats> {
    const response = await this.client.post('/photos/process-all-faces', null, {
      params: { batch_size: batchSize }
    })
    return response.data
  }

  async addPhotoTag(photoId: number, tagId: number): Promise<{ success: boolean }> {
    const response = await this.client.post(`/photos/${photoId}/tags`, null, { params: { tag_id: tagId } })
    return response.data
  }

  async removePhotoTag(photoId: number, tagId: number): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/photos/${photoId}/tags/${tagId}`)
    return response.data
  }

  // Persons
  async getPersons(params?: {
    page?: number
    per_page?: number
    search?: string
    only_with_photos?: boolean
  }): Promise<PaginatedResponse<PersonSummary>> {
    const response = await this.client.get<{
      persons: PersonSummary[]
      total: number
      page: number
      per_page: number
      total_pages: number
    }>('/persons/', { params })
    const { persons, ...pagination } = response.data
    return { ...pagination, items: persons }
  }

  async getPerson(personId: number): Promise<Person> {
    const response = await this.client.get('/persons/' + personId)
    const data = response.data
    return {
      ...data,
      relationships: (data.relationships || []).map((relationship: {
        id: number
        type: RelationshipType
        custom_type: string | null
        related_person: { id: number; name: string }
        confidence: number
        is_verified: boolean
        is_current: boolean
        description: string | null
      }) => ({
        id: relationship.id,
        person_id: data.id,
        person_name: data.display_name || data.name,
        related_person_id: relationship.related_person.id,
        related_person_name: relationship.related_person.name,
        type: relationship.type,
        custom_type: relationship.custom_type,
        confidence: relationship.confidence,
        is_verified: relationship.is_verified,
        is_bidirectional: true,
        is_current: relationship.is_current,
        description: relationship.description,
        source: 'manual',
        inferred_from_photo_count: 0,
        start_date: null,
        end_date: null,
      })),
    }
  }

  async createPerson(data: {
    name: string
    display_name?: string
    birth_date?: string
    notes?: string
  }): Promise<Person> {
    const response = await this.client.post('/persons/', data)
    return response.data
  }

  async updatePerson(personId: number, data: Partial<Person>): Promise<Person> {
    const response = await this.client.put(`/persons/${personId}`, data)
    return response.data
  }

  async deletePerson(personId: number): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/persons/${personId}`)
    return response.data
  }

  async mergePersons(personId: number, otherPersonId: number): Promise<{ success: boolean; merged_person_id: number }> {
    const response = await this.client.post(`/persons/${personId}/merge/${otherPersonId}`)
    return response.data
  }

  async getPersonPhotos(personId: number, params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<PhotoSummary>> {
    const response = await this.client.get<{
      photos: { id: number; file_name: string; taken_at: string | null; thumbnail_url: string | null }[]
      total: number
      page: number
      per_page: number
      total_pages: number
    }>(`/persons/${personId}/photos`, { params })
    const { photos, ...pagination } = response.data
    return {
      ...pagination,
      items: photos.map((photo) => ({
        id: photo.id,
        file_path: '',
        file_name: photo.file_name,
        width: null,
        height: null,
        taken_at: photo.taken_at,
        camera_make: null,
        camera_model: null,
        gps_latitude: null,
        gps_longitude: null,
        thumbnail_url: photo.thumbnail_url,
      })),
    }
  }

  async verifyFace(personId: number, photoId: number, verified: boolean = true): Promise<{ success: boolean; is_verified: boolean }> {
    const response = await this.client.post(`/persons/${personId}/verify-face/${photoId}`, null, { params: { verified } })
    return response.data
  }

  async getRelationshipSuggestions(personId: number, limit: number = 10): Promise<{ suggestions: RelationshipSuggestion[] }> {
    const response = await this.client.get(`/persons/${personId}/suggestions`, { params: { limit } })
    return response.data
  }

  // Relationships
  async getRelationships(params?: {
    person_id?: number
    relationship_type?: RelationshipType
    only_verified?: boolean
    only_current?: boolean
  }): Promise<{ relationships: Relationship[] }> {
    const response = await this.client.get('/relationships/', { params })
    return response.data
  }

  async createRelationship(data: {
    person_id: number
    related_person_id: number
    relationship_type: RelationshipType
    custom_type?: string
    description?: string
    confidence?: number
    is_verified?: boolean
    is_bidirectional?: boolean
    start_date?: string
    end_date?: string
    is_current?: boolean
  }): Promise<Relationship> {
    const response = await this.client.post('/relationships/', data)
    return response.data
  }

  async updateRelationship(relationshipId: number, data: Partial<Relationship>): Promise<Relationship> {
    const response = await this.client.put(`/relationships/${relationshipId}`, data)
    return response.data
  }

  async deleteRelationship(relationshipId: number): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/relationships/${relationshipId}`)
    return response.data
  }

  async getMindMap(personId?: number, depth: number = 2): Promise<MindMapData> {
    const response = await this.client.get('/relationships/mind-map', { params: { person_id: personId, depth } })
    return response.data
  }

  async getStatistics(): Promise<GraphStatistics> {
    const response = await this.client.get('/relationships/statistics')
    return response.data
  }

  async inferRelationships(minCooccurrence: number = 3, minConfidence: number = 0.7): Promise<{ created: number; relationships: Relationship[] }> {
    const response = await this.client.post('/relationships/infer', null, {
      params: { min_cooccurrence: minCooccurrence, min_confidence: minConfidence }
    })
    return response.data
  }

  async getShortestPath(person1Id: number, person2Id: number): Promise<{ path: { person_id: number; name: string }[]; found: boolean; distance: number }> {
    const response = await this.client.get(`/relationships/path/${person1Id}/${person2Id}`)
    return response.data
  }

  async getConnectedComponents(): Promise<{ components: { person_id: number; name: string }[][] }> {
    const response = await this.client.get('/relationships/components')
    return response.data
  }

  async getRelationshipTypes(): Promise<{ types: { value: RelationshipType; label: string }[] }> {
    const response = await this.client.get('/relationships/types')
    return response.data
  }

  // Tags
  async getTags(params?: {
    page?: number
    per_page?: number
    tag_type?: string
    parent_id?: number
    search?: string
  }): Promise<PaginatedResponse<Tag>> {
    const response = await this.client.get('/tags/', { params })
    return response.data
  }

  async getTagTree(): Promise<{ tags: Tag[] }> {
    const response = await this.client.get('/tags/tree')
    return response.data
  }

  async getTag(tagId: number): Promise<Tag> {
    const response = await this.client.get(`/tags/${tagId}`)
    return response.data
  }

  async createTag(data: {
    name: string
    display_name?: string
    description?: string
    color?: string
    icon?: string
    tag_type?: string
    parent_id?: number
  }): Promise<Tag> {
    const response = await this.client.post('/tags/', data)
    return response.data
  }

  async updateTag(tagId: number, data: Partial<Tag>): Promise<Tag> {
    const response = await this.client.put(`/tags/${tagId}`, data)
    return response.data
  }

  async deleteTag(tagId: number): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/tags/${tagId}`)
    return response.data
  }

  async getTagPhotos(tagId: number, params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Photo>> {
    const response = await this.client.get(`/tags/${tagId}/photos`, { params })
    return response.data
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const response = await this.client.get('/settings/')
    return response.data
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const response = await this.client.put('/settings/', settings)
    return response.data
  }

  async getStats(): Promise<Stats> {
    const response = await this.client.get('/settings/stats')
    return response.data
  }

  async clearDatabase(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/settings/clear-database')
    return response.data
  }

  async getFaceProcessingProgress(): Promise<{ processed: number; total: number; current: string; status: string }> {
    const response = await this.client.get('/settings/face-processing-progress')
    return response.data
  }

  async scanPhotosFromSettings(force: boolean = false): Promise<ScanStats> {
    const response = await this.client.post('/settings/scan-photos', null, { params: { force } })
    return response.data
  }

  async processFacesFromSettings(batchSize: number = 50): Promise<FaceProcessStats> {
    const response = await this.client.post('/settings/process-faces', null, { params: { batch_size: batchSize } })
    return response.data
  }
}

export const api = new ApiService()
