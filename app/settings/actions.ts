'use server'

import { createClient } from '@/utils/supabase/server'

export async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}

export async function upsertProfile(formData: {
  brand_name: string
  brand_voice: string
  core_context: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Chưa đăng nhập' }

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    brand_name: formData.brand_name,
    brand_voice: formData.brand_voice,
    core_context: formData.core_context,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}
