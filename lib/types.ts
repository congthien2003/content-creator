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
  name: string | null
  email: string | null
  phone: string | null
  role: UserRole
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
  workflow_id: string | null
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

export type UserRole = 'user' | 'admin'

export type CreditTransactionType = 'initial_grant' | 'workflow_charge' | 'admin_grant' | 'adjustment'

export type WorkflowStatus = 'active' | 'completed' | 'failed'

export type WorkflowPersistedStepId = 'outline' | 'image_idea' | 'content_generation' | 'image_generation'

export type WorkflowPersistedStepStatus = 'success' | 'failed'

export interface CreditAccount {
  user_id: string
  balance: number
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  workflow_id: string | null
  workflow_step_id: string | null
  type: CreditTransactionType
  amount: number
  balance_after: number
  reason: string
  created_by_user_id: string | null
  created_at: string
}

export interface Workflow {
  id: string
  user_id: string
  topic: string
  platform: Platform
  post_length: PostLength
  post_type: PostType
  use_icons: boolean
  status: WorkflowStatus
  created_at: string
  updated_at: string
}

export interface WorkflowStepRecord {
  id: string
  workflow_id: string
  user_id: string
  step_key: WorkflowPersistedStepId
  attempt_number: number
  status: WorkflowPersistedStepStatus
  input_snapshot: Record<string, unknown>
  output_snapshot: Record<string, unknown> | null
  input_hash: string | null
  output_hash: string | null
  error_message: string | null
  credit_cost: number
  credit_transaction_id: string | null
  created_at: string
}

export interface WorkflowActionResult<T> {
  success: boolean
  data?: T
  workflowId?: string
  stepId?: string
  balance?: number
  error?: string
}
