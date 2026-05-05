export type Platform = 'facebook' | 'linkedin' | 'blog' | 'tiktok' | 'instagram' | 'twitter'

export type PostLength = 'short' | 'medium' | 'long'

export type PostType = 'promotional' | 'educational' | 'storytelling' | 'engagement' | 'announcement'

export type DraftStatus = 'draft' | 'published'

export type WorkflowStepId =
  | 'outline'
  | 'image_idea'
  | 'content_generation'
  | 'image_generation'
  | 'save'

export type WorkflowStepStatus = 'idle' | 'loading' | 'success' | 'error'

export interface WorkflowImageOption {
  id: string
  prompt: string
}

export interface WorkflowMetadata {
  outline?: string
  imageIdea?: string
  imageOptions?: WorkflowImageOption[]
  skillVersion?: string
}

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
  metadata?: WorkflowMetadata | null
  created_at: string
}

export interface GenerateRequest {
  topic: string
  platform: Platform
  postLength: PostLength
  postType: PostType
  useIcons?: boolean
}
