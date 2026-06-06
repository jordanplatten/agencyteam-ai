import {
  fetchCallReports,
  fetchAAAdSpend,
  computeOutcomes,
  pct,
  fmtGBP,
  normalizeToGBP,
  type Funnel,
  type CallReport,
  type AdSpendRow,
} from '@/lib/data/aa-calls'
import { KpiCard } from '@/components/layout/kpi-card'

interface Props {
  workspaceId: string
  from: Date
  to: Date
  funnel: Funnel
  rangeLabel: string
}

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>
        {label}
      </p>
      {sub && <p className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>{sub}</p>}
    </div>
  )
}

interface UtmRow {
  key: string
  calls: number
  attended: number
  closes: number
  showRate: number
  closeRate: number
  revenue: number
  cashCollected: number
}

function buildUtmTable(rows: CallReport[], key: keyof CallReport): UtmRow[] {
  const map = new Map<string, UtmRow>()
  for (const r of rows) {
    const k = (r[key] as string) || '(not set)'
    if (!map.has(k)) map.set(k, { key: k, calls: 0, attended: 0, closes: 0, showRate: 0, closeRate: 0, revenue: 0, cashCollected: 0 })
    const s = map.get(k)!
    s.calls++
    if (r.type === 'call_closed' || r.type === 'purchase' || r.event_name === 'no_close') s.attended++
    if (r.type === 'call_closed' || r.type === 'purchase') {
      s.closes++
      s.revenue += normalizeToGBP(r.value, r.currency)
      s.cashCollected += r.cash_collected
    }
  }
  return Array.from(map.values())
    .map(s => ({ ...s, showRate: pct(s.attended, s.calls), closeRate: pct(s.closes, s.attended) }))
    .sort((a, b) => b.revenue - a.revenue)
}

