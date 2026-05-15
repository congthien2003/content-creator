'use server'

import { getCurrentUser } from '@/lib/server/auth/currentUser'
import { getProfileById, updateProfile } from '@/lib/server/repositories/profileRepository'
import { ensureUserAccount } from '@/lib/server/services/accountService'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
}

export async function getProfile() {
  try {
    const { supabase, user } = await getCurrentUser()
    if (!user) return null

    await ensureUserAccount(supabase, user)
    return getProfileById(supabase, user.id)
  } catch {
    return null
  }
}

export async function upsertProfile(formData: {
  name?: string
  email?: string
  phone?: string
  brand_name: string
  brand_voice: string
  core_context: string
}) {
  try {
    const { supabase, user, error } = await getCurrentUser()
    if (!user) return { success: false, error }

    await ensureUserAccount(supabase, user)
    const profile = await getProfileById(supabase, user.id)

    await updateProfile(supabase, {
      userId: user.id,
      name: formData.name ?? profile?.name ?? '',
      email: user.email ?? profile?.email ?? formData.email ?? '',
      phone: formData.phone ?? profile?.phone ?? '',
      brand_name: formData.brand_name,
      brand_voice: formData.brand_voice,
      core_context: formData.core_context,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}
