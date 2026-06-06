const GHL_API_KEY  = process.env.GHL_API_KEY ?? ''
const LOCATION_ID  = '7FW4sdj7YXiBoeVCsq7d'
const PIPELINE_ID  = 'yeCDp6aOajXGRAkM9747'
const BASE         = 'https://services.leadconnectorhq.com'
const HEADERS      = () => ({
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: '2021-07-28',
})

export const STAGES = {
  APPLICATION_RECEIVED:        'fd403fd0-04b1-4005-b620-299e412e8c53',
  MEETING_BOOKED_NEEDS_CONF:   'dc4f1e5e-2fd3-41fd-b2c6-50e295910c8e',
  CALLED_NO_ANSWER:            'a23b9a79-9fe3-481a-af9e-7f64f7ecd6f8',
  NO_SHOW:                     '715eeeb9-d53b-4f8d-99f4-2b4298528d30',
  CANCELLED:                   'f07aba57-bb40-4686-9eab-de32b9f668d0',
  MEETING_BOOKED_APPLICATION:  'b993642e-d35d-4ee9-967f-1dc5248d734d',
  CONFIRMED_MEETING:           '64183335-5d86-4142-9ecc-ece9ed469cdf',
  NOT_INTERESTED_LOST:         'ed1e08c7-8fbb-44ba-bf12-1af4eebef910',
} as const

export type StageId = (typeof STAGES)[keyof typeof STAGES]

export const STAGE_LABELS: Record<string, string> = {
  [STAGES.APPLICATION_RECEIVED]:        'Application Received',
  [STAGES.MEETING_BOOKED_NEEDS_CONF]:   'Meeting Booked (Needs Confirmation)',
  [STAGES.CALLED_NO_ANSWER]:            'Called — No Answer',
  [STAGES.NO_SHOW]:                     'No-Show',
  [STAGES.CANCELLED]:                   'Cancelled',
  [STAGES.MEETING_BOOKED_APPLICATION]:  'Meeting Booked (Application)',
  [STAGES.CONFIRMED_MEETING]:           'Confirmed Meeting',
  [STAGES.NOT_INTERESTED_LOST]:         'Not Interested / Lost',
}

export interface GHLOpportunity {
  id: string
  pipelineStageId: string
  assignedTo: string | null
  status: string
  createdAt: string
  lastStageChangeAt: string
  contact: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
}

export interface GHLUser {
  id: string
  name: string
  email: string
}

export async function fetchAllOpportunities(): Promise<GHLOpportunity[]> {
  const all: GHLOpportunity[] = []
  let startAfter: number | null = null
  let startAfterId: string | null = null

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      location_id: LOCATION_ID,
      pipeline_id: PIPELINE_ID,
      limit: '100',
    })
    if (startAfter !== null && startAfterId) {
      params.set('startAfter', String(startAfter))
      params.set('startAfterId', startAfterId)
    }

    const res = await fetch(`${BASE}/opportunities/search?${params}`, {
      headers: HEADERS(),
      cache: 'no-store',
    })
    if (!res.ok) break

    const data = await res.json()
    const opps: GHLOpportunity[] = (data.opportunities ?? []).map((o: Record<string, unknown>) => ({
      id: o.id,
      pipelineStageId: o.pipelineStageId,
      assignedTo: o.assignedTo ?? null,
      status: o.status,
      createdAt: o.createdAt,
      lastStageChangeAt: o.lastStageChangeAt,
      contact: o.contact
        ? {
            id: (o.contact as Record<string, unknown>).id,
            name: (o.contact as Record<string, unknown>).name,
            email: (o.contact as Record<string, unknown>).email ?? null,
            phone: (o.contact as Record<string, unknown>).phone ?? null,
          }
        : null,
    }))

    all.push(...opps)
    if (opps.length < 100) break

    const last = data.opportunities[data.opportunities.length - 1]
    if (last?.sort?.length >= 2) {
      startAfter = last.sort[0]
      startAfterId = last.sort[1]
    } else {
      break
    }
  }

  return all
}

export async function fetchUsers(): Promise<GHLUser[]> {
  const res = await fetch(`${BASE}/users/?locationId=${LOCATION_ID}`, {
    headers: HEADERS(),
    next: { revalidate: 300 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.users ?? []).map((u: Record<string, unknown>) => ({
    id: u.id,
    name: u.name ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
    email: u.email,
  }))
}
