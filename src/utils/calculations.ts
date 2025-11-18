type ConversionPeriod = 'daily' | 'weekly' | 'monthly'

export type UserEvent = {
  userId: string
  eventName: string
  timestamp: string
  properties?: Record<string, any>
}

export type ConversionPoint = {
  period: string
  step1_users: number
  step2_users: number
  conversion_rate: number
}

const STEP1_EVENT = 'menuBarSelected'
const STEP1_PROPERTY_KEY = 'selected_menu'
const STEP1_PROPERTY_VALUE = 'community'

const DEFAULT_STEP2_EVENTS = new Set([
  'communityToggleLike',
  'communityNewPost',
  'communityNewComment',
  'communityLoadMorePosts',
  'communitySelectedPostTab',
  'communityShowAllPosts',
  'communityNotificationIconClicked',
  'communityNotificationClicked',
  'communityNotificationMarkAllAsRead',
  'communityNotificationSelectedTab',
])

const DAY_IN_MS = 24 * 60 * 60 * 1000

function toUTCDate(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getPeriodKey(date: Date, period: ConversionPeriod): { key: string; start: Date } {
  const utc = toUTCDate(date)

  if (period === 'daily') {
    return { key: utc.toISOString().slice(0, 10), start: utc }
  }

  if (period === 'weekly') {
    const day = utc.getUTCDay()
    const diffToMonday = (day + 6) % 7
    const monday = new Date(utc.getTime() - diffToMonday * DAY_IN_MS)
    return { key: monday.toISOString().slice(0, 10), start: monday }
  }

  // monthly
  const month = `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}`
  const monthStart = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), 1))
  return { key: month, start: monthStart }
}

function isStep1Event(event: UserEvent): boolean {
  if (event.eventName !== STEP1_EVENT) return false
  const selectedMenu = (event.properties?.[STEP1_PROPERTY_KEY] ?? '').toString().toLowerCase()
  return selectedMenu === STEP1_PROPERTY_VALUE
}

function isStep2Event(event: UserEvent, step2Events: Set<string>): boolean {
  return step2Events.has(event.eventName)
}

function safeParseDate(timestamp: string): Date | null {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * Calculates conversion rates per period.
 * @param period Target aggregation period.
 * @param events Array of user events.
 * @param step2EventNames Optional override for step 2 event names.
 */
export function calculateConversionRate(
  period: ConversionPeriod,
  events: UserEvent[],
  step2EventNames: string[] = Array.from(DEFAULT_STEP2_EVENTS)
): ConversionPoint[] {
  if (!Array.isArray(events) || events.length === 0) return []

  const step2Events = new Set(step2EventNames)
  const step1Map = new Map<string, Map<string, number>>() // period -> (userId -> first step1 timestamp)
  const step2Map = new Map<string, Set<string>>() // period -> set of users who passed step2

  for (const event of events) {
    if (!event?.userId || !event?.eventName || !event?.timestamp) continue
    const eventDate = safeParseDate(event.timestamp)
    if (!eventDate) continue

    const { key: periodKey } = getPeriodKey(eventDate, period)

    if (isStep1Event(event)) {
      if (!step1Map.has(periodKey)) {
        step1Map.set(periodKey, new Map())
      }
      const userMap = step1Map.get(periodKey)!
      const existing = userMap.get(event.userId)
      const timestampMs = eventDate.getTime()
      if (existing === undefined || timestampMs < existing) {
        userMap.set(event.userId, timestampMs)
      }
      continue
    }

    if (isStep2Event(event, step2Events)) {
      const userPeriodMap = step1Map.get(periodKey)
      if (!userPeriodMap) continue
      const step1Time = userPeriodMap.get(event.userId)
      if (step1Time === undefined) continue

      if (eventDate.getTime() < step1Time) continue

      if (!step2Map.has(periodKey)) {
        step2Map.set(periodKey, new Set())
      }
      step2Map.get(periodKey)!.add(event.userId)
    }
  }

  const periods = Array.from(step1Map.keys())
  const sorted = periods.sort((a, b) => {
    const dateA = safeParseDate(a) ?? new Date(a)
    const dateB = safeParseDate(b) ?? new Date(b)
    return dateA.getTime() - dateB.getTime()
  })

  return sorted.map((key) => {
    const step1Users = step1Map.get(key)?.size ?? 0
    const step2Users = step2Map.get(key)?.size ?? 0
    const conversion = step1Users === 0 ? 0 : (step2Users / step1Users) * 100

    return {
      period: key,
      step1_users: step1Users,
      step2_users: step2Users,
      conversion_rate: Number(conversion.toFixed(2)),
    }
  })
}

export type RetentionPoint = {
  period: string
  active_users: number
  returning_users: number | null
  retention_rate: number | null
}

export function calculateRetentionRate(
  period: ConversionPeriod,
  events: UserEvent[],
  communityEventNames: string[] = Array.from(DEFAULT_STEP2_EVENTS)
): RetentionPoint[] {
  if (!Array.isArray(events) || events.length === 0) return []

  const communityEvents = new Set(communityEventNames)
  const periodActivity = new Map<string, Set<string>>()

  for (const event of events) {
    if (!event?.userId || !event?.eventName || !event?.timestamp) continue
    if (!communityEvents.has(event.eventName)) continue
    const ts = safeParseDate(event.timestamp)
    if (!ts) continue
    const { key } = getPeriodKey(ts, period)
    if (!periodActivity.has(key)) periodActivity.set(key, new Set())
    periodActivity.get(key)!.add(event.userId)
  }

  const orderedPeriods = Array.from(periodActivity.keys()).sort((a, b) => {
    const dateA = safeParseDate(a) ?? new Date(a)
    const dateB = safeParseDate(b) ?? new Date(b)
    return dateA.getTime() - dateB.getTime()
  })

  return orderedPeriods.map((key, index) => {
    const current = periodActivity.get(key) ?? new Set()
    if (index === 0) {
      return {
        period: key,
        active_users: current.size,
        returning_users: null,
        retention_rate: null,
      }
    }
    const prevKey = orderedPeriods[index - 1]
    const prev = periodActivity.get(prevKey) ?? new Set()
    const returning = [...current].filter(user => prev.has(user)).length
    const retention = prev.size === 0 ? null : Number(((returning / prev.size) * 100).toFixed(2))
    return {
      period: key,
      active_users: current.size,
      returning_users: prev.size === 0 ? null : returning,
      retention_rate: retention,
    }
  })
}

