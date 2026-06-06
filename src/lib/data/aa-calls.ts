import { createServiceClient } from '@/lib/supabase/service'
import { format } from 'date-fns'

export type Funnel = 'all' | 'paid' | 'organic' | 'p1' | 'p2' | 'o'
export type AARange = 'today' | 'week' | 'month' | 'quarter'

const TZ_OFFSET_MS = 60 * 60 * 1000 // UK BST offset

export function getAADateRange(range: AARange): { from: Date; to: Date; label: string } {
  const now = new Date()
  const nowBST = new Date(now.getTime() + TZ_OFFSET_MS)
  let from: Date
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)

  if (range === 'today') {
    from = new Date(now)
    from.setHours(0, 0, 0, 0)
  } else if (range === 'week') {
    from = new Date(nowBST)
    const day = from.getDay()
    from.setDate(from.getDate() - (day === 0 ? 6 : day - 1))
    from.setHours(0, 0, 0, 0)
    from = new Date(from.getTime() - TZ_OFFSET_MS)
  } else if (range === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    from = new Date(now.getFullYear(), q * 3, 1)
    from.setHours(0, 0, 0, 0)
  } else {
    // month (default)
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    from.setHours(0, 0, 0, 0)
  }

  const labels: Record<AARange, string> = {
    today: 'Today', week: 'This Week', month: 'This Month', quarter: 'This Quarter',
  }
  return { from, to, label: labels[range] }
}

export interface CallReport {
  id: string
  external_id: string
  type: string
  event_name: string | null
  value: number
  currency: string
  email: string | null
  occurred_at: string
  closer_name: string | null
  call_type: string | null
  cash_collected: number
  product_sold: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
}

export function isAttended(r: CallReport): boolean {
  return r.type === 'call_closed' || r.type === 'purchase' || r.event_name === 'no_close'
}

export function isClose(r: CallReport): boolean {
  return r.type === 'call_closed' || r.type === 'purchase'
}

export function funnelMatches(r: CallReport, funnel: Funnel): boolean {
  if (funnel === 'all') return true
  const ct = (r.call_type ?? '').toUpperCase()
  if (funnel === 'paid') return ct === 'P1' || ct === 'P2'
  if (funnel === 'organic') return ct === 'O'
  if (funnel === 'p1') return ct === 'P1'
  if (funnel === 'p2') return ct === 'P2'
  if (funnel === 'o') return ct === 'O'
  return true
}

export function pct(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 100)
}

export function fmtGBP(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n)
}

export function normalizeToGBP(value: number, currency: string): number {
  if (!currency || currency === 'GBP') return value
  if (currency === 'USD') return value * 0.79
  if (currency === 'EUR') return value * 0.86
  return value
}

export async function fetchCallReports(
  workspaceId: string,
  from: Date,
  to: Date,
  funnel: Funnel = 'all',
): Promise<CallReport[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('conversions')
    .select('id, external_id, type, event_name, value, currency, email, occurred_at, metadata')
    .eq('workspace_id', workspaceId)
    .eq('external_source', 'manual')
    .like('external_id', 'CALL#%')
    .gte('occurred_at', from.toISOString())
    .lte('occurred_at', to.toISOString())
    .order('occurred_at', { ascending: false })

  const rows: CallReport[] = (data ?? []).map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    return {
      id: r.id,
      external_id: r.external_id ?? '',
      type: r.type,
      event_name: r.event_name ?? null,
      value: Number(r.value ?? 0),
      currency: r.currency ?? 'GBP',
      email: r.email ?? null,
      occurred_at: r.occurred_at,
      closer_name: (meta.closer_name as string) ?? null,
      call_type: (meta.call_type as string) ?? null,
      cash_collected: Number(meta.cash_collected ?? 0),
      product_sold: (meta.product_sold as string) ?? null,
      utm_source: (meta.utm_source as string) ?? null,
      utm_medium: (meta.utm_medium as string) ?? null,
      utm_campaign: (meta.utm_campaign as string) ?? null,
      utm_content: (meta.utm_content as string) ?? null,
    }
  })

  if (funnel === 'all') return rows
  return rows.filter((r) => funnelMatches(r, funnel))
}

export interface AdSpendRow {
  date: string
  spend: number
  impressions: number
  clicks: number
  campaign_name: string
  ad_name: string
}

export async function fetchAAAdSpend(
  workspaceId: string,
  from: Date,
  to: Date,
): Promise<AdSpendRow[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('ad_insights_daily')
    .select('date, spend, impressions, clicks, ads(name, campaigns(name))')
    .eq('workspace_id', workspaceId)
    .gte('date', format(from, 'yyyy-MM-dd'))
    .lte('date', format(to, 'yyyy-MM-dd'))
    .order('date', { ascending: false })

  return (data ?? []).map((r) => {
    const ad = (r.ads as unknown as Record<string, unknown> | null) ?? {}
    const campaign = (ad.campaigns as unknown as Record<string, unknown> | null) ?? {}
    return {
      date: r.date,
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      ad_name: String(ad.name ?? ''),
      campaign_name: String(campaign.name ?? ''),
    }
  })
}

// Per-closer stats computed from call reports
export interface CloserStats {
  name: string
  total: number
  attended: number
  closes: number
  showRate: number
  closeRate: number
  revenue: number
  cashCollected: number
  avgDeal: number
}

export function computeCloserStats(rows: CallReport[]): CloserStats[] {
  const map = new Map<string, CloserStats>()

  for (const r of rows) {
    const name = r.closer_name ?? 'Unassigned'
    if (!map.has(name)) {
      map.set(name, { name, total: 0, attended: 0, closes: 0, showRate: 0, closeRate: 0, revenue: 0, cashCollected: 0, avgDeal: 0 })
    }
    const s = map.get(name)!
    // Count all calls except rescheduled in "total"
    if (r.event_name !== 'rescheduled') s.total++
    if (isAttended(r)) s.attended++
    if (isClose(r)) {
      s.closes++
      s.revenue += normalizeToGBP(r.value, r.currency)
      s.cashCollected += r.cash_collected
    }
  }

  return Array.from(map.values()).map((s) => ({
    ...s,
    showRate: pct(s.attended, s.total),
    closeRate: pct(s.closes, s.attended),
    avgDeal: s.closes > 0 ? Math.round(s.revenue / s.closes) : 0,
  })).sort((a, b) => b.revenue - a.revenue)
}

// Outcome counts from call reports
export interface OutcomeCounts {
  close: number
  deposit: number
  noClose: number
  noShow: number
  cancelledByLead: number
  cancelledByUs: number
  rescheduled: number
  total: number
  attended: number
  closes: number
}

export function computeOutcomes(rows: CallReport[]): OutcomeCounts {
  const c: OutcomeCounts = {
    close: 0, deposit: 0, noClose: 0, noShow: 0, cancelledByLead: 0, cancelledByUs: 0,
    rescheduled: 0, total: rows.length, attended: 0, closes: 0,
  }
  for (const r of rows) {
    if (r.type === 'call_closed') { c.close++; c.closes++ }
    else if (r.type === 'purchase') { c.deposit++; c.closes++ }
    else if (r.event_name === 'no_close') c.noClose++
    else if (r.event_name === 'no_show') c.noShow++
    else if (r.event_name === 'cancelled_by_lead') c.cancelledByLead++
    else if (r.event_name === 'cancelled_by_us') c.cancelledByUs++
    else if (r.event_name === 'rescheduled') c.rescheduled++
    if (isAttended(r)) c.attended++
  }
  return c
}
