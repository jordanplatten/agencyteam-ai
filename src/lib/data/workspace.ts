import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Returns all workspaces the current user can access
export const getWorkspaces = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id, workspace_ids')
    .eq('user_id', user.id)
    .single()

  if (!membership) return []

  const wsQuery = supabase
    .from('workspaces')
    .select('id, name, currency, timezone')
    .eq('organization_id', membership.organization_id)
    .order('name')

  if (membership.workspace_ids && membership.workspace_ids.length > 0) {
    wsQuery.in('id', membership.workspace_ids)
  }

  const { data: workspaces } = await wsQuery
  return workspaces ?? []
})

// Validates user has access to a specific workspace by ID (URL-based)
export const getWorkspaceById = cache(async (workspaceId: string) => {
  const workspaces = await getWorkspaces()
  return workspaces.find((w) => w.id === workspaceId) ?? null
})

// Legacy cookie-based fallback — used by API routes only
export const getWorkspace = cache(async () => {
  const workspaces = await getWorkspaces()
  if (!workspaces.length) return null
  return workspaces[0]
})
