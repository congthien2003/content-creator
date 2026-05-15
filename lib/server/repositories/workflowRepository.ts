import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Platform,
  PostLength,
  PostType,
  WorkflowPersistedStepId,
} from '@/lib/types'

export async function createWorkflow(
  supabase: SupabaseClient,
  input: {
    userId: string
    topic: string
    platform: Platform
    postLength: PostLength
    postType: PostType
    useIcons: boolean
  }
) {
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      user_id: input.userId,
      topic: input.topic,
      platform: input.platform,
      post_length: input.postLength,
      post_type: input.postType,
      use_icons: input.useIcons,
      status: 'active',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getWorkflowById(
  supabase: SupabaseClient,
  input: { userId: string; workflowId: string }
) {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', input.workflowId)
    .eq('user_id', input.userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getNextAttemptNumber(
  supabase: SupabaseClient,
  input: { workflowId: string; stepKey: WorkflowPersistedStepId }
) {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('attempt_number')
    .eq('workflow_id', input.workflowId)
    .eq('step_key', input.stepKey)
    .order('attempt_number', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  return (data?.[0]?.attempt_number ?? 0) + 1
}

export async function recordFailedWorkflowStep(
  supabase: SupabaseClient,
  input: {
    userId: string
    workflowId: string
    stepKey: WorkflowPersistedStepId
    attemptNumber: number
    inputSnapshot: Record<string, unknown>
    inputHash: string
    errorMessage: string
  }
) {
  const { data, error } = await supabase
    .from('workflow_steps')
    .insert({
      workflow_id: input.workflowId,
      user_id: input.userId,
      step_key: input.stepKey,
      attempt_number: input.attemptNumber,
      status: 'failed',
      input_snapshot: input.inputSnapshot,
      input_hash: input.inputHash,
      error_message: input.errorMessage,
      credit_cost: 0,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function recordSuccessfulWorkflowStepWithCharge(
  supabase: SupabaseClient,
  input: {
    userId: string
    workflowId: string
    stepKey: WorkflowPersistedStepId
    attemptNumber: number
    inputSnapshot: Record<string, unknown>
    outputSnapshot: Record<string, unknown>
    inputHash: string
    outputHash: string
    creditCost: number
    reason: string
  }
) {
  const { data, error } = await supabase.rpc('record_successful_workflow_step', {
    p_user_id: input.userId,
    p_workflow_id: input.workflowId,
    p_step_key: input.stepKey,
    p_attempt_number: input.attemptNumber,
    p_input_snapshot: input.inputSnapshot,
    p_output_snapshot: input.outputSnapshot,
    p_input_hash: input.inputHash,
    p_output_hash: input.outputHash,
    p_credit_cost: input.creditCost,
    p_reason: input.reason,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data?.[0]
}
