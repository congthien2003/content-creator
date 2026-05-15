import type { SupabaseClient } from '@supabase/supabase-js'
import type { Platform, PostLength, WorkflowMetadata } from '@/lib/types'

export async function createDraft(
  supabase: SupabaseClient,
  input: {
    userId: string
    workflowId?: string | null
    topic: string
    content: string
    platform: Platform
    postLength: PostLength
    metadata: WorkflowMetadata
  }
) {
  const { data, error } = await supabase
    .from('drafts')
    .insert({
      user_id: input.userId,
      workflow_id: input.workflowId ?? null,
      topic: input.topic,
      content: input.content,
      platform: input.platform,
      post_length: input.postLength,
      status: 'draft',
      metadata: input.metadata,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function listDrafts(
  supabase: SupabaseClient,
  input: { userId: string; statusFilter?: string }
) {
  let query = supabase
    .from('drafts')
    .select('*')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })

  if (input.statusFilter && input.statusFilter !== 'all') {
    query = query.eq('status', input.statusFilter)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}
