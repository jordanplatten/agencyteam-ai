'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const next = new URLSearchParams(window.location.search).get('next') || '/'

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (error) setError(error.message)
      else setSent(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push(next)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-[340px] space-y-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://lp-rosy-six.vercel.app/assets/academy-logo-white.png"
            alt="Affluent Academy"
            style={{ height: 24, width: 'auto', marginBottom: 24 }}
          />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Dashboard login
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            {mode === 'magic' ? 'We will send a magic link to your email.' : 'Enter your credentials to continue.'}
          </p>
        </div>

        {sent ? (
          <div className="text-sm" style={{ color: 'var(--success)' }}>
            Check your email. Magic link sent to {email}.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              required
              className="w-full px-3 py-2 text-sm rounded-md outline-none"
              style={{
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                color: 'var(--foreground)',
              }}
            />
            {mode === 'password' && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full px-3 py-2 text-sm rounded-md outline-none"
                style={{
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--foreground)',
                }}
              />
            )}

            {error && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 text-sm font-medium rounded-md disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {loading ? 'Loading...' : mode === 'magic' ? 'Send magic link' : 'Sign in'}
            </button>
          </form>
        )}

        <button
          onClick={() => { setMode(mode === 'magic' ? 'password' : 'magic'); setError(null) }}
          className="text-xs w-full text-center"
          style={{ color: 'var(--fg-muted)' }}
        >
          {mode === 'magic' ? 'Sign in with password instead' : 'Sign in with magic link'}
        </button>
      </div>
    </div>
  )
}
