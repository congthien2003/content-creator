import type { SupabaseClient } from '@supabase/supabase-js'

export async function getCreditAccount(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('credit_accounts')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getCreditTransactions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}
