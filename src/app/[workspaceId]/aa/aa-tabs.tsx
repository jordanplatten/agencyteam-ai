'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import type { Funnel, AARange } from '@/lib/data/aa-calls'

export type TabId = 'overview' | 'setting' | 'sales' | 'marketing'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',   label: 'Overview' },
  { id: 'setting',    label: 'Setting' },
  { id: 'sales',      label: 'Sales' },
  { id: 'marketing',  label: 'Marketing pulse' },
]

const RANGES: { id: AARange; label: string }[] = [
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'This week' },
  { id: 'month',   label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
]

const FUNNELS: { id: Funnel; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'paid',    label: 'Paid (P1+P2)' },
  { id: 'organic', label: 'Organic' },
  { id: 'p1',      label: 'P1' },
  { id: 'p2',      label: 'P2' },
  { id: 'o',       label: 'O' },
]

interface AATabsProps {
  currentTab: TabId
  currentRange: AARange
  currentFunnel: Funnel
  currentFrom?: string
  currentTo?: string
  workspaceId: string
}

export function AATabs({ currentTab, currentRange, currentFunnel, currentFrom, currentTo, workspaceId }: AATabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)
  const [showCustom, setShowCustom] = useState(!!(currentFrom && currentTo))
  const [fromVal, setFromVal] = useState(currentFrom ?? '')
  const [toVal, setToVal] = useState(currentTo ?? '')

  const navigate = useCallback(
    (updates: Partial<{ tab: TabId; range: AARange; funnel: Funnel; from: string; to: string }>) => {
      const params = new URLSearchParams(searchParams.toString())
      if (updates.tab !== undefined)    params.set('tab', updates.tab)
      if (updates.range !== undefined)  { params.set('range', updates.range); params.delete('from'); params.delete('to') }
      if (updates.funnel !== undefined) params.set('funnel', updates.funnel)
      if (updates.from !== undefined)   { params.set('from', updates.from); params.delete('range') }
      if (updates.to !== undefined)     { params.set('to', updates.to); params.delete('range') }
      startTransition(() => {
        router.push(`/${workspaceId}/aa?${params.toString()}`)
      })
    },
    [router, searchParams, workspaceId, startTransition],
  )

  function applyCustomRange() {
    if (fromVal && toVal) navigate({ from: fromVal, to: toVal })
  }

  const isCustomActive = !!(currentFrom && currentTo)

  return (
    <div
      className="border-b relative"
      style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'var(--bg-subtle)' }}
    >
      {/* Loading bar — visible while server is fetching */}
      {isPending && (
        <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden" style={{ zIndex: 20 }}>
          <div
            className="h-full"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
              animation: 'apex-loading 1s ease-in-out infinite',
              width: '40%',
            }}
          />
        </div>
      )}

      {/* Tab row */}
      <div className="flex items-center gap-0 -mb-px px-8">
        {TABS.map((t) => {
          const isActive = pendingTab ? t.id === pendingTab : t.id === currentTab
          return (
            <button
              key={t.id}
              onClick={() => { setPendingTab(t.id); navigate({ tab: t.id }) }}
              className="px-4 py-3 text-[13px] font-medium border-b-2 transition-colors duration-150"
              style={{
                color: isActive ? 'var(--foreground)' : 'var(--fg-muted)',
                borderBottomColor: isActive ? 'var(--accent)' : 'transparent',
                opacity: isPending && t.id !== (pendingTab ?? currentTab) ? 0.5 : 1,
              }}
            >
              {t.label}
            </button>
          )
        })}

        <div className="flex-1" />

        {/* Date presets */}
        <div className="flex items-center gap-1 py-2">
          {RANGES.map((r) => {
            const active = !isCustomActive && r.id === currentRange
            return (
              <button
                key={r.id}
                onClick={() => { setShowCustom(false); navigate({ range: r.id }) }}
                className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                style={{
                  background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-subtle)',
                  border: active ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid transparent',
                }}
              >
                {r.label}
              </button>
            )
          })}

          {/* Custom date range toggle */}
          <button
            onClick={() => setShowCustom(v => !v)}
            className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
            style={{
              background: isCustomActive ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
              color: isCustomActive ? 'var(--accent)' : 'var(--fg-subtle)',
              border: isCustomActive ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom date picker (shown when toggled) */}
      {showCustom && (
        <div className="flex items-center gap-2 px-8 pb-2">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>From</span>
          <input
            type="date"
            value={fromVal}
            onChange={e => setFromVal(e.target.value)}
            className="rounded px-2 py-1 text-[12px]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--foreground)' }}
          />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>To</span>
          <input
            type="date"
            value={toVal}
            onChange={e => setToVal(e.target.value)}
            className="rounded px-2 py-1 text-[12px]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--foreground)' }}
          />
          <button
            onClick={applyCustomRange}
            className="px-3 py-1 rounded text-[11px] font-medium"
            style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Funnel filter */}
      <div className="flex items-center gap-1.5 px-8 py-2">
        <span className="text-[10px] uppercase tracking-wider font-medium mr-1" style={{ color: 'var(--fg-subtle)' }}>
          Funnel
        </span>
        {FUNNELS.map((f) => {
          const active = f.id === currentFunnel
          return (
            <button
              key={f.id}
              onClick={() => navigate({ funnel: f.id })}
              className="px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors"
              style={{
                background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: active ? 'var(--foreground)' : 'var(--fg-subtle)',
                border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