function UtmTable({
  rows, label, emptyNote,
}: {
  rows: UtmRow[]
  label: string
  emptyNote?: string
}) {
  if (rows.length === 0 || (rows.length === 1 && rows[0].key === '(not set)')) {
    return (
      <div className="rounded-xl border p-4"
        style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <SectionHeader label={label} />
        <p className="text-[12px]" style={{ color: 'var(--fg-subtle)' }}>
          {emptyNote ?? 'No UTM data available for this period.'}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>{label}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[label, 'Calls', 'Attended', 'Show', 'Closes', 'Close rate', 'Revenue', 'Cash'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium"
                  style={{ color: 'var(--fg-subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                <td className="px-4 py-3 font-medium max-w-[200px] truncate" style={{ color: 'var(--foreground)' }}>{r.key}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{r.calls}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{r.attended}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{r.showRate}%</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{r.closes}</td>
                <td className="px-4 py-3 tabular-nums font-semibold"
                  style={{ color: r.closeRate >= 30 ? 'var(--success)' : r.closeRate >= 15 ? 'var(--warning)' : 'var(--fg-subtle)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {r.attended > 0 ? `${r.closeRate}%` : '—'}
                </td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtGBP(r.revenue)}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtGBP(r.cashCollected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SpendTable({ spend }: { spend: AdSpendRow[] }) {
  // Group by campaign
  const campaigns = new Map<string, { spend: number; impressions: number; clicks: number }>()
  for (const r of spend) {
    const name = r.campaign_name || 'Unknown'
    const existing = campaigns.get(name) ?? { spend: 0, impressions: 0, clicks: 0 }
    campaigns.set(name, {
      spend: existing.spend + r.spend,
      impressions: existing.impressions + r.impressions,
      clicks: existing.clicks + r.clicks,
    })
  }

  const rows = Array.from(campaigns.entries()).sort((a, b) => b[1].spend - a[1].spend)

  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>Spend by campaign</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Campaign', 'Spend', 'Impressions', 'Clicks', 'CTR'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium"
                  style={{ color: 'var(--fg-subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, s], i) => {
              const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0.00'
              return (
                <tr key={name} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                  <td className="px-4 py-3 font-medium max-w-[240px] truncate" style={{ color: 'var(--foreground)' }}>{name}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtGBP(s.spend)}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{s.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{s.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{ctr}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export async function MarketingTab({ workspaceId, from, to, funnel, rangeLabel }: Props) {
  const [rows, spend] = await Promise.all([
    fetchCallReports(workspaceId, from, to, funnel),
    fetchAAAdSpend(workspaceId, from, to),
  ])

  const outcomes = computeOutcomes(rows)
  const totalSpend = spend.reduce((s, r) => s + r.spend, 0)
  const totalRevenue = rows
    .filter(r => r.type === 'call_closed' || r.type === 'purchase')
    .reduce((s, r) => s + normalizeToGBP(r.value, r.currency), 0)

  const attended = outcomes.attended
  const closes = outcomes.closes
  const costPerCall = attended > 0 ? totalSpend / attended : 0
  const costPerClose = closes > 0 ? totalSpend / closes : 0
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  // Unmatched counter: rows with no UTM data
  const unmatched = rows.filter(r => !r.utm_source && !r.utm_campaign).length
  const unmatchedPct = rows.length > 0 ? Math.round((unmatched / rows.length) * 100) : 0

  // UTM tables (only non-null values)
  const hasUtm = rows.some(r => r.utm_source || r.utm_campaign)
  const bySource   = buildUtmTable(rows.filter(r => r.utm_source), 'utm_source')
  const byCampaign = buildUtmTable(rows.filter(r => r.utm_campaign), 'utm_campaign')
  const byContent  = buildUtmTable(rows.filter(r => r.utm_content), 'utm_content')

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="Ad spend" value={fmtGBP(totalSpend)} change={0} hideChange
          changeLabel={rangeLabel.toLowerCase()} numericValue={totalSpend} displayType="currency" currency="GBP" large />
        <KpiCard label="Cost per attended call" value={costPerCall > 0 ? fmtGBP(costPerCall) : '—'} change={0} hideChange
          changeLabel={`${attended} attended calls`} large />
        <KpiCard label="Cost per close" value={costPerClose > 0 ? fmtGBP(costPerClose) : '—'} change={0} hideChange
          changeLabel={`${closes} closes`} large />
        <KpiCard label="ROAS" value={totalSpend > 0 ? `${roas.toFixed(2)}x` : '—'} change={0} hideChange
          changeLabel="revenue / spend" large />
      </div>

      {/* Unmatched warning */}
      {rows.length > 0 && (
        <div
          className="rounded-xl border px-5 py-3 flex items-center justify-between"
          style={{
            background: unmatched > 0 ? 'rgba(251,184,36,0.06)' : 'var(--bg-subtle)',
            borderColor: unmatched > 0 ? 'rgba(251,184,36,0.2)' : 'rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <p className="text-[12px] font-medium" style={{ color: unmatched > 0 ? '#FBB824' : 'var(--fg-muted)' }}>
              {unmatched > 0
                ? `${unmatched} of ${rows.length} calls (${unmatchedPct}%) have no UTM data`
                : 'All calls have UTM attribution'}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
              {unmatched > 0
                ? 'Marketing pulse metrics are based on the matched subset only. Install the Apex pixel on the funnel landing page to improve attribution.'
                : 'Full attribution is available for this period.'}
            </p>
          </div>
          <span
            className="text-[11px] font-semibold tabular-nums shrink-0 ml-4"
            style={{ color: unmatched > 0 ? '#FBB824' : 'var(--success)', fontFamily: 'var(--font-jetbrains-mono)' }}
          >
            {rows.length - unmatched}/{rows.length} matched
          </span>
        </div>
      )}

      {/* Spend by campaign */}
      <SpendTable spend={spend} />

      {/* UTM tables */}
      {hasUtm ? (
        <>
          <UtmTable rows={bySource} label="By source (utm_source)" />
          <UtmTable rows={byCampaign} label="By campaign (utm_campaign)" />
          {byContent.length > 0 && (
            <UtmTable rows={byContent} label="By ad creative (utm_content)" />
          )}
        </>
      ) : (
        <div className="rounded-xl border p-6"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' }}>
          <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--fg-muted)' }}>UTM attribution not available</p>
          <p className="text-[12px]" style={{ color: 'var(--fg-subtle)' }}>
            Add UTM parameters to your Meta ad URLs and install the Apex pixel on your landing pages. Once those are live, this tab will populate with per-source, per-campaign, and per-ad performance data.
          </p>
        </div>
      )}
    </>
  )
}
