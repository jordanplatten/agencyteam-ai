import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const AA_WORKSPACE_ID = 'e316ab5b-0af5-40f0-bcd6-52902fa7c5d7'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  redirect(`/${AA_WORKSPACE_ID}/aa`)
}
