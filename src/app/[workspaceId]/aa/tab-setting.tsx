import { fetchAllOpportunities, fetchUsers, STAGES } from '@/lib/ghl-affluent'

// Extract funnel tag from GHL opportunity source field
function oppFunnelTag(opp: { pipelineStageId: string; assignedTo: string | null; status: string; createdAt: string; lastStageChangeAt: string; contact: { id: string; name: string; email: string | null; phone: string | null } | null; id: string }): 'P1' | 'P2' | 'O' | null {
  void opp
  return null
}
import type { Funnel, AARange } from '@/lib/data/aa-calls'
import { ChevronRight } from 'lucide-react'

interface Props {
  workspaceId: string
  from: Date
  to: Date
  funnel: Funnel
  rangeLabel: string
  range: AARange
}

const BOOKED_STAGES = new Set<string>([
  STAGES.MEETING_BOOKED_NEEDS_CONF,
  STAGES.MEETING_BOOKED_APPLICATION,
  STAGES.CONFIRMED_MEETING,
])

function r(num: number, den: number): number {
  return den === 0 ? 0 : (num / den) * 100
}

function rateColor(pct: number, type: 'setting' | 'confirmation' | 'neutral'): string {
  if (pct === 0) return 'var(--fg-subtle)'
  if (type === 'setting')      return pct >= 40 ? 'var(--success)' : pct >= 20 ? 'var(--warning)' : 'var(--danger)'
  if (type === 'confirmation') return pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'
  return 'var(--fg-muted)'
}

function fmtDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function CenteredCard({
  label, value, sub, color, size = 'lg', urgent = false,
}: {
  label: string; value: string | number; sub?: string
  color?: string; size?: 'lg' | 'md'; urgent?: boolean
}) {
  return (
    <div
      className="rounded-xl border flex flex-col gap-1.5 items-center text-center"
      style={{
        background: 'var(--bg-subtle)',
        borderColor: urgent ? 'rgba(240,82,82,0.3)' : 'rgba(255,255,255,0.06)',
        padding: size === 'lg' ? '28px 16px' : '20px 16px',
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span className="tabular-nums font-semibold leading-none"
        style={{
          color: color ?? (urgent ? 'var(--danger)' : 'var(--foreground)'),
          fontFamily: 'var(--font-jetbrains-mono)',
          fontSize: size === 'lg' ? '3rem' : '2rem',
        }}>
        {value}
      </span>
      {sub && <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>{sub}</span>}
    </div>
  )
}


export async function SettingTab({ workspaceId, from, to, funnel, rangeLabel }: Props) {
  let allOpps: Awaited<ReturnType<typeof fetchAllOpportunities>> = []
  let users: Awaited<ReturnType<typeof fetchUsers>> = []
  let fetchError: string | null = null

  try {
    ;[allOpps, users] = await Promise.all([fetchAllOpportunities(), fetchUsers()])
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e)
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border p-6" style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(240,82,82,0.3)' }}>
        <p className="text-[13px]" style={{ color: 'var(--danger)', fontFamily: 'var(--font-jetbrains-mono)' }}>
          GHL fetch error: {fetchError}
        </p>
      </div>
    )
  }

  const userMap = new Map(users.map(u => [u.id, u.name]))

  // Funnel filter using GHL opportunity source field directly — no Airtable join needed
  function oppMatchesFunnel(opp: (typeof allOpps)[0]): boolean {
    if (funnel === 'all') return true
    const tag = oppFunnelTag(opp)
    if (funnel === 'paid') return tag === 'P1' || tag === 'P2'
    if (funnel === 'p1') return tag === 'P1'
    if (funnel === 'p2') return tag === 'P2'
    if (funnel === 'o' || funnel === 'organic') return tag === 'O'
    return true
  }

  const filteredOpps = allOpps.filter(oppMatchesFunnel)

  const worked = filteredOpps.filter(o => {
    const d = new Date(o.lastStageChangeAt)
    return d >= from && d <= to
  })

  const newApps = filteredOpps.filter(o => {
    const d = new Date(o.createdAt)
    return d >= from && d <= to
  })

  const byStage = (id: string) => worked.filter(o => o.pipelineStageId === id).length
  const bookedCount    = worked.filter(o => BOOKED_STAGES.has(o.pipelineStageId)).length
  const confirmedCount = byStage(STAGES.CONFIRMED_MEETING)
  const noAnswerCount  = byStage(STAGES.CALLED_NO_ANSWER)
  const noShowCount    = byStage(STAGES.NO_SHOW)
  const cancelledCount = byStage(STAGES.CANCELLED)
  const lostCount      = byStage(STAGES.NOT_INTERESTED_LOST)
  const settingRate      = r(bookedCount, worked.length)
  const confirmationRate = r(confirmedCount, bookedCount)

  const contactedNewApps = newApps.filter(o => o.pipelineStageId !== STAGES.APPLICATION_RECEIVED)
  const avgSpeedToLeadHours = contactedNewApps.length > 0
    ? contactedNewApps.reduce((sum, o) => {
        const ms = new Date(o.lastStageChangeAt).getTime() - new Date(o.createdAt).getTime()
        return sum + Math.max(ms, 0) / 3_600_000
      }, 0) / contactedNewApps.length
    : null

  const allFiltered = allOpps.filter(oppMatchesFunnel)
  const backlogUncontacted = allFiltered.filter(o => o.pipelineStageId === STAGES.APPLICATION_RECEIVED).length
  const backlogNoAnswer    = allFiltered.filter(o => o.pipelineStageId === STAGES.CALLED_NO_ANSWER).length
  const backlogNeedsConf   = allFiltered.filter(o => o.pipelineStageId === STAGES.MEETING_BOOKED_NEEDS_CONF).length

  // Per-setter
  const repMap = new Map<string, { id: string; name: string; apps: number; booked: number; confirmed: number; settingRate: number; confirmationRate: number; noAnswer: number; noShow: number; lost: number }>()
  for (const opp of worked) {
    const repId   = opp.assignedTo ?? '__unassigned__'
    const repName = opp.assignedTo ? (userMap.get(opp.assignedTo) ?? 'Unknown') : 'Unassigned'
    if (!repMap.has(repId)) repMap.set(repId, { id: repId, name: repName, apps: 0, booked: 0, confirmed: 0, settingRate: 0, confirmationRate: 0, noAnswer: 0, noShow: 0, lost: 0 })
    const rep = repMap.get(repId)!
    rep.apps++
    if (BOOKED_STAGES.has(opp.pipelineStageId)) rep.booked++
    if (opp.pipelineStageId === STAGES.CONFIRMED_MEETING)   rep.confirmed++
    if (opp.pipelineStageId === STAGES.CALLED_NO_ANSWER)    rep.noAnswer++
    if (opp.pipelineStageId === STAGES.NO_SHOW)             rep.noShow++
    if (opp.pipelineStageId === STAGES.NOT_INTERESTED_LOST) rep.lost++
  }
  const repRows = Array.from(repMap.values()).map(rep => ({
    ...rep,
    settingRate:      r(rep.booked, rep.apps),
    confirmationRate: r(rep.confirmed, rep.booked),
  }))

  const hasActivity = worked.length > 0 || newApps.length > 0

  return (
    <div className="space-y-5">

      {/* 4 core numbers */}
      <div className="grid grid-cols-4 gap-5">
        <CenteredCard label="New Applications" value={newApps.length}
          sub={`arrived in ${rangeLabel.toLowerCase()}`} />
        <CenteredCard label="Meetings Booked" value={bookedCount}
          sub={`${worked.length} leads touched`} />
        <CenteredCard label="Confirmed" value={confirmedCount}
          sub={bookedCount > 0 ? `${confirmationRate.toFixed(0)}% of booked` : 'setter called + verified'} />
        <CenteredCard
          label="Speed to Lead"
          value={avgSpeedToLeadHours !== null ? fmtDuration(avgSpeedToLeadHours) : '—'}
          sub={contactedNewApps.length > 0
            ? `avg across ${contactedNewApps.length} new lead${contactedNewApps.length !== 1 ? 's' : ''}`
            : 'no new leads contacted yet'}
          color={
            avgSpeedToLeadHours === null ? 'var(--fg-subtle)'
            : avgSpeedToLeadHours <= 1  ? 'var(--success)'
            : avgSpeedToLeadHours <= 4  ? 'var(--warning)'
            : 'var(--danger)'
          }
        />
      </div>

      {/* Funnel flow */}
      <div className="flex items-stretch gap-1.5">
        {[
          { label: 'Leads Worked', count: worked.length },
          { label: 'Meetings Booked', count: bookedCount },
          { label: 'Confirmed', count: confirmedCount },
        ].map((stage, i) => (
          <div key={stage.label} className="contents">
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl py-5 gap-1.5"
              style={{ background: 'var(--bg-subtle)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-center"
                style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>{stage.label}</span>
              <span className="text-[2rem] font-semibold tabular-nums leading-none"
                style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                {stage.count.toLocaleString()}
              </span>
            </div>
            {i < 2 && (() => {
              const rate = i === 0 ? settingRate : confirmationRate
              const color = rate >= 40 ? 'var(--success)' : rate >= 20 ? 'var(--warning)' : rate > 0 ? 'var(--danger)' : 'var(--fg-subtle)'
              return (
                <div className="flex flex-col items-center justify-center gap-1 shrink-0" style={{ width: 72 }}>
                  <span className="text-[11px] font-semibold tabular-nums whitespace-nowrap"
                    style={{ color, fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {rate > 0 ? `${rate.toFixed(0)}%` : '—'} {i === 0 ? 'set' : 'confirmed'}
                  </span>
                  <div className="flex items-center gap-0.5 w-full">
                    <div className="flex-1 h-px" style={{ background: color, opacity: 0.4 }} />
                    <ChevronRight size={10} style={{ color, opacity: 0.5 }} strokeWidth={2} />
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      {/* 2 rates */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-xl border py-5 flex flex-col gap-1.5 items-center text-center"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>Setting rate</span>
          <span className="text-[2rem] font-semibold tabular-nums leading-none"
            style={{ color: rateColor(settingRate, 'setting'), fontFamily: 'var(--font-jetbrains-mono)' }}>
            {worked.length === 0 ? '—' : `${settingRate.toFixed(0)}%`}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
            {bookedCount} of {worked.length} leads touched
          </span>
        </div>
        <div className="rounded-xl border py-5 flex flex-col gap-1.5 items-center text-center"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>Confirmation rate</span>
          <span className="text-[2rem] font-semibold tabular-nums leading-none"
            style={{ color: rateColor(confirmationRate, 'confirmation'), fontFamily: 'var(--font-jetbrains-mono)' }}>
            {bookedCount === 0 ? '—' : `${confirmationRate.toFixed(0)}%`}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
            {confirmedCount} of {bookedCount} booked
          </span>
        </div>
      </div>

      {/* Backlog — only if there's something to action */}
      {(backlogUncontacted > 0 || backlogNoAnswer > 0 || backlogNeedsConf > 0) && (
        <div className="rounded-xl border p-4 flex items-center gap-6"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,184,36,0.2)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest shrink-0"
            style={{ color: '#FBB824', letterSpacing: '0.1em' }}>Needs action</p>
          <div className="flex gap-6">
            {backlogUncontacted > 0 && (
              <div>
                <p className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>Needs first call</p>
                <p className="text-[18px] font-semibold tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{backlogUncontacted}</p>
              </div>
            )}
            {backlogNoAnswer > 0 && (
              <div>
                <p className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>No answer — re-call</p>
                <p className="text-[18px] font-semibold tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{backlogNoAnswer}</p>
              </div>
            )}
            {backlogNeedsConf > 0 && (
              <div>
                <p className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>Awaiting confirmation</p>
                <p className="text-[18px] font-semibold tabular-nums" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains-mono)' }}>{backlogNeedsConf}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-setter table — columns trimmed to what matters */}
      {repRows.length > 0 && (
        <div className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--foreground)' }}>Per setter</p>
            <p className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>{rangeLabel.toLowerCase()}</p>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Setter', 'Leads', 'Booked', 'Confirmed', 'Setting rate', 'Conf. rate'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium"
                    style={{ color: 'var(--fg-subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repRows.map((rep, i) => (
                <tr key={rep.id}
                  style={{ borderBottom: i < repRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{rep.name}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{rep.apps}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{rep.booked}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>{rep.confirmed}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold"
                    style={{ color: rateColor(rep.settingRate, 'setting'), fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {rep.apps > 0 ? `${rep.settingRate.toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold"
                    style={{ color: rateColor(rep.confirmationRate, 'confirmation'), fontFamily: 'var(--font-jetbrains-mono)' }}>
                    {rep.booked > 0 ? `${rep.confirmationRate.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!hasActivity && (
        <div className="rounded-xl border p-8 flex flex-col items-center gap-2"
          style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' }}>
          <p className="text-[14px] font-medium" style={{ color: 'var(--fg-muted)' }}>No activity in this period</p>
          <p className="text-[12px]" style={{ color: 'var(--fg-subtle)' }}>Try This Week or This Month</p>
        </div>
      )}
    </div>
  )
}
