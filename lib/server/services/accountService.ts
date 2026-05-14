import type { SupabaseClient, User } from '@supabase/supabase-js'
import { upsertProfileFromUser } from '@/lib/server/repositories/profileRepository'

export async function ensureUserAccount(supabase: SupabaseClient, user: User) {
  const {
    data: { user: currentUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || currentUser?.id !== user.id) {
    throw new Error('Authenticated user does not match the requested account.')
  }

  await upsertProfileFromUser(supabase, user)

  const { error } = await supabase.rpc('initialize_credit_account', {
    p_user_id: user.id,
    p_amount: 10,
  })

  if (error) {
    throw new Error(error.message)
  }
}
