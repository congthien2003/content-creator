'use server'

import { getUserDrafts } from '@/lib/server/services/draftService'

export async function getDrafts(statusFilter?: string) {
  return getUserDrafts(statusFilter)
}
