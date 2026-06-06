import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceById } from '@/lib/data/workspace'
import { SignOutButton } from '@/components/layout/sign-out-button'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceById(workspaceId)
  if (!workspace) redirect('/')

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: 'var(--background)' }}>
      <div
        className="shrink-0 flex items-center justify-between px-6 h-10 border-b"
        style={{
          background: 'var(--bg-subtle)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://lp-rosy-six.vercel.app/assets/academy-logo-white.png"
          alt="Affluent Academy"
          style={{ height: 16, width: 'auto' }}
        />
        <SignOutButton />
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
