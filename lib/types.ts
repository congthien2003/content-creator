export type Platform = 'facebook' | 'linkedin' | 'blog' | 'tiktok' | 'instagram' | 'twitter'

export type PostLength = 'short' | 'medium' | 'long'

export type PostType = 'promotional' | 'educational' | 'storytelling' | 'engagement' | 'announcement'

export type DraftStatus = 'draft' | 'published'

export interface Profile {
  id: string
  brand_name: string | null
  brand_voice: string | null
  core_context: string | null
  created_at: string
}

export interface Draft {
  id: string
  user_id: string
  topic: string
  content: string
  platform: Platform
  post_length: PostLength
  status: DraftStatus
  created_at: string
}

export interface GenerateRequest {
  topic: string
  platform: Platform
  postLength: PostLength
  postType: PostType
}
