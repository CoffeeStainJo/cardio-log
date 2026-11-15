import { useEffect, useState, type ReactNode } from 'react'
import { today } from '../domain/dates'
import { fmtPace, fmtTime, hiitMinutes, latestOf, round1, sprints, timeFor } from '../domain/stats'
import { suggestHiit, suggestInterval, suggestSteady } from '../domain/suggest'
import type {
  ISODate, IntervalMachine, Machine, Measurement, MetricType, Period, PeriodKind, Session,
} from '../domain/types'
import { INTERVAL_MACHINE_LABEL, MACHINE_LABEL, METRICS, METRIC_LABEL, PERIOD_LABEL, newId } from '../domain/types'
import { useStore } from '../store/store'

export type Mode = 'interval' | 'hiit' | 'steady' | 'body' | 'period'

const MODE_LABEL: Record<Mode, string> = { interval: 'Speed', hiit: '4×4', steady: 'Steady', body: 'Body', period: 'Time off' }

export interface SheetInit {
  mode: Mode
  date?: ISODate
  session?: Session
  period?: Period
  measurement?: Measurement
  metric?: MetricType
  /** Prefill for a new session (e.g. from a suggestion). */
  values?: Partial<Session>
}

function Stepper(p: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; max?: number; unit?: string; format?: (v: number) => string
}) {
  const { step = 1, min = 0, max = 999 } = p
  const set = (v: number) => p.onChange(Math.max(min, Math.min(max, +v.toFixed(2))))
  return (
    <div className="stepper">
      <span className="field-label">{p.label}</span>
      <div className="stepper-ctl">
        <button type="button" aria-label={`Decrease ${p.label}`} onClick={() => set(p.value - step)}>−</button>
        <output>{p.format ? p.format(p.value) : p.value}{p.unit && <small> {p.unit}</small>}</output>
        <button type="button" aria-label={`Increase ${p.label}`} onClick={() => set(p.value + step)}>+</button>
      </div>
    </div>
  )
}

