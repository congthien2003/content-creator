'use server'

import { getCurrentUser } from '@/lib/server/auth/currentUser'
import { getProfileById, updateProfile } from '@/lib/server/repositories/profileRepository'
import { ensureUserAccount } from '@/lib/server/services/accountService'

export async function getProfile() {
  const { supabase, user } = await getCurrentUser()
  if (!user) return null

  await ensureUserAccount(supabase, user)
  return getProfileById(supabase, user.id)
}

export async function upsertProfile(formData: {
  name?: string
  email?: string
  phone?: string
  brand_name: string
  brand_voice: string
  core_context: string
}) {
  const { supabase, user, error } = await getCurrentUser()
  if (!user) return { success: false, error }

  await ensureUserAccount(supabase, user)
  const profile = await getProfileById(supabase, user.id)

  await updateProfile(supabase, {
    userId: user.id,
    name: formData.name ?? profile?.name ?? '',
    email: formData.email ?? profile?.email ?? user.email ?? '',
    phone: formData.phone ?? profile?.phone ?? '',
    brand_name: formData.brand_name,
    brand_voice: formData.brand_voice,
    core_context: formData.core_context,
  })

  return { success: true }
}
