import type { Platform, PostLength, WorkflowMetadata } from '@/lib/types'
import { getCurrentUser } from '@/lib/server/auth/currentUser'
import { createDraft, listDrafts } from '@/lib/server/repositories/draftRepository'
import { getWorkflowById } from '@/lib/server/repositories/workflowRepository'
import { ensureUserAccount } from '@/lib/server/services/accountService'

export async function saveDraft(input: {
  workflowId?: string | null
  topic: string
  content: string
  platform: Platform
  postLength: PostLength
  metadata: WorkflowMetadata
}) {
  const { supabase, user, error } = await getCurrentUser()
  if (!user) return { success: false, error }

  await ensureUserAccount(supabase, user)
  if (input.workflowId) {
    await getWorkflowById(supabase, { userId: user.id, workflowId: input.workflowId })
  }

  const draft = await createDraft(supabase, { userId: user.id, ...input })

  return { success: true, draftId: draft.id }
}

export async function getUserDrafts(statusFilter?: string) {
  const { supabase, user } = await getCurrentUser()
  if (!user) return []

  await ensureUserAccount(supabase, user)
  return listDrafts(supabase, { userId: user.id, statusFilter })
}
