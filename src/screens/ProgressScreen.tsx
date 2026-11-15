import { useState } from 'react'
import type { OpenSheet } from '../App'
import { GoalTiles } from '../components/Goals'
import { PlusIcon } from '../components/Icons'
import { TimeChart, WeeklyBars, type Pt } from '../components/charts'
import { fmtShort, fromISO } from '../domain/dates'
import {
  avgIncline, byDate, describe, fmtDuration, fmtGoal, fmtMetric, fmtPace, fmtTime, goalMet, goalOf, hiitOf, intensity, intervalsOf,
  load, measurementsOf, metricUnit, round1, shortIntensity, speedFor, sprints, steadyOf, sum, timeFor, weekMinutes,
  weekStreak, weeklyTotals, workKJ, workMinutes,
} from '../domain/stats'
import { MACHINE_LABEL, METRICS, METRIC_LABEL, type Data } from '../domain/types'
import { useStore } from '../store/store'

type View = 'overview' | 'interval' | 'hiit' | 'steady' | 'body'
const VIEWS: [View, string][] = [['overview', 'Overview'], ['interval', 'Speed'], ['hiit', '4×4'], ['steady', 'Steady'], ['body', 'Body']]

const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="tile">
    <span className="label">{label}</span>
    <b>{value}</b>
    {sub && <span className="sub">{sub}</span>}
  </div>
)

const cssVar = (name: string) => `var(--${name})`

export function ProgressScreen({ open }: { open: OpenSheet }) {
  const { data } = useStore()
  const [view, setView] = useState<View>('overview')
  const all = data.sessions

  return (
    <div className="screen">
      <header className="top">
        <p className="eyebrow">{all.length} sessions · {fmtDuration(sum(all.map((s) => s.minutes)))} total</p>
        <h1>Progress</h1>
      </header>

      <div className="segmented five" role="tablist">
        {VIEWS.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>
        ))}
      </div>

      {view === 'overview' && <Overview data={data} />}
      {view === 'interval' && <Speed data={data} />}
      {view === 'hiit' && <Hiit data={data} />}
      {view === 'steady' && <Steady data={data} />}
      {view === 'body' && <Body data={data} open={open} />}
    </div>
  )
}

