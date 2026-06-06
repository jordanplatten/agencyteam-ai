import { fetchAllOpportunities, STAGES } from '@/lib/ghl-affluent'
import {
  fetchCallReports,
  fetchAAAdSpend,
  computeOutcomes,
  pct,
  fmtGBP,
  normalizeToGBP,
  type Funnel,
  type CallReport,
} from '@/lib/data/aa-calls'
import { KpiCard } from '@/components/layout/kpi-card'
import { ChevronRight } from 'lucide-react'

interface Props {
  workspaceId: string
  from: Date
  to: Date
  funnel: Funnel
  rangeLabel: string
}

const BOOKED_STAGES = new Set<string>([
  STAGES.MEETING_BOOKED_NEEDS_CONF,
  STAGES.MEETING_BOOKED_APPLICATION,
  STAGES.CONFIRMED_MEETING,
])

function FunnelStage({ label, count, sub }: { label: string; count: number; sub?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center rounded-xl py-5 gap-1"
      style={{ background: 'var(--bg-subtle)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 0 }}>
      <span className="text-[9px] font-semibold uppercase tracking-widest text-center px-2"
        style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span className="text-[2rem] font-semibold tabular-nums leading-none"
        style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
        {count.toLocaleString()}
      </span>
      {sub && <span className="text-[9px] text-center" style={{ color: 'var(--fg-subtle)' }}>{sub}</span>}
    </div>
  )
}

function FunnelArrow({ rate, label }: { rate: number; label: string }) {
  const color = rate >= 50 ? 'var(--success)' : rate >= 25 ? 'var(--warning)' : rate > 0 ? 'var(--danger)' : 'var(--fg-subtle)'
  return (
    <div className="flex flex-col items-center justify-center gap-1 shrink-0" style={{ width: 56 }}>
      <span className="text-[10px] font-semibold tabular-nums whitespace-nowrap"
        style={{ color, fontFamily: 'var(--font-jetbrains-mono)' }}>
        {rate > 0 ? `${rate}%` : '—'}
      </span>
      <span className="text-[9px] whitespace-nowrap" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
      <div className="flex items-center gap-0.5 w-full">
        <div className="flex-1 h-px" style={{ background: color, opacity: 0.4 }} />
        <ChevronRight size={9} style={{ color, opacity: 0.5 }} strokeWidth={2} />
      </div>
    </div>
  )
}

function MiniFunnel({ label, rows }: { label: string; rows: CallReport[] }) {
  const applicable = rows.filter(r => r.event_name !== 'rescheduled')
  const attended   = rows.filter(r => r.type === 'call_closed' || r.type === 'purchase' || r.event_name === 'no_close')
  const closes     = rows.filter(r => r.type === 'call_closed' || r.type === 'purchase')
  const revenue    = closes.reduce((s, r) => s + normalizeToGBP(r.value, r.currency), 0)

  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>{label}</span>
        <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>{rows.length} calls</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Attended', value: attended.length, total: applicable.length },
          { label: 'Closes',   value: closes.length,   total: attended.length },
          { label: 'Show',     value: `${pct(attended.length, applicable.length)}%`, total: null },
          { label: 'Close rate', value: `${pct(closes.length, attended.length)}%`, total: null },
        ].map(({ label, value, total }) => (
          <div key={label} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
            <p className="text-[15px] font-semibold tabular-nums mt-0.5"
              style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {value}
              {total !== null && total > 0 && (
                <span className="text-[11px] ml-1" style={{ color: 'var(--fg-subtle)' }}>/{total}</span>
              )}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t pt-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Revenue</p>
        <p className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
          {fmtGBP(revenue)}
        </p>
      </div>
    </div>
  )
}

function TrendChart({ rows, spend }: { rows: CallReport[]; spend: import('@/lib/data/aa-calls').AdSpendRow[] }) {
  // Group closes and cash by date
  const byDate = new Map<string, { closes: number; cash: number; spend: number }>()

  for (const r of rows) {
    if (r.type !== 'call_closed' && r.type !== 'purchase') continue
    const date = r.occurred_at.slice(0, 10)
    const existing = byDate.get(date) ?? { closes: 0, cash: 0, spend: 0 }
    existing.closes++
    existing.cash += r.cash_collected
    byDate.set(date, existing)
  }

  for (const s of spend) {
    const existing = byDate.get(s.date) ?? { closes: 0, cash: 0, spend: 0 }
    existing.spend += s.spend
    byDate.set(s.date, existing)
  }

  const dates = Array.from(byDate.keys()).sort()
  if (dates.length === 0) return null

  const dataPoints = dates.map(d => ({ date: d, ...byDate.get(d)! }))
  const maxCash = Math.max(...dataPoints.map(d => d.cash), 1)

  return (
    <div className="rounded-xl border p-5"
      style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>Closes and cash over time</span>
        <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--success)' }} />
            Cash collected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />
            Closes
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {dataPoints.map(d => {
          const barW = maxCash > 0 ? (d.cash / maxCash) * 100 : 0
          return (
            <div key={d.date} className="flex items-center gap-3">
              <span className="text-[10px] w-16 shrink-0 tabular-nums" style={{ color: 'var(--fg-subtle)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                {d.date.slice(5)}
              </span>
              <div className="flex-1 h-6 rounded overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {d.cash > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded flex items-center pl-2"
                    style={{ width: `${barW}%`, background: 'rgba(0,230,118,0.2)' }}
                  >
                    <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'var(--success)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmtGBP(d.cash)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 w-16 justify-end">
                {Array.from({ length: d.closes }).map((_, i) => (
                  <span key={i} className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: 'var(--accent)' }} />
                ))}
                {d.closes === 0 && <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>—</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export async function OverviewTab({ workspaceId, from, to, funnel, rangeLabel }: Props) {
  let allOpps: Awaited<ReturnType<typeof fetchAllOpportunities>> = []
  let fetchError: string | null = null

  const [callRows, spend] = await Promise.all([
    fetchCallReports(workspaceId, from, to, funnel),
    fetchAAAdSpend(workspaceId, from, to),
  ])

  try {
    allOpps = await fetchAllOpportunities()
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e)
  }

  // Airtable metrics
  const outcomes = computeOutcomes(callRows)
  const totalRevenue = callRows
    .filter(r => r.type === 'call_closed' || r.type === 'purchase')
    .reduce((s, r) => s + normalizeToGBP(r.value, r.currency), 0)
  const totalCash = callRows
    .filter(r => r.type === 'call_closed' || r.type === 'purchase')
    .reduce((s, r) => s + r.cash_collected, 0)
  const totalSpend = spend.reduce((s, r) => s + r.spend, 0)
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const cashRate = pct(totalCash, totalRevenue)

  // GHL metrics (for the funnel top)
  const ghlApps = fetchError ? null : allOpps.filter(o => {
    const d = new Date(o.createdAt)
    return d >= from && d <= to
  }).length
  const ghlBooked = fetchError ? null : allOpps.filter(o => {
    const d = new Date(o.lastStageChangeAt)
    return d >= from && d <= to && BOOKED_STAGES.has(o.pipelineStageId)
  }).length
  const ghlConfirmed = fetchError ? null : allOpps.filter(o => {
    const d = new Date(o.lastStageChangeAt)
    return d >= from && d <= to && o.pipelineStageId === STAGES.CONFIRMED_MEETING
  }).length

  // Full-funnel conversion: closes / applications (where we have both)
  const ffConv = ghlApps && ghlApps > 0 ? pct(outcomes.closes, ghlApps) : null

  // Avg days application → close
  const closeDates = callRows
    .filter(r => r.type === 'call_closed' || r.type === 'purchase')
    .map(r => new Date(r.occurred_at).getTime())

  // P1/P2/O breakdown rows
  const p1Rows = callRows.filter(r => (r.call_type ?? '').toUpperCase() === 'P1')
  const p2Rows = callRows.filter(r => (r.call_type ?? '').toUpperCase() === 'P2')
  const oRows  = callRows.filter(r => (r.call_type ?? '').toUpperCase() === 'O')

  return (
    <>
      {/* Hero KPIs */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="Cash collected" value={fmtGBP(totalCash)} change={0} hideChange
          changeLabel={`from ${outcomes.closes} close${outcomes.closes !== 1 ? 's' : ''}`}
          numericValue={totalCash} displayType="currency" currency="GBP" large />
        <KpiCard label="Revenue contracted" value={fmtGBP(totalRevenue)} change={0} hideChange
          changeLabel="total contract value" numericValue={totalRevenue} displayType="currency" currency="GBP" large />
        <KpiCard label="Cash collection rate" value={`${cashRate}%`} change={0} hideChange
          changeLabel="cash / contracted" large />
        <KpiCard label="Full-funnel conversion" value={ffConv !== null ? `${ffConv}%` : '—'} change={0} hideChange
          changeLabel={ghlApps !== null ? `${outcomes.closes} of ${ghlApps} applications` : 'GHL data unavailable'} large />
      </div>

      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="Attended close rate"
          value={`${pct(outcomes.closes, outcomes.attended)}%`} change={0} hideChange
          changeLabel={`${outcomes.closes} of ${outcomes.attended} calls taken`} large />
        <KpiCard label="Show rate"
          value={ghlConfirmed && ghlConfirmed > 0 ? `${pct(outcomes.attended, ghlConfirmed)}%` : `${pct(outcomes.attended, callRows.filter(r => r.event_name !== 'rescheduled').length)}%`} change={0} hideChange
          changeLabel={`${outcomes.attended} attended`} large />
        <KpiCard label="Ad spend" value={fmtGBP(totalSpend)} change={0} hideChange
          changeLabel={rangeLabel.toLowerCase()} numericValue={totalSpend} displayType="currency" currency="GBP" large />
        <KpiCard label="ROAS" value={totalSpend > 0 ? `${roas.toFixed(2)}x` : '—'} change={0} hideChange
          changeLabel="revenue / spend" large />
      </div>

      {/* 6-stage funnel */}
      <div className="rounded-xl border p-5"
        style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-4"
          style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>Full funnel</p>

        <div className="flex items-stretch gap-1">
          {/* GHL stages */}
          <FunnelStage label="Applications"  count={ghlApps ?? 0}      sub="GHL — new leads" />
          <FunnelArrow rate={ghlApps && ghlBooked ? pct(ghlBooked, ghlApps) : 0} label="setting" />
          <FunnelStage label="Booked"        count={ghlBooked ?? 0}    sub="GHL — meetings booked" />
          <FunnelArrow rate={ghlBooked && ghlConfirmed ? pct(ghlConfirmed, ghlBooked) : 0} label="conf." />
          <FunnelStage label="Confirmed"     count={ghlConfirmed ?? 0} sub="GHL — setter confirmed" />
          <FunnelArrow rate={ghlConfirmed ? pct(outcomes.attended, ghlConfirmed) : pct(outcomes.attended, callRows.filter(r => r.event_name !== 'rescheduled').length)} label="showed" />
          {/* Airtable stages */}
          <FunnelStage label="Attended"      count={outcomes.attended}  sub="call happened" />
          <FunnelArrow rate={pct(outcomes.closes, outcomes.attended)} label="closed" />
          <FunnelStage label="Closes"        count={outcomes.closes}   sub="revenue signed" />
        </div>

        {fetchError && (
          <p className="text-[11px] mt-3" style={{ color: 'var(--warning)' }}>
            GHL data unavailable ({fetchError}) — funnel shows Airtable stages only.
          </p>
        )}
        {funnel !== 'all' && (
          <p className="text-[11px] mt-3" style={{ color: 'var(--fg-subtle)' }}>
            GHL stages show all leads. Airtable stages are filtered to {funnel.toUpperCase()} funnel.
          </p>
        )}
      </div>

      {/* Trend chart */}
      {callRows.length > 0 && (
        <TrendChart rows={callRows} spend={spend} />
      )}

      {/* Mini funnels by P1/P2/O */}
      {(p1Rows.length > 0 || p2Rows.length > 0 || oRows.length > 0) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>
            Funnel breakdown
          </p>
          <div className="grid grid-cols-3 gap-5">
            {p1Rows.length > 0 && <MiniFunnel label="P1 — Paid funnel 1" rows={p1Rows} />}
            {p2Rows.length > 0 && <MiniFunnel label="P2 — Paid funnel 2" rows={p2Rows} />}
            {oRows.length  > 0 && <MiniFunnel label="O — Organic"        rows={oRows}  />}
          </div>
        </div>
      )}

      {callRows.length === 0 && !fetchError && (
        <div className="rounded-xl border p-8 flex flex-col items-center gap-2"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' }}>
          <p className="text-[14px] font-medium" style={{ color: 'var(--fg-muted)' }}>No call data in this period</p>
          <p className="text-[12px]" style={{ color: 'var(--fg-subtle)' }}>Try This Month or This Quarter</p>
        </div>
      )}
    </>
  )
}
