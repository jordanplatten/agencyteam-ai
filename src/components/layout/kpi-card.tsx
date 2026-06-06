'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// Inline SVG sparkline — no extra library needed
function Sparkline({ data, color = '#00e676' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 60
  const H = 20
  const PAD = 2

  // Build a smooth cubic bezier path
  const pts = data.map((v, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (v - min) / range) * (H - PAD * 2),
  }))

  const d = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    const prev = pts[i - 1]
    const cx = ((prev.x + pt.x) / 2).toFixed(1)
    return `${acc} C ${cx} ${prev.y.toFixed(1)} ${cx} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
  }, '')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
      <path d={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Count-up hook — animates from 0 to target over duration ms
function useCountUp(target: number, duration = 400): number {
  const [val, setVal] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    function tick(ts: number) {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(eased * target)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return val
}

type DisplayType = 'currency' | 'roas' | 'number' | 'percent'

function formatByType(n: number, type: DisplayType, currency: string): string {
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(n)
    case 'roas':
      return `${n.toFixed(2)}x`
    case 'percent':
      return `${n.toFixed(1)}%`
    default:
      return new Intl.NumberFormat('en-US').format(Math.round(n))
  }
}

export interface KpiCardProps {
  label: string
  value: string
  change: number
  changeLabel?: string
  subline?: string
  hideChange?: boolean
  // Optional sparkline: array of raw numeric values (sampled from daily data)
  sparklineData?: number[]
  // Optional count-up: provide raw number + display type for animated formatting
  numericValue?: number
  displayType?: DisplayType
  currency?: string
  large?: boolean
}

export function KpiCard({
  label,
  value,
  change,
  changeLabel,
  subline,
  hideChange = false,
  sparklineData,
  numericValue,
  displayType,
  currency = 'USD',
  large = false,
}: KpiCardProps) {
  const [hovered, setHovered] = useState(false)
  const animated = useCountUp(numericValue ?? 0, 400)

  // Use animated value only when numericValue + displayType both provided
  const displayValue =
    numericValue !== undefined && displayType !== undefined
      ? formatByType(animated, displayType, currency)
      : value

  const isPositive = change > 0
  const isNeutral = change === 0
  const changeStr = `${isPositive ? '+' : ''}${change.toFixed(1)}%`

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown
  const trendColor = isNeutral
    ? 'var(--fg-subtle)'
    : isPositive
      ? 'var(--success)'
      : 'var(--danger)'
  const chipBg = isNeutral
    ? 'rgba(143,147,157,0.12)'
    : isPositive
      ? 'rgba(0,230,118,0.12)'
      : 'rgba(240,82,82,0.12)'

  return (
    <div
      className={`rounded-xl flex flex-col gap-3 relative overflow-hidden ${large ? 'p-6' : 'p-4'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-subtle)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'}`,
        transition: 'border-color 200ms ease',
      }}
    >
      {/* Top line: purple gradient accent on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          opacity: hovered ? 0.6 : 0,
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <span
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: 'var(--fg-subtle)', letterSpacing: '0.06em' }}
        >
          {label}
        </span>
        {sparklineData && sparklineData.length > 1 && (
          <div style={{ opacity: 0.65, flexShrink: 0 }}>
            <Sparkline data={sparklineData} color="var(--success)" />
          </div>
        )}
      </div>

      <span
        className="tabular-nums leading-none"
        style={{
          color: 'var(--foreground)',
          fontFamily: 'var(--font-jetbrains-mono)',
          fontWeight: 600,
          fontSize: large ? '2rem' : '1.5rem',
        }}
      >
        {displayValue}
      </span>

      {!hideChange && (
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0"
            style={{ background: chipBg, color: trendColor }}
          >
            <TrendIcon size={10} strokeWidth={2.5} />
            {changeStr}
          </div>
          {changeLabel && (
            <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
              {changeLabel}
            </span>
          )}
        </div>
      )}
      {hideChange && changeLabel && (
        <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
          {changeLabel}
        </span>
      )}

      {subline && (
        <span className="text-[10px]" style={{ color: 'var(--fg-subtle)', marginTop: '-4px' }}>
          {subline}
        </span>
      )}
    </div>
  )
}
