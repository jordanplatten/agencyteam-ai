import { redirect } from 'next/navigation'
import { getWorkspaceById } from '@/lib/data/workspace'
import { Suspense } from 'react'
import { AATabs, type TabId } from './aa-tabs'
import { getAADateRange, type Funnel, type AARange } from '@/lib/data/aa-calls'
import { SalesTab } from './tab-sales'
import { MarketingTab } from './tab-marketing'
import { SettingTab } from './tab-setting'
import { OverviewTab } from './tab-overview'

const AA_WORKSPACE_ID = 'e316ab5b-0af5-40f0-bcd6-52902fa7c5d7'

export default async function AADashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ tab?: string; range?: string; funnel?: string; from?: string; to?: string }>
}) {
  const { workspaceId } = await params

  if (workspaceId !== AA_WORKSPACE_ID) redirect('/')

  const ws = await getWorkspaceById(workspaceId)
  if (!ws) redirect('/')

  const sp = await searchParams
  const tab = (['overview', 'setting', 'sales', 'marketing'].includes(sp.tab ?? '')
    ? sp.tab
    : 'overview') as TabId
  const range = (['today', 'week', 'month', 'quarter'].includes(sp.range ?? '')
    ? sp.range
    : 'quarter') as AARange
  const funnel = (['all', 'paid', 'organic', 'p1', 'p2', 'o'].includes(sp.funnel ?? '')
    ? sp.funnel
    : 'all') as Funnel

  const customFrom = sp.from as string | undefined
  const customTo   = sp.to   as string | undefined

  let from: Date, to: Date, rangeLabel: string
  if (customFrom && customTo) {
    from = new Date(customFrom); from.setHours(0, 0, 0, 0)
    to   = new Date(customTo);   to.setHours(23, 59, 59, 999)
    rangeLabel = `${customFrom} → ${customTo}`
  } else {
    const r = getAADateRange(range)
    from = r.from; to = r.to; rangeLabel = r.label
  }

  return (
    <div className="min-h-full">
      {/* Tab nav + filters */}
      <Suspense fallback={null}>
        <AATabs
          currentTab={tab}
          currentRange={range}
          currentFunnel={funnel}
          currentFrom={customFrom}
          currentTo={customTo}
          workspaceId={workspaceId}
        />
      </Suspense>

      {/* Tab content */}
      <div className="px-8 py-6 space-y-5" style={{ maxWidth: '1500px', margin: '0 auto' }}>
        {tab === 'overview'  && <OverviewTab  workspaceId={workspaceId} from={from} to={to} funnel={funnel} rangeLabel={rangeLabel} />}
        {tab === 'setting'   && <SettingTab   workspaceId={workspaceId} from={from} to={to} funnel={funnel} rangeLabel={rangeLabel} range={range} />}
        {tab === 'sales'     && <SalesTab     workspaceId={workspaceId} from={from} to={to} funnel={funnel} rangeLabel={rangeLabel} />}
        {tab === 'marketing' && <MarketingTab workspaceId={workspaceId} from={from} to={to} funnel={funnel} rangeLabel={rangeLabel} />}
      </div>
    </div>
  )
}
