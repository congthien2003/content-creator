import type { SupabaseClient, User } from '@supabase/supabase-js'

export async function getProfileById(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function upsertProfileFromUser(supabase: SupabaseClient, user: User) {
  const metadata = user.user_metadata ?? {}
  const name = typeof metadata.name === 'string' ? metadata.name : null
  const phone = typeof metadata.phone === 'string' ? metadata.phone : null

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        name,
        email: user.email ?? null,
        phone,
        role: 'user',
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function updateProfile(
  supabase: SupabaseClient,
  input: {
    userId: string
    name: string
    email: string
    phone: string
    brand_name: string
    brand_voice: string
    core_context: string
  }
) {
  const { error } = await supabase.from('profiles').upsert({
    id: input.userId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    brand_name: input.brand_name,
    brand_voice: input.brand_voice,
    core_context: input.core_context,
  })

  if (error) {
    throw new Error(error.message)
  }
}
