/** Type definitions for the frontend */

export interface PhotoSummary {
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
  thumbnail_url?: string | null
  thumbnail_path?: string | null
  persons?: PhotoPerson[]
  persons_count?: number
}

export interface Photo extends PhotoSummary {
  file_hash: string
  thumbnail_path: string | null
  phash: string | null
  is_processed: boolean
  processing_error: string | null
  tags?: PhotoTag[]
}

export interface PhotoPerson {
  id: number
  person_id: number
  person: Pick<Person, 'id' | 'name' | 'display_name' | 'reference_photo_id'>
  confidence: number
  is_verified: boolean
  is_primary: boolean
  location: FaceLocation
}

export interface FaceLocation {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Person {
  id: number
  name: string
  display_name: string | null
  reference_photo_id: number | null
  birth_date: string | null
  notes: string | null
  is_manual: boolean
  confidence_threshold: number
  photo_count: number
  created_at: string
  photos?: PersonPhoto[]
  relationships?: Relationship[]
}

export interface PersonSummary {
  id: number
  name: string
  display_name: string | null
  reference_photo_id: number | null
  photo_count: number
  is_manual: boolean
  created_at: string
}

export interface PersonPhoto {
  id: number
  file_name: string
  taken_at: string | null
  thumbnail_url: string
  confidence: number
  is_verified: boolean
  location: FaceLocation | null
}

export interface Relationship {
  id: number
  person_id: number
  person_name: string
  related_person_id: number
  related_person_name: string
  type: RelationshipType
  custom_type: string | null
  confidence: number
  is_verified: boolean
  is_bidirectional: boolean
  is_current: boolean
  description: string | null
  source: string
  inferred_from_photo_count: number
  start_date: string | null
  end_date: string | null
}

export type RelationshipType =
  | 'spouse'
  | 'partner'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'grandparent'
  | 'grandchild'
  | 'uncle_aunt'
  | 'niece_nephew'
  | 'cousin'
  | 'in_law'
  | 'friend'
  | 'close_friend'
  | 'acquaintance'
  | 'colleague'
  | 'classmate'
  | 'neighbor'
  | 'manager'
  | 'reports_to'
  | 'mentor'
  | 'mentee'
  | 'business_partner'
  | 'custom'

export interface Tag {
  id: number
  name: string
  display_name: string | null
  description: string | null
  color: string | null
  icon: string | null
  tag_type: string | null
  parent_id: number | null
  usage_count: number
  is_auto: boolean
  level: number
  children?: Tag[]
}

export interface PhotoTag {
  tag_id: number
  tag: Pick<Tag, 'id' | 'name' | 'display_name' | 'color'>
  confidence: number
  source: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface MindMapData {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  center_person_id: number | null
}

export interface MindMapNode {
  id: number
  label: string
  name: string
  reference_photo_id: number | null
  size: number
}

export interface MindMapEdge {
  from: number
  to: number
  type: string
  confidence: number
  verified: boolean
  label: string
}

export interface RelationshipSuggestion {
  person_id: number
  person_name: string
  cooccurrence_count: number
  suggested_type: RelationshipType
  confidence: number
}

export interface ScanStats {
  total_files: number
  new_photos: number
  updated_photos: number
  skipped_photos: number
  errors: number
}

export interface FaceProcessStats {
  processed: number
  faces_found: number
  new_persons: number
  matched_persons: number
  errors: number
}

export interface GraphStatistics {
  total_people: number
  total_relationships: number
  connected_components: number
  average_degree: number
  density: number
  clustering_coefficient: number
}

export interface Settings {
  photo_directory: string
  face_recognition_model: string
  face_tolerance: number
  min_face_size: number
  thumbnail_size: number
  thumbnail_quality: number
  thumbnail_format: string
  database_path: string
  data_path: string
}

export interface Stats {
  total_photos: number
  total_persons: number
  total_relationships: number
  total_tags: number
  db_size_mb: number
  photos_with_faces: number
  photos_without_faces: number
}