function Chips<T extends string>(p: { options: [T, ReactNode][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="radiogroup" aria-label={p.label}>
      {p.options.map(([v, text]) => (
        <button type="button" key={v} role="radio" aria-checked={v === p.value}
          className={v === p.value ? 'chip on' : 'chip'} onClick={() => p.onChange(v)}>{text}</button>
      ))}
    </div>
  )
}

const PROTOCOLS: [number, number][] = [[15, 45], [20, 40], [30, 30]]
const METRIC_DEFAULT: Record<MetricType, number> = { rhr: 60, vo2: 50, run3k: 14 * 60 }
const one = (v: number) => v.toFixed(1)

export function LogSheet({ init, onClose }: { init: SheetInit; onClose: () => void }) {
  const { data, saveSession, deleteSession, savePeriod, deletePeriod, saveMeasurement, deleteMeasurement } = useStore()
  const editing = init.session ?? init.period ?? init.measurement
  const [mode, setMode] = useState<Mode>(init.mode)
  const [date, setDate] = useState<ISODate>(init.session?.date ?? init.measurement?.date ?? init.date ?? today())
  const [note, setNote] = useState(init.session?.note ?? '')
  // Values handed in for one session type only apply to that type's form.
  const given = (kind: Session['kind']) =>
    init.session?.kind === kind ? init.session : init.mode === kind ? init.values : undefined

  const [iv, setIv] = useState(() => ({
    level: 7, watts: 200, rpm: 90,
    ...suggestInterval(data.sessions, data.periods).values,
    ...(given('interval') as object),
  }))
  const [hi, setHi] = useState(() => ({ ...suggestHiit(data.sessions, data.periods).values, ...(given('hiit') as object) }))
  const [st, setSt] = useState(() => ({
    inclineStart: 15, inclineEnd: 12, level: 7,
    ...suggestSteady(data.sessions, data.periods).values,
    ...(given('steady') as object),
  }))
  const [pd, setPd] = useState(() => ({
    kind: (init.period?.kind ?? 'sick') as PeriodKind,
    start: init.period?.start ?? init.date ?? today(),
    end: init.period?.end ?? init.date ?? today(),
  }))
  const lastValue = (type: MetricType) => latestOf(data.measurements, type)?.value ?? METRIC_DEFAULT[type]
  const [body, setBody] = useState(() => {
    const type = init.measurement?.type ?? init.metric ?? 'rhr'
    return { type, value: init.measurement?.value ?? lastValue(type) }
  })
  const [custom, setCustom] = useState(!PROTOCOLS.some(([w, r]) => w === iv.workSec && r === iv.restSec))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setMachine = (machine: IntervalMachine) => {
    // For a new entry, pick up where you left off on that machine.
    const next = editing ? {} : suggestInterval(data.sessions, data.periods, today(), machine).values
    setIv({ ...iv, ...next, machine })
  }

  const save = () => {
    const id = editing?.id ?? newId()
    const n = note.trim() || undefined
    if (mode === 'interval') {
      const common = { id, kind: 'interval' as const, date, minutes: iv.minutes, workSec: iv.workSec, restSec: iv.restSec, note: n }
      saveSession(iv.machine === 'trainer'
        ? { ...common, machine: 'trainer', watts: iv.watts, rpm: iv.rpm }
        : { ...common, machine: 'erg', level: iv.level })
    } else if (mode === 'hiit') {
      saveSession({
        id, kind: 'hiit', date, rounds: hi.rounds, workMin: hi.workMin, restMin: hi.restMin,
        minutes: hiitMinutes(hi.rounds, hi.workMin, hi.restMin), speedKmh: hi.speedKmh, incline: hi.incline, note: n,
      })
    } else if (mode === 'steady') {
      const common = { id, kind: 'steady' as const, date, minutes: st.minutes, machine: st.machine, note: n }
      saveSession(st.machine === 'treadmill'
        ? { ...common, inclineStart: st.inclineStart, inclineEnd: st.inclineEnd }
        : { ...common, level: st.level })
    } else if (mode === 'body') {
      saveMeasurement({ id, date, type: body.type, value: body.value })
    } else {
      const [start, end] = pd.start <= pd.end ? [pd.start, pd.end] : [pd.end, pd.start]
      savePeriod({ id, kind: pd.kind, start, end })
    }
    onClose()
  }

  const remove = () => {
    if (!editing || !confirm('Delete this entry?')) return
    if (init.period) deletePeriod(editing.id)
    else if (init.measurement) deleteMeasurement(editing.id)
    else deleteSession(editing.id)
    onClose()
  }

  const title = editing ? 'Edit entry' : 'Log'
  const proto = `${iv.workSec}/${iv.restSec}`

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet mode-${mode}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="text-btn" onClick={onClose}>Cancel</button>
        </div>

        {!editing && (
          <div className="segmented five" role="tablist">
            {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
              <button type="button" key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        )}

        <div className="sheet-body">
          {mode !== 'period' && (
            <label className="field">
              <span className="field-label">Date</span>
              <input type="date" value={date} max="2099-12-31" onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
          )}

          {mode === 'interval' && (
            <>
              <div className="field col">
                <span className="field-label">Bike</span>
                <Chips label="Bike" value={iv.machine} onChange={setMachine}
                  options={(['erg', 'trainer'] as IntervalMachine[]).map((m) => [m, INTERVAL_MACHINE_LABEL[m]])} />
              </div>
              <Stepper label="Duration" unit="min" value={iv.minutes} min={1} max={120} onChange={(minutes) => setIv({ ...iv, minutes })} />
              {iv.machine === 'trainer' ? (
                <>
                  <Stepper label="Power" unit="W" step={5} min={50} max={2000} value={iv.watts} onChange={(watts) => setIv({ ...iv, watts })} />
                  <Stepper label="Cadence" unit="rpm" step={5} min={30} max={200} value={iv.rpm} onChange={(rpm) => setIv({ ...iv, rpm })} />
                </>
              ) : (
                <Stepper label="Level" value={iv.level} min={1} max={30} onChange={(level) => setIv({ ...iv, level })} />
              )}
              <div className="field col">
                <span className="field-label">Work / rest <small>seconds</small></span>
                <Chips label="Work / rest" value={custom ? 'custom' : proto}
                  options={[...PROTOCOLS.map(([w, r]) => [`${w}/${r}`, `${w} / ${r}`] as [string, string]), ['custom', 'Custom']]}
                  onChange={(v) => {
                    if (v === 'custom') return setCustom(true)
                    const [workSec, restSec] = v.split('/').map(Number)
                    setCustom(false)
                    setIv({ ...iv, workSec, restSec })
                  }} />
              </div>
              {custom && (
                <>
                  <Stepper label="Work" unit="s" step={5} min={5} max={600} value={iv.workSec} onChange={(workSec) => setIv({ ...iv, workSec })} />
                  <Stepper label="Rest" unit="s" step={5} min={0} max={600} value={iv.restSec} onChange={(restSec) => setIv({ ...iv, restSec })} />
                </>
              )}
              <p className="hint">{sprints(iv)} sprints of {iv.workSec}s</p>
            </>
          )}

          {mode === 'hiit' && (
            <>
              <Stepper label="Interval speed" unit="km/h" step={0.1} min={4} max={25} format={one}
                value={hi.speedKmh} onChange={(speedKmh) => setHi({ ...hi, speedKmh })} />
              <Stepper label="Incline" unit="%" step={0.5} max={20} value={hi.incline} onChange={(incline) => setHi({ ...hi, incline })} />
              <Stepper label="Rounds" value={hi.rounds} min={1} max={12} onChange={(rounds) => setHi({ ...hi, rounds })} />
              <Stepper label="Work" unit="min" value={hi.workMin} min={1} max={15} onChange={(workMin) => setHi({ ...hi, workMin })} />
              <Stepper label="Rest" unit="min" value={hi.restMin} min={0} max={15} onChange={(restMin) => setHi({ ...hi, restMin })} />
              <p className="hint">
                {fmtPace(hi.speedKmh)} /km · {round1((hi.speedKmh * hi.workMin) / 60)} km per interval ·
                3 km at this speed takes {fmtTime(timeFor(3, hi.speedKmh))}
              </p>
            </>
          )}

          {mode === 'steady' && (
            <>
              <Stepper label="Duration" unit="min" value={st.minutes} min={1} max={300} onChange={(minutes) => setSt({ ...st, minutes })} />
              <div className="field col">
                <span className="field-label">Machine</span>
                <Chips label="Machine" value={st.machine} onChange={(machine: Machine) => setSt({ ...st, machine })}
                  options={(Object.keys(MACHINE_LABEL) as Machine[]).map((m) => [m, MACHINE_LABEL[m]])} />
              </div>
              {st.machine === 'treadmill' ? (
                <>
                  <Stepper label="Incline at start" unit="%" value={st.inclineStart} max={40} onChange={(inclineStart) => setSt({ ...st, inclineStart })} />
                  <Stepper label="Incline at end" unit="%" value={st.inclineEnd} max={40} onChange={(inclineEnd) => setSt({ ...st, inclineEnd })} />
                </>
              ) : (
                <Stepper label="Speed / level" value={st.level} max={40} onChange={(level) => setSt({ ...st, level })} />
              )}
            </>
          )}

          {mode === 'body' && (
            <>
              {!editing && (
                <div className="field col">
                  <span className="field-label">Measurement</span>
                  <Chips label="Measurement" value={body.type} onChange={(type: MetricType) => setBody({ type, value: lastValue(type) })}
                    options={METRICS.map((m) => [m, METRIC_LABEL[m]])} />
                </div>
              )}
              {body.type === 'rhr' && (
                <Stepper label="Resting heart rate" unit="bpm" min={25} max={150} value={body.value} onChange={(value) => setBody({ ...body, value })} />
              )}
              {body.type === 'vo2' && (
                <Stepper label="VO₂ max" step={0.1} min={10} max={99} format={one} value={body.value} onChange={(value) => setBody({ ...body, value })} />
              )}
              {body.type === 'run3k' && (
                <>
                  <Stepper label="Minutes" unit="min" min={5} max={60} value={Math.floor(body.value / 60)}
                    onChange={(m) => setBody({ ...body, value: m * 60 + (body.value % 60) })} />
                  <Stepper label="Seconds" unit="s" min={0} max={59} value={body.value % 60}
                    onChange={(s) => setBody({ ...body, value: Math.floor(body.value / 60) * 60 + s })} />
                  <p className="hint">3 km in {fmtTime(body.value)} · {fmtTime(body.value / 3)} /km</p>
                </>
              )}
            </>
          )}

          {mode === 'period' && (
            <>
              <div className="field col">
                <span className="field-label">Type</span>
                <Chips label="Type" value={pd.kind} onChange={(kind: PeriodKind) => setPd({ ...pd, kind })}
                  options={(['sick', 'deload'] as PeriodKind[]).map((k) => [k, PERIOD_LABEL[k]])} />
              </div>
              <label className="field">
                <span className="field-label">From</span>
                <input type="date" value={pd.start} onChange={(e) => e.target.value && setPd({ ...pd, start: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">To</span>
                <input type="date" value={pd.end} onChange={(e) => e.target.value && setPd({ ...pd, end: e.target.value })} />
              </label>
              <p className="hint">Shown on the calendar and charts. Doesn't break your streak.</p>
            </>
          )}

          {mode !== 'period' && mode !== 'body' && (
            <label className="field col">
              <span className="field-label">Note <small>optional</small></span>
              <input type="text" value={note} placeholder="How did it feel?" onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
        </div>

        <div className="sheet-foot">
          {editing && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
          <button type="button" className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
