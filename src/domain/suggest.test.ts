import { describe, expect, it } from 'vitest'
import { seedData } from './seed'
import { fmtPace, fmtTime, goalMet, speedFor, sprints, timeFor, weekStreak, weeklyTotals, workMinutes } from './stats'
import { suggestHiit, suggestInterval, suggestSteady } from './suggest'
import { DEFAULT_GOALS, type IntervalSession, type Session } from './types'

const { sessions, periods } = seedData()

describe('suggestions', () => {
  it('levels up after 14 minutes', () => {
    const s = suggestInterval(sessions, periods, '2026-11-15')
    expect(s.values).toMatchObject({ machine: 'erg', level: 9, minutes: 10, workSec: 15, restSec: 45 })
  })
  it('adds two minutes below the top', () => {
    const upTo = sessions.filter((x) => x.date <= '2026-11-04')
    expect(suggestInterval(upTo, periods, '2026-11-06').values).toMatchObject({ level: 8, minutes: 14 })
  })
  it('eases back in after a long break', () => {
    expect(suggestInterval(sessions, periods, '2026-12-20').values).toMatchObject({ level: 8, minutes: 10 })
  })
  it('starts the trainer with the usual protocol', () => {
    expect(suggestInterval(sessions, periods, '2026-11-15', 'trainer').values).toMatchObject({
      machine: 'trainer', minutes: 10, workSec: 15, restSec: 45,
    })
  })
  it('progresses the trainer in minutes, then watts', () => {
    const t = (date: string, minutes: number): Session => ({
      id: date, kind: 'interval', machine: 'trainer', date, minutes, watts: 300, rpm: 100, workSec: 15, restSec: 45,
    })
    expect(suggestInterval([...sessions, t('2026-11-16', 12)], periods, '2026-11-18').values)
      .toMatchObject({ machine: 'trainer', watts: 300, rpm: 100, minutes: 14 })
    expect(suggestInterval([...sessions, t('2026-11-16', 14)], periods, '2026-11-18').values)
      .toMatchObject({ machine: 'trainer', watts: 310, minutes: 10 })
  })
  it('adds two minutes to steady with the treadmill setup', () => {
    expect(suggestSteady(sessions, periods, '2026-11-08').values).toMatchObject({
      minutes: 52, machine: 'treadmill', inclineStart: 15, inclineEnd: 13,
    })
  })
  it('suggests a classic 4x4 first, then nudges speed', () => {
    expect(suggestHiit(sessions, periods, '2026-11-15').values).toMatchObject({ rounds: 4, workMin: 4, restMin: 3, minutes: 25 })
    const h: Session = { id: 'h', kind: 'hiit', date: '2026-11-10', minutes: 25, rounds: 4, workMin: 4, restMin: 3, speedKmh: 13.2, incline: 1 }
    expect(suggestHiit([h], periods, '2026-11-15').values.speedKmh).toBe(13.3)
  })
})

describe('stats', () => {
  it('counts sprints and work time', () => {
    const s = sessions[0] as IntervalSession // 10 min, 15/45
    expect(sprints(s)).toBe(10)
    expect(workMinutes(s)).toBe(2.5)
  })
  it('builds contiguous weeks', () => {
    const w = weeklyTotals(sessions, '2026-11-15')
    expect(w[0].week).toBe('2026-08-10')
    expect(w.at(-1)!.week).toBe('2026-11-09')
    expect(w).toHaveLength(14)
  })
  it('streak skips excused weeks', () => {
    expect(weekStreak(sessions, periods, '2026-11-15')).toBeGreaterThan(5)
  })
  it('converts speed, pace and time', () => {
    expect(fmtPace(13.333333)).toBe('4:30')
    expect(fmtTime(timeFor(3, 13.333333))).toBe('13:30')
    expect(speedFor(3, 14 * 60)).toBeCloseTo(12.857, 2)
  })
  it('judges goals in the right direction', () => {
    expect(goalMet('rhr', 61, DEFAULT_GOALS)).toBe(false)
    expect(goalMet('rhr', 59, DEFAULT_GOALS)).toBe(true)
    expect(goalMet('vo2', 51.4, DEFAULT_GOALS)).toBe(true)
    expect(goalMet('run3k', 13 * 60 + 50, DEFAULT_GOALS)).toBe(true)
  })
})
