'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={signOut}
      className="text-[11px] px-2.5 py-1 rounded transition-colors"
      style={{
        color: 'var(--fg-subtle)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      Sign out
    </button>
  )
}