function Overview({ data }: { data: Data }) {
  const weeks = weeklyTotals(data.sessions)
  const active = weeks.filter((w) => w.sessions > 0)
  const best = weeks.reduce<typeof weeks[number] | undefined>((a, b) => (!a || weekMinutes(b) > weekMinutes(a) ? b : a), undefined)
  const perDay = [0, 0, 0, 0, 0, 0, 0]
  for (const s of data.sessions) perDay[(fromISO(s.date).getDay() + 6) % 7]++
  const maxDay = Math.max(1, ...perDay)

  return (
    <>
      <div className="tiles">
        <Tile label="Week streak" value={weekStreak(data.sessions, data.periods)} sub="sick & deload excused" />
        <Tile label="Per active week" value={active.length ? round1(sum(active.map((w) => w.sessions)) / active.length) : '–'} sub="sessions" />
        <Tile label="Avg week" value={active.length ? `${Math.round(sum(active.map(weekMinutes)) / active.length)} min` : '–'} />
        <Tile label="Biggest week" value={best ? `${weekMinutes(best)} min` : '–'} sub={best && `from ${fmtShort(best.week)}`} />
      </div>
      <section className="card">
        <h3>Weekly minutes</h3>
        <WeeklyBars weeks={weeks.slice(-20)} />
      </section>
      <section className="card">
        <h3>Favourite days</h3>
        <p className="card-sub">Sessions by day of the week.</p>
        <div className="dow">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
            <div key={d}>
              <b>{perDay[i] || ''}</b>
              <i style={{ height: `${(perDay[i] / maxDay) * 100}%` }} />
              <span>{d}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function Speed({ data }: { data: Data }) {
  const iv = byDate(intervalsOf(data.sessions))
  const erg = iv.filter((s) => s.machine === 'erg')
  const trainer = iv.filter((s) => s.machine === 'trainer')
  const onTrainer = iv.at(-1)?.machine === 'trainer'

  const pts: Pt[] = iv.map((s, i) => ({
    date: s.date, y: s.minutes,
    label: i === 0 || shortIntensity(iv[i - 1]) !== shortIntensity(s) ? shortIntensity(s) : undefined,
    value: `${s.minutes} min`, detail: describe(s),
  }))
  const loadPts: Pt[] = erg.map((s) => ({
    date: s.date, y: round1(load(s)),
    value: `${round1(load(s))} load`, detail: `${round1(workMinutes(s))} work min × level ${s.level}`,
  }))
  const powerPts: Pt[] = trainer.map((s) => ({
    date: s.date, y: s.watts ?? 0,
    value: `${s.watts} W`, detail: `${s.rpm} rpm · ${s.minutes} min · ${Math.round(workKJ(s))} kJ of sprinting`,
  }))
  // Best session at each intensity: the one with the most work time.
  const groups = new Map<string, typeof iv>()
  for (const s of iv) groups.set(intensity(s), [...(groups.get(intensity(s)) ?? []), s])
  const bests = [...groups].map(([key, xs]) => [key, xs.reduce((a, b) => (workMinutes(b) > workMinutes(a) ? b : a))] as const).reverse()

  return (
    <>
      <div className="tiles">
        <Tile label="Sessions" value={iv.length} sub={trainer.length ? `${erg.length} ERG · ${trainer.length} trainer` : undefined} />
        {onTrainer
          ? <Tile label="Top power" value={`${Math.max(...trainer.map((s) => s.watts ?? 0))} W`} sub="indoor trainer" />
          : <Tile label="Top level" value={erg.length ? Math.max(...erg.map((s) => s.level ?? 0)) : '–'} sub="gym ERG" />}
        <Tile label="Sprints" value={sum(iv.map(sprints))} sub="all time" />
        <Tile label="Hard work" value={fmtDuration(sum(iv.map(workMinutes)))} sub="excluding rest" />
      </div>
      <section className="card">
        <h3>Session length</h3>
        <p className="card-sub">Minutes per session. Labels mark a change of level or power.</p>
        <TimeChart points={pts} periods={data.periods} color={cssVar('speed')} ariaLabel="Speed session length over time" />
      </section>
      {trainer.length > 0 && (
        <section className="card">
          <h3>Sprint power <small>indoor trainer</small></h3>
          <p className="card-sub">Target watts during the work bouts.</p>
          <TimeChart points={powerPts} periods={data.periods} color={cssVar('speed')} ariaLabel="Trainer sprint power over time" />
        </section>
      )}
      {erg.length > 0 && (
        <section className="card">
          <h3>Training load <small>gym ERG</small></h3>
          <p className="card-sub">Work minutes × level — rises with longer sprints, more of them, or a higher level.</p>
          <TimeChart points={loadPts} periods={data.periods} color={cssVar('speed')} ariaLabel="ERG training load over time" />
        </section>
      )}
      <section className="card">
        <h3>Best at each intensity</h3>
        <table className="table">
          <thead><tr><th>Intensity</th><th>Best</th><th>Protocol</th><th>When</th></tr></thead>
          <tbody>
            {bests.map(([key, best]) => (
              <tr key={key}>
                <td><b>{key}</b></td><td>{best.minutes} min</td><td>{best.workSec}/{best.restSec}s</td><td>{fmtShort(best.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

function Hiit({ data }: { data: Data }) {
  const hi = byDate(hiitOf(data.sessions))
  const goalSec = data.goals.run3kSec
  const goalSpeed = speedFor(3, goalSec)
  const top = hi.length ? Math.max(...hi.map((s) => s.speedKmh)) : undefined
  const last = hi.at(-1)
  const pts: Pt[] = hi.map((s) => ({
    date: s.date, y: s.speedKmh,
    value: `${s.speedKmh.toFixed(1)} km/h`, detail: `${fmtPace(s.speedKmh)} /km · ${s.rounds}×${s.workMin} min · ${s.incline}%`,
  }))

  return (
    <>
      <div className="tiles">
        <Tile label="Sessions" value={hi.length} />
        <Tile label="Top speed" value={top ? `${top.toFixed(1)} km/h` : '–'} sub={top ? `${fmtPace(top)} /km` : undefined} />
        <Tile label="Latest pace" value={last ? fmtPace(last.speedKmh) : '–'} sub={last ? `per km · ${fmtShort(last.date)}` : 'per km'} />
        <Tile label="3 km at that pace" value={last ? fmtTime(timeFor(3, last.speedKmh)) : '–'} sub={`goal under ${fmtTime(goalSec)}`} />
      </div>
      <section className="card">
        <h3>Interval speed</h3>
        <p className="card-sub">
          Treadmill speed in the work intervals. The line is the pace a {fmtTime(goalSec)} 3 km needs:
          {' '}{goalSpeed.toFixed(1)} km/h, {fmtPace(goalSpeed)} /km.
        </p>
        <TimeChart points={pts} periods={data.periods} color={cssVar('hiit')}
          goal={{ value: round1(goalSpeed), label: `3 km in ${fmtTime(goalSec)}` }} ariaLabel="4×4 interval speed over time" />
      </section>
      <section className="card">
        <h3>Pace table</h3>
        <p className="card-sub">What treadmill speeds mean over 3 km.</p>
        <table className="table pace">
          <thead><tr><th>Speed</th><th>Pace</th><th>3 km</th><th>4 min covers</th></tr></thead>
          <tbody>
            {[12, 12.5, 12.9, 13.3, 13.6, 14].map((v) => (
              <tr key={v} className={timeFor(3, v) < goalSec ? 'hit' : ''}>
                <td><b>{v.toFixed(1)}</b></td><td>{fmtPace(v)} /km</td><td>{fmtTime(timeFor(3, v))}</td><td>{Math.round((v * 4000) / 60)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Highlighted rows beat the {fmtTime(goalSec)} goal.</p>
      </section>
    </>
  )
}

function Steady({ data }: { data: Data }) {
  const st = byDate(steadyOf(data.sessions))
  const longest = st.reduce<typeof st[number] | undefined>((a, b) => (!a || b.minutes > a.minutes ? b : a), undefined)
  const tread = st.filter((s) => s.machine === 'treadmill' && s.inclineStart !== undefined)
  const durPts: Pt[] = st.map((s) => ({
    date: s.date, y: s.minutes, value: `${s.minutes} min`, detail: describe(s),
    label: s.machine !== 'treadmill' ? MACHINE_LABEL[s.machine] : undefined,
  }))
  const incPts: Pt[] = tread.map((s) => {
    const a = s.inclineStart!, b = s.inclineEnd ?? a
    return { date: s.date, y: Math.max(a, b), y0: Math.min(a, b), value: `${a}→${b}%`, detail: `avg ${round1(avgIncline(s)!)}% · ${s.minutes} min` }
  })
  const first = st[0], last = st.at(-1)
  return (
    <>
      <div className="tiles">
        <Tile label="Sessions" value={st.length} />
        <Tile label="Longest" value={longest ? `${longest.minutes} min` : '–'} sub={longest && fmtShort(longest.date)} />
        <Tile label="Total time" value={fmtDuration(sum(st.map((s) => s.minutes)))} />
        <Tile label="Since start" value={first && last ? `+${last.minutes - first.minutes} min` : '–'} sub="per session" />
      </div>
      <section className="card">
        <h3>Session length</h3>
        <p className="card-sub">Minutes per session.</p>
        <TimeChart points={durPts} periods={data.periods} color={cssVar('steady')} labelBelow ariaLabel="Steady session length over time" />
      </section>
      <section className="card">
        <h3>Treadmill incline</h3>
        <p className="card-sub">Each bar spans the start and end incline. Shorter bars mean you held the hill longer.</p>
        <TimeChart points={incPts} periods={data.periods} color={cssVar('steady')} range ariaLabel="Treadmill incline range per session" />
      </section>
    </>
  )
}

function Body({ data, open }: { data: Data; open: OpenSheet }) {
  return (
    <>
      <GoalTiles open={open} />
      {METRICS.map((type) => {
        const ms = measurementsOf(data.measurements, type)
        const unit = metricUnit(type)
        const pts: Pt[] = ms.map((m) => ({
          date: m.date, y: type === 'run3k' ? round1(m.value / 60) : m.value,
          value: `${fmtMetric(type, m.value)}${unit ? ` ${unit}` : ''}`, detail: goalMet(type, m.value, data.goals) ? 'goal met' : `goal ${fmtGoal(type, data.goals)}`,
        }))
        const goal = goalOf(data.goals, type)
        return (
          <section className="card" key={type}>
            <h3>{METRIC_LABEL[type]}</h3>
            <p className="card-sub">
              Goal: {fmtGoal(type, data.goals)}{unit ? ` ${unit}` : ''}.
              {type === 'run3k' && ' Log a timed 3 km whenever you test it.'}
            </p>
            {ms.length > 0 && (
              <TimeChart points={pts} periods={[]} color={cssVar('text-2')} height={150}
                goal={{ value: type === 'run3k' ? goal / 60 : goal, label: 'goal' }} ariaLabel={`${METRIC_LABEL[type]} over time`} />
            )}
            <div className="list inset">
              {[...ms].reverse().slice(0, 5).map((m) => (
                <button key={m.id} className="row slim" onClick={() => open({ mode: 'body', measurement: m })}>
                  <span className="row-main"><span className="row-title"><b>{fmtMetric(type, m.value)}</b> {unit}</span></span>
                  <span className="row-date">{fmtShort(m.date)}</span>
                </button>
              ))}
              <button className="row slim add" onClick={() => open({ mode: 'body', metric: type })}>
                <span className="badge plus small"><PlusIcon /></span>
                <span className="row-main"><span className="row-title">Log {METRIC_LABEL[type]}</span></span>
              </button>
            </div>
          </section>
        )
      })}
    </>
  )
}
