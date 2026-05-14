import type { PostLength } from '@/lib/types'

const CREDIT_COST_BY_POST_LENGTH: Record<PostLength, number> = { short: 0.2, medium: 0.4, long: 1.0 }

export function getWorkflowStepCreditCost(postLength: PostLength) {
  return CREDIT_COST_BY_POST_LENGTH[postLength]
}
