import {
  fetchCallReports,
  computeOutcomes,
  computeCloserStats,
  pct,
  fmtGBP,
  normalizeToGBP,
  type Funnel,
  type CallReport,
} from '@/lib/data/aa-calls'
import { KpiCard } from '@/components/layout/kpi-card'

interface Props {
  workspaceId: string
  from: Date
  to: Date
  funnel: Funnel
  rangeLabel: string
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
      style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>
      {label}
    </p>
  )
}

function OutcomeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const w = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] w-36 shrink-0" style={{ color: 'var(--fg-muted)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="text-[12px] font-semibold tabular-nums w-6 text-right" style={{ color, fontFamily: 'var(--font-jetbrains-mono)' }}>
        {count}
      </span>
      <span className="text-[10px] w-8 text-right" style={{ color: 'var(--fg-subtle)' }}>
        {total > 0 ? `${Math.round(w)}%` : '—'}
      </span>
    </div>
  )
}

function FunnelMini({ label, rows }: { label: string; rows: CallReport[] }) {
  const attended = rows.filter(r => r.type === 'call_closed' || r.type === 'purchase' || r.event_name === 'no_close')
  const closes = rows.filter(r => r.type === 'call_closed' || r.type === 'purchase')
  const revenue = closes.reduce((s, r) => s + normalizeToGBP(r.value, r.currency), 0)
  const cashCollected = closes.reduce((s, r) => s + r.cash_collected, 0)

  const applicable = rows.filter(r => r.event_name !== 'rescheduled')
  const showRate = pct(attended.length, applicable.length)
  const closeRate = pct(closes.length, attended.length)

  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--fg-subtle)', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>{rows.length} calls</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Attended', value: attended.length },
          { label: 'Closes', value: closes.length },
          { label: 'Show rate', value: `${showRate}%` },
          { label: 'Close rate', value: `${closeRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
            <p className="text-[15px] font-semibold tabular-nums mt-0.5"
              style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t pt-2 flex justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Revenue</p>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
            {fmtGBP(revenue)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Cash</p>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
            {fmtGBP(cashCollected)}
          </p>
        </div>
      </div>
    </div>
  )
}

export async function SalesTab({ workspaceId, from, to, funnel, rangeLabel }: Props) {
  const rows = await fetchCallReports(workspaceId, from, to, funnel)
  const outcomes = computeOutcomes(rows)
  const closerStats = computeCloserStats(rows)

  const totalRevenue = rows
    .filter(r => r.type === 'call_closed' || r.type === 'purchase')
    .reduce((s, r) => s + normalizeToGBP(r.value, r.currency), 0)
  const totalCash = rows
    .filter(r => r.type === 'call_closed' || r.type === 'purchase')
    .reduce((s, r) => s + r.cash_collected, 0)
  const cashCollectionRate = pct(totalCash, totalRevenue)
  const applicable = rows.filter(r => r.event_name !== 'rescheduled')
  const showRate = pct(outcomes.attended, applicable.length)
  const closeRate = pct(outcomes.closes, outcomes.attended)
  const avgDeal = outcomes.closes > 0 ? Math.round(totalRevenue / outcomes.closes) : 0
  const rescheduleRate = pct(outcomes.rescheduled, rows.length)

  // P1/P2/O breakdown
  const p1Rows = rows.filter(r => (r.call_type ?? '').toUpperCase() === 'P1')
  const p2Rows = rows.filter(r => (r.call_type ?? '').toUpperCase() === 'P2')
  const oRows  = rows.filter(r => (r.call_type ?? '').toUpperCase() === 'O')

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border p-8 flex flex-col items-center gap-2"
        style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' }}>
        <p className="text-[14px] font-medium" style={{ color: 'var(--fg-muted)' }}>No call reports in this period</p>
        <p className="text-[12px]" style={{ color: 'var(--fg-subtle)' }}>Try This Month or This Quarter</p>
      </div>
    )
  }

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="Cash collected" value={fmtGBP(totalCash)} change={0} hideChange
          changeLabel={`from ${outcomes.closes} close${outcomes.closes !== 1 ? 's' : ''}`}
          numericValue={totalCash} displayType="currency" currency="GBP" large />
        <KpiCard label="Revenue contracted" value={fmtGBP(totalRevenue)} change={0} hideChange
          changeLabel="total contract value" numericValue={totalRevenue} displayType="currency" currency="GBP" large />
        <KpiCard label="Cash collection rate" value={`${cashCollectionRate}%`} change={0} hideChange
          changeLabel="cash / contracted" large />
        <KpiCard label="Avg deal size" value={fmtGBP(avgDeal)} change={0} hideChange
          changeLabel={`across ${outcomes.closes} close${outcomes.closes !== 1 ? 's' : ''}`}
          numericValue={avgDeal} displayType="currency" currency="GBP" large />
      </div>

      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="Show rate" value={`${showRate}%`} change={0} hideChange
          changeLabel={`${outcomes.attended} of ${applicable.length} calls taken`} large />
        <KpiCard label="Attended close rate" value={`${closeRate}%`} change={0} hideChange
          changeLabel={`${outcomes.closes} of ${outcomes.attended} attended`} large />
        <KpiCard label="Total calls" value={String(rows.length)} change={0} hideChange
          changeLabel={`${rangeLabel.toLowerCase()}`} large />
        <KpiCard label="Reschedule rate" value={`${rescheduleRate}%`} change={0} hideChange
          changeLabel={`${outcomes.rescheduled} pending`}
          subline={rescheduleRate > 15 ? 'High — review rescheduling process' : undefined} large />
      </div>

      {/* Outcome breakdown */}
      <div className="rounded-xl border p-5"
        style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <SectionHeader label="Outcome breakdown" />
        <div className="space-y-2.5">
          <OutcomeBar label="Close" count={outcomes.close} total={rows.length} color="var(--success)" />
          <OutcomeBar label="Deposit only" count={outcomes.deposit} total={rows.length} color="#4ade80" />
          <OutcomeBar label="No close" count={outcomes.noClose} total={rows.length} color="var(--warning)" />
          <OutcomeBar label="No-show" count={outcomes.noShow} total={rows.length} color="var(--danger)" />
          <OutcomeBar label="Cancelled by lead" count={outcomes.cancelledByLead} total={rows.length} color="#f87171" />
          <OutcomeBar label="Cancelled by us" count={outcomes.cancelledByUs} total={rows.length} color="#fb923c" />
          <OutcomeBar label="Rescheduled" count={outcomes.rescheduled} total={rows.length} color="var(--fg-subtle)" />
        </div>
      </div>

      {/* Per-closer table */}
      {closerStats.length > 0 && (
        <div className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>Per closer</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Closer', 'Calls', 'Attended', 'Show rate', 'Closes', 'Close rate', 'Revenue', 'Cash', 'Avg deal'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium"
                      style={{ color: 'var(--fg-subtle)', letterSpacing: '0.04em', fontSize: 10, textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closerStats.map((c, i) => (
                  <tr key={c.name}
                    style={{ borderBottom: i < closerStats.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{c.total}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{c.attended}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold"
                      style={{ color: c.showRate >= 60 ? 'var(--success)' : c.showRate >= 40 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {c.showRate}%
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{c.closes}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold"
                      style={{ color: c.closeRate >= 30 ? 'var(--success)' : c.closeRate >= 15 ? 'var(--warning)' : c.closeRate === 0 ? 'var(--fg-subtle)' : 'var(--danger)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {c.closeRate}%
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtGBP(c.revenue)}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtGBP(c.cashCollected)}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {c.avgDeal > 0 ? fmtGBP(c.avgDeal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Funnel breakdown P1/P2/O */}
      {(p1Rows.length > 0 || p2Rows.length > 0 || oRows.length > 0) && (
        <div>
          <SectionHeader label="Funnel breakdown" />
          <div className="grid grid-cols-3 gap-5">
            {p1Rows.length > 0 && <FunnelMini label="P1 — Paid funnel 1" rows={p1Rows} />}
            {p2Rows.length > 0 && <FunnelMini label="P2 — Paid funnel 2" rows={p2Rows} />}
            {oRows.length  > 0 && <FunnelMini label="O — Organic" rows={oRows} />}
          </div>
        </div>
      )}
    </>
  )
}
