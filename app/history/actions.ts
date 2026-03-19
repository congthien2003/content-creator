'use server'

import { createClient } from '@/utils/supabase/server'

export async function getDrafts(statusFilter?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  let query = supabase
    .from('drafts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching drafts:', error)
    return []
  }

  return data || []
}
