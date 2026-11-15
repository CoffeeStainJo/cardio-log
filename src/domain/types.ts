export type ISODate = string // YYYY-MM-DD, local time

export type Machine = 'treadmill' | 'erg' | 'bike' | 'other'
/** Where speed intervals are done: the gym ERG bike (unitless level) or the indoor trainer (watts + cadence). */
export type IntervalMachine = 'erg' | 'trainer'

export interface IntervalSession {
  id: string
  kind: 'interval'
  date: ISODate
  minutes: number
  machine: IntervalMachine
  /** ERG: speed/resistance level (unitless). */
  level?: number
  /** Trainer: target power during the work bouts. */
  watts?: number
  /** Trainer: cadence during the work bouts. */
  rpm?: number
  workSec: number
  restSec: number
  note?: string
}

/** Norwegian-style treadmill intervals (4 × 4 min by default). */
export interface HiitSession {
  id: string
  kind: 'hiit'
  date: ISODate
  /** Interval block only: work plus the rests in between (no warm-up). */
  minutes: number
  rounds: number
  workMin: number
  restMin: number
  /** Treadmill speed during the work intervals. */
  speedKmh: number
  incline: number
  note?: string
}

export interface SteadySession {
  id: string
  kind: 'steady'
  date: ISODate
  minutes: number
  machine: Machine
  /** Treadmill: incline at the start and at the end of the session, in %. */
  inclineStart?: number
  inclineEnd?: number
  /** Other machines: speed/resistance level. */
  level?: number
  note?: string
}

export type Session = IntervalSession | HiitSession | SteadySession
export type SessionKind = Session['kind']
export const KINDS: SessionKind[] = ['interval', 'hiit', 'steady']

export type PeriodKind = 'sick' | 'deload'

export interface Period {
  id: string
  kind: PeriodKind
  start: ISODate
  end: ISODate
}

export type MetricType = 'rhr' | 'vo2' | 'run3k'

export interface Measurement {
  id: string
  date: ISODate
  type: MetricType
  /** rhr: bpm · vo2: ml/kg/min · run3k: seconds */
  value: number
}

export interface Goals {
  /** Resting heart rate should be below this. */
  rhr: number
  /** VO2 max should be above this. */
  vo2: number
  /** 3 km should be run faster than this many seconds. */
  run3kSec: number
}

export const DEFAULT_GOALS: Goals = { rhr: 60, vo2: 50, run3kSec: 14 * 60 }

export interface Data {
  version: 1
  sessions: Session[]
  periods: Period[]
  measurements: Measurement[]
  goals: Goals
}

export const MACHINE_LABEL: Record<Machine, string> = {
  treadmill: 'Treadmill',
  erg: 'ERG',
  bike: 'Bike',
  other: 'Other',
}
export const INTERVAL_MACHINE_LABEL: Record<IntervalMachine, string> = { erg: 'Gym ERG', trainer: 'Indoor trainer' }

export const KIND_LABEL: Record<SessionKind, string> = { interval: 'Speed', hiit: '4×4', steady: 'Steady' }
export const PERIOD_LABEL: Record<PeriodKind, string> = { sick: 'Sick', deload: 'Deload' }
export const METRIC_LABEL: Record<MetricType, string> = { rhr: 'Resting HR', vo2: 'VO₂ max', run3k: '3 km run' }
export const METRICS: MetricType[] = ['rhr', 'vo2', 'run3k']

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
