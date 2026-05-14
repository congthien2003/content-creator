import { createClient } from '@/utils/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null, error: 'Bạn cần đăng nhập để tiếp tục.' }
  }

  return { supabase, user, error: null }
}
