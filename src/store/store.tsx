import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { seedData, seedMeasurements } from '../domain/seed'
import { DEFAULT_GOALS, type Data, type Goals, type Measurement, type Period, type Session } from '../domain/types'

const KEY = 'cardio-log:v1'

/** Validates a stored/imported blob and fills in anything added since it was written. */
export const parseData = (raw: unknown): Data => {
  const d = raw as Partial<Data> | null
  if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.periods)) throw new Error('Not a Cardio Log backup file')
  const okDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  const sessions = d.sessions
    .filter(
      (s) => s && typeof s.id === 'string' && okDate(s.date) && typeof s.minutes === 'number' &&
        (s.kind === 'interval' || s.kind === 'steady' || s.kind === 'hiit'),
    )
    // Speed sessions logged before the trainer existed were all on the gym ERG.
    .map((s): Session => (s.kind === 'interval' && !s.machine ? { ...(s as Session), machine: 'erg' } as Session : s))
  const periods = d.periods.filter(
    (p) => p && typeof p.id === 'string' && okDate(p.start) && okDate(p.end) && (p.kind === 'sick' || p.kind === 'deload'),
  )
  const measurements = Array.isArray(d.measurements)
    ? d.measurements.filter(
        (m) => m && typeof m.id === 'string' && okDate(m.date) && typeof m.value === 'number' &&
          (m.type === 'rhr' || m.type === 'vo2' || m.type === 'run3k'),
      )
    : seedMeasurements()
  return { version: 1, sessions, periods, measurements, goals: { ...DEFAULT_GOALS, ...d.goals } }
}

const load = (): Data => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return parseData(JSON.parse(raw))
  } catch {
    // fall through to seed
  }
  return seedData()
}

interface Store {
  data: Data
  saveSession: (s: Session) => void
  deleteSession: (id: string) => void
  savePeriod: (p: Period) => void
  deletePeriod: (id: string) => void
  saveMeasurement: (m: Measurement) => void
  deleteMeasurement: (id: string) => void
  setGoals: (g: Goals) => void
  replaceAll: (d: Data) => void
}

const Ctx = createContext<Store | null>(null)

const upsert = <T extends { id: string }>(xs: T[], x: T) =>
  xs.some((y) => y.id === x.id) ? xs.map((y) => (y.id === x.id ? x : y)) : [...xs, x]
const without = <T extends { id: string }>(xs: T[], id: string) => xs.filter((x) => x.id !== id)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // storage unavailable (private mode) — keep working in memory
    }
  }, [data])

  // Ask iOS/Safari not to evict our storage.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {})
  }, [])

  const saveSession = useCallback((s: Session) => setData((d) => ({ ...d, sessions: upsert(d.sessions, s) })), [])
  const deleteSession = useCallback((id: string) => setData((d) => ({ ...d, sessions: without(d.sessions, id) })), [])
  const savePeriod = useCallback((p: Period) => setData((d) => ({ ...d, periods: upsert(d.periods, p) })), [])
  const deletePeriod = useCallback((id: string) => setData((d) => ({ ...d, periods: without(d.periods, id) })), [])
  const saveMeasurement = useCallback(
    (m: Measurement) => setData((d) => ({ ...d, measurements: upsert(d.measurements, m) })), [])
  const deleteMeasurement = useCallback(
    (id: string) => setData((d) => ({ ...d, measurements: without(d.measurements, id) })), [])
  const setGoals = useCallback((goals: Goals) => setData((d) => ({ ...d, goals })), [])
  const replaceAll = useCallback((d: Data) => setData(d), [])

  const value = useMemo(
    () => ({ data, saveSession, deleteSession, savePeriod, deletePeriod, saveMeasurement, deleteMeasurement, setGoals, replaceAll }),
    [data, saveSession, deleteSession, savePeriod, deletePeriod, saveMeasurement, deleteMeasurement, setGoals, replaceAll],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = (): Store => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
