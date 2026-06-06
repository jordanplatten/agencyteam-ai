import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

const AA_WORKSPACE_ID = 'e316ab5b-0af5-40f0-bcd6-52902fa7c5d7'

export const getWorkspaceById = cache(async (workspaceId: string) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (workspaceId !== AA_WORKSPACE_ID) return null

  const service = createServiceClient()
  const { data } = await service
    .from('workspaces')
    .select('id, name, currency, timezone')
    .eq('id', AA_WORKSPACE_ID)
    .single()

  return data ?? null
})
