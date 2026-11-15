import type { Data, IntervalSession, Measurement, Period, SteadySession } from './types'
import { DEFAULT_GOALS } from './types'

// History imported from the original Google Keep note.
type I = [date: string, minutes: number, level: number, work: number, rest: number]
const intervals: I[] = [
  ['2026-08-16', 10, 7, 15, 45],
  ['2026-08-19', 12, 7, 15, 45],
  ['2026-08-23', 14, 7, 15, 45],
  ['2026-08-30', 16, 7, 15, 45],
  ['2026-09-02', 12, 7, 20, 40],
  ['2026-09-02', 12, 8, 20, 40],
  ['2026-09-09', 12, 8, 20, 40],
  ['2026-09-13', 14, 8, 20, 40],
  ['2026-09-16', 14, 8, 20, 40],
  ['2026-09-23', 10, 8, 20, 40],
  ['2026-09-23', 10, 8, 20, 40],
  ['2026-10-04', 10, 7, 15, 45],
  ['2026-10-07', 12, 7, 15, 45],
  ['2026-10-11', 14, 7, 15, 45],
  ['2026-10-18', 10, 8, 15, 45],
  ['2026-10-18', 12, 8, 15, 45],
  ['2026-10-25', 14, 8, 15, 45],
  ['2026-11-04', 12, 8, 15, 45],
  ['2026-11-08', 14, 8, 15, 45],
]

type S = [date: string, minutes: number, a: number, b?: number]
const steady: S[] = [
  ['2026-08-17', 32, 15, 11],
  ['2026-08-24', 34, 15, 11],
  ['2026-08-31', 36, 15, 12],
  ['2026-09-07', 38, 15, 11],
  ['2026-09-14', 40, 15, 11],
  ['2026-10-12', 42, 15, 12],
  ['2026-10-19', 44, 15, 13],
  ['2026-10-26', 46, 15, 13],
  ['2026-10-30', 48, 7], // ERG @ speed 7
  ['2026-11-02', 50, 15, 13],
]

// The note only had <sick>/<deload> markers between entries, so these date
// ranges are inferred from the gaps around them.
const periods: Period[] = [
  { id: 'seed-p-1', kind: 'sick', start: '2026-09-17', end: '2026-09-22' },
  { id: 'seed-p-2', kind: 'deload', start: '2026-10-28', end: '2026-11-03' },
]

// Starting points given when the app was set up.
export const seedMeasurements = (): Measurement[] => [
  { id: 'seed-m-1', date: '2026-11-15', type: 'rhr', value: 61 },
  { id: 'seed-m-2', date: '2026-11-15', type: 'vo2', value: 51.4 },
]

export const seedData = (): Data => ({
  version: 1,
  sessions: [
    ...intervals.map(
      ([date, minutes, level, workSec, restSec], i): IntervalSession => ({
        id: `seed-i-${i}`, kind: 'interval', machine: 'erg', date, minutes, level, workSec, restSec,
      }),
    ),
    ...steady.map(
      ([date, minutes, a, b], i): SteadySession =>
        b === undefined
          ? { id: `seed-s-${i}`, kind: 'steady', date, minutes, machine: 'erg', level: a }
          : { id: `seed-s-${i}`, kind: 'steady', date, minutes, machine: 'treadmill', inclineStart: a, inclineEnd: b },
    ),
  ],
  periods,
  measurements: seedMeasurements(),
  goals: { ...DEFAULT_GOALS },
})
