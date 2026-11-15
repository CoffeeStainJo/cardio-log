import { diffDays, today } from './dates'
import { byDate, hiitMinutes, hiitOf, intervalsOf, round1, steadyOf } from './stats'
import type { HiitSession, ISODate, IntervalMachine, IntervalSession, Period, Session, SteadySession } from './types'

export interface Suggestion<T> {
  /** Ready-to-log values (no id/date yet). */
  values: Omit<T, 'id' | 'date'>
  reason: string
}

const BASE_MINUTES = 10
const TOP_MINUTES = 14 // reaching this at one intensity means it's time to step up
const STEP = 2
const WATT_STEP = 10

const sickSince = (date: ISODate, periods: Period[]) =>
  periods.some((p) => p.kind === 'sick' && p.end >= date)

/**
 * Speed progression: add 2 minutes per session until 14, then step up the
 * intensity (one ERG level, or 10 W on the trainer) and restart at 10.
 * After illness or a long break, ease back in at 10.
 * Follows the machine you used last unless one is given.
 */
export const suggestInterval = (
  sessions: Session[],
  periods: Period[],
  now: ISODate = today(),
  machine?: IntervalMachine,
): Suggestion<IntervalSession> => {
  const all = byDate(intervalsOf(sessions))
  const last = machine ? all.filter((s) => s.machine === machine).at(-1) : all.at(-1)
  if (!last) {
    // No history on this machine: keep the usual work/rest protocol, start easy.
    const { workSec = 15, restSec = 45 } = all.at(-1) ?? {}
    const base = { kind: 'interval' as const, minutes: BASE_MINUTES, workSec, restSec }
    return machine === 'trainer'
      ? { values: { ...base, machine: 'trainer', watts: 200, rpm: 90 }, reason: 'First trainer session — set watts and cadence to taste.' }
      : { values: { ...base, machine: 'erg', level: 7 }, reason: 'A gentle place to start.' }
  }
  const { workSec, restSec } = last
  const trainer = last.machine === 'trainer'
  const same = trainer
    ? { machine: 'trainer' as const, watts: last.watts ?? 200, rpm: last.rpm ?? 90 }
    : { machine: 'erg' as const, level: last.level ?? 7 }
  const base = { kind: 'interval' as const, workSec, restSec }
  const at = trainer ? `${same.watts} W` : `level ${same.level}`
  const gap = diffDays(last.date, now)
  if (sickSince(last.date, periods)) {
    return { values: { ...base, ...same, minutes: BASE_MINUTES }, reason: `Back from being sick — ease in at ${at}.` }
  }
  if (gap >= 14) {
    return { values: { ...base, ...same, minutes: BASE_MINUTES }, reason: `${gap} days since your last one — ease back in.` }
  }
  if (last.minutes >= TOP_MINUTES) {
    const up = trainer ? { ...same, watts: same.watts! + WATT_STEP } : { ...same, level: same.level! + 1 }
    return {
      values: { ...base, ...up, minutes: BASE_MINUTES },
      reason: `You did ${last.minutes} min at ${at} — time to ${trainer ? `add ${WATT_STEP} W` : 'level up'}.`,
    }
  }
  return { values: { ...base, ...same, minutes: last.minutes + STEP }, reason: `+${STEP} min on last time at ${at}.` }
}

/** 4×4: same structure as last time, nudging the treadmill up 0.1 km/h. */
export const suggestHiit = (sessions: Session[], periods: Period[], now: ISODate = today()): Suggestion<HiitSession> => {
  const last = byDate(hiitOf(sessions)).at(-1)
  if (!last) {
    return {
      values: { kind: 'hiit', rounds: 4, workMin: 4, restMin: 3, minutes: hiitMinutes(4, 4, 3), speedKmh: 13, incline: 1 },
      reason: '4 min hard, 3 min easy, four times.',
    }
  }
  const { id: _id, date: _date, note: _note, ...setup } = last
  const gap = diffDays(last.date, now)
  if (sickSince(last.date, periods) || gap >= 21) {
    return { values: setup, reason: gap >= 21 ? `${gap} days since your last one — repeat it first.` : 'Back from being sick — repeat your last session.' }
  }
  return { values: { ...setup, speedKmh: round1(last.speedKmh + 0.1) }, reason: '+0.1 km/h on last time.' }
}

/** Steady progression: same setup as last time, 2 minutes longer. */
export const suggestSteady = (
  sessions: Session[],
  periods: Period[],
  now: ISODate = today(),
): Suggestion<SteadySession> => {
  const all = byDate(steadyOf(sessions))
  const last = all.at(-1)
  if (!last) {
    return {
      values: { kind: 'steady', minutes: 30, machine: 'treadmill', inclineStart: 12, inclineEnd: 10 },
      reason: 'A gentle place to start.',
    }
  }
  // Keep the usual setup (most recent treadmill session) but progress from the latest duration.
  const template = [...all].reverse().find((s) => s.machine === 'treadmill') ?? last
  const { id: _id, date: _date, note: _note, ...setup } = template
  const gap = diffDays(last.date, now)
  if (sickSince(last.date, periods) || gap >= 21) {
    return {
      values: { ...setup, minutes: last.minutes },
      reason: gap >= 21 ? `${gap} days since your last one — repeat it first.` : 'Back from being sick — repeat your last session.',
    }
  }
  return { values: { ...setup, minutes: last.minutes + STEP }, reason: `+${STEP} min on last time.` }
}
