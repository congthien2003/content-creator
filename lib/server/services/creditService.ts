import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostLength } from '@/lib/types'
import { getWorkflowStepCreditCost } from '@/lib/server/credits/costs'
import { getCreditAccount } from '@/lib/server/repositories/creditRepository'

export async function assertEnoughCreditForStep(
  supabase: SupabaseClient,
  input: { userId: string; postLength: PostLength }
) {
  const cost = getWorkflowStepCreditCost(input.postLength)
  const account = await getCreditAccount(supabase, input.userId)
  const balance = Number(account.balance)

  if (balance < cost) {
    return {
      ok: false,
      cost,
      balance,
      error: `Không đủ credit. Step này cần ${cost} credit, số dư hiện tại là ${balance}.`,
    }
  }

  return { ok: true, cost, balance, error: null }
}
