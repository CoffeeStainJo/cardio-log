import { addDays, diffDays, today, weekStart } from './dates'
import type {
  Goals, HiitSession, ISODate, IntervalSession, Measurement, MetricType, Period, Session, SteadySession,
} from './types'
import { MACHINE_LABEL } from './types'

export const byDate = <T extends { date: ISODate }>(xs: T[]): T[] =>
  [...xs].sort((a, b) => a.date.localeCompare(b.date))

export const intervalsOf = (xs: Session[]) => xs.filter((s): s is IntervalSession => s.kind === 'interval')
export const hiitOf = (xs: Session[]) => xs.filter((s): s is HiitSession => s.kind === 'hiit')
export const steadyOf = (xs: Session[]) => xs.filter((s): s is SteadySession => s.kind === 'steady')

export const round1 = (n: number) => Math.round(n * 10) / 10

/* ---------- Speed intervals ---------- */

type Protocol = Pick<IntervalSession, 'minutes' | 'workSec' | 'restSec'>
/** Number of work bouts in an interval session. */
export const sprints = (s: Protocol) => Math.round((s.minutes * 60) / (s.workSec + s.restSec))
/** Minutes actually spent working (not resting). */
export const workMinutes = (s: Protocol) => (sprints(s) * s.workSec) / 60
/** ERG training-load score: work minutes x level. */
export const load = (s: IntervalSession) => workMinutes(s) * (s.level ?? 0)
/** Trainer: energy produced during the work bouts, in kJ. */
export const workKJ = (s: IntervalSession) => ((s.watts ?? 0) * workMinutes(s) * 60) / 1000

export const intensity = (s: Pick<IntervalSession, 'machine' | 'level' | 'watts'>) =>
  s.machine === 'trainer' ? `${s.watts ?? 0} W` : `Level ${s.level ?? 0}`
export const shortIntensity = (s: Pick<IntervalSession, 'machine' | 'level' | 'watts'>) =>
  s.machine === 'trainer' ? `${s.watts ?? 0}W` : `L${s.level ?? 0}`

/* ---------- 4×4 ---------- */

export const hiitMinutes = (rounds: number, workMin: number, restMin: number) =>
  rounds * workMin + Math.max(0, rounds - 1) * restMin

/** m:ss from seconds. */
export const fmtTime = (sec: number) => {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
/** Pace (m:ss per km) at a treadmill speed. */
export const fmtPace = (kmh: number) => (kmh > 0 ? fmtTime(3600 / kmh) : '–')
/** Seconds needed to cover a distance at a constant speed. */
export const timeFor = (km: number, kmh: number) => (km / kmh) * 3600
/** Speed needed to cover a distance in a given time. */
export const speedFor = (km: number, sec: number) => km / (sec / 3600)

/* ---------- Steady ---------- */

export const avgIncline = (s: SteadySession) =>
  s.inclineStart === undefined ? undefined : (s.inclineStart + (s.inclineEnd ?? s.inclineStart)) / 2

/* ---------- Shared ---------- */

export const describe = (s: Omit<Session, 'id' | 'date'>): string => {
  if (s.kind === 'interval') {
    const i = s as IntervalSession
    return `${intensity(i)}${i.machine === 'trainer' && i.rpm ? ` · ${i.rpm} rpm` : ''} · ${i.workSec}/${i.restSec}s`
  }
  if (s.kind === 'hiit') {
    const h = s as HiitSession
    return `${h.rounds}×${h.workMin} min · ${h.speedKmh.toFixed(1)} km/h · ${h.incline}%`
  }
  const t = s as SteadySession
  if (t.machine === 'treadmill' && t.inclineStart !== undefined) {
    const end = t.inclineEnd ?? t.inclineStart
    return end === t.inclineStart ? `${t.inclineStart}% incline` : `${t.inclineStart}→${end}% incline`
  }
  return t.level !== undefined ? `${MACHINE_LABEL[t.machine]} · level ${t.level}` : MACHINE_LABEL[t.machine]
}

export const fmtDuration = (minutes: number): string => {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

export const periodOn = (date: ISODate, periods: Period[]): Period | undefined =>
  periods.find((p) => p.start <= date && date <= p.end)

export interface WeekTotal {
  week: ISODate
  interval: number
  hiit: number
  steady: number
  sessions: number
}
export const weekMinutes = (w: WeekTotal) => w.interval + w.hiit + w.steady

/** Minutes per week from the first logged week through the current one. */
export const weeklyTotals = (sessions: Session[], now: ISODate = today()): WeekTotal[] => {
  if (!sessions.length) return []
  const first = weekStart(byDate(sessions)[0].date)
  const last = weekStart(now)
  const map = new Map<ISODate, WeekTotal>()
  for (let w = first; w <= last; w = addDays(w, 7)) map.set(w, { week: w, interval: 0, hiit: 0, steady: 0, sessions: 0 })
  for (const s of sessions) {
    const t = map.get(weekStart(s.date))
    if (!t) continue
    t[s.kind] += s.minutes
    t.sessions += 1
  }
  return [...map.values()]
}

/**
 * Consecutive weeks with at least one session, counting back from this week.
 * The current week doesn't break the streak while it's still empty, and weeks
 * that overlap a sick/deload period are skipped rather than counted as a miss.
 */
export const weekStreak = (sessions: Session[], periods: Period[], now: ISODate = today()): number => {
  const active = new Set(sessions.map((s) => weekStart(s.date)))
  const excused = (w: ISODate) => periods.some((p) => p.start <= addDays(w, 6) && p.end >= w)
  let streak = 0
  let w = weekStart(now)
  if (!active.has(w)) w = addDays(w, -7)
  for (let guard = 0; guard < 520; guard++, w = addDays(w, -7)) {
    if (active.has(w)) streak++
    else if (!excused(w)) break
  }
  return streak
}

export const daysSince = (s: Session | undefined, now: ISODate = today()) =>
  s ? diffDays(s.date, now) : undefined

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/* ---------- Body metrics & goals ---------- */

export const measurementsOf = (ms: Measurement[], type: MetricType) => byDate(ms.filter((m) => m.type === type))
export const latestOf = (ms: Measurement[], type: MetricType) => measurementsOf(ms, type).at(-1)

export const goalOf = (goals: Goals, type: MetricType) => (type === 'run3k' ? goals.run3kSec : goals[type])
/** Resting HR and 3 km time should go below the goal; VO2 max above it. */
export const goalMet = (type: MetricType, value: number, goals: Goals) =>
  type === 'vo2' ? value > goals.vo2 : value < goalOf(goals, type)

export const fmtMetric = (type: MetricType, value: number) =>
  type === 'run3k' ? fmtTime(value) : type === 'vo2' ? value.toFixed(1) : String(Math.round(value))
export const metricUnit = (type: MetricType) => (type === 'rhr' ? 'bpm' : type === 'vo2' ? '' : 'min')
export const fmtGoal = (type: MetricType, goals: Goals) =>
  `${type === 'vo2' ? 'above' : 'under'} ${fmtMetric(type, goalOf(goals, type))}`
