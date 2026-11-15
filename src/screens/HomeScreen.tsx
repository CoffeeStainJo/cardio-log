import type { OpenSheet } from '../App'
import { GoalTiles } from '../components/Goals'
import { ChevronIcon } from '../components/Icons'
import { KindBadge, SessionRow } from '../components/SessionRow'
import { addDays, diffDays, fmtLong, today, weekStart } from '../domain/dates'
import { byDate, describe, periodOn, sum, weekStreak } from '../domain/stats'
import { suggestHiit, suggestInterval, suggestSteady } from '../domain/suggest'
import { KINDS, KIND_LABEL, PERIOD_LABEL } from '../domain/types'
import { useStore } from '../store/store'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function HomeScreen({ open }: { open: OpenSheet }) {
  const { data } = useStore()
  const now = today()
  const sorted = byDate(data.sessions)
  const week = weekStart(now)
  const inWeek = (w: string) => sorted.filter((s) => s.date >= w && s.date <= addDays(w, 6))
  const thisWeek = inWeek(week)
  const lastWeek = inWeek(addDays(week, -7))
  const minutes = sum(thisWeek.map((s) => s.minutes))
  const lastMinutes = sum(lastWeek.map((s) => s.minutes))
  const streak = weekStreak(data.sessions, data.periods, now)
  const last = sorted.at(-1)
  const period = periodOn(now, data.periods)

  const next = [
    suggestInterval(data.sessions, data.periods, now),
    suggestHiit(data.sessions, data.periods, now),
    suggestSteady(data.sessions, data.periods, now),
  ]

  return (
    <div className="screen">
      <header className="top">
        <p className="eyebrow">{fmtLong(now)}</p>
        <h1>Today</h1>
      </header>

      <section className="card hero">
        <div className="hero-top">
          <div>
            <p className="label">This week</p>
            <p className="big">{minutes}<small> min</small></p>
            <p className="sub">
              {thisWeek.length} session{thisWeek.length === 1 ? '' : 's'}
              {lastWeek.length > 0 && ` · last week ${lastMinutes} min`}
            </p>
          </div>
          <div className="streak">
            <b>{streak}</b>
            <span>week{streak === 1 ? '' : 's'}<br />streak</span>
          </div>
        </div>
        <div className="weekstrip">
          {DAYS.map((d, i) => {
            const date = addDays(week, i)
            const kinds = new Set(thisWeek.filter((s) => s.date === date).map((s) => s.kind))
            return (
              <div key={i} className={`wd${date === now ? ' today' : ''}${date > now ? ' future' : ''}`}>
                <span>{d}</span>
                <span className={`bar${!kinds.size && periodOn(date, data.periods) ? ' off' : ''}`}>
                  {KINDS.filter((k) => kinds.has(k)).map((k) => <i key={k} className={k} />)}
                </span>
              </div>
            )
          })}
        </div>
        {period ? (
          <p className="pill">{PERIOD_LABEL[period.kind]} period — take it easy.</p>
        ) : last ? (
          <p className="pill">
            {diffDays(last.date, now) === 0 ? 'You trained today. Nice.' : `${diffDays(last.date, now)} days since your last session`}
          </p>
        ) : null}
      </section>

      <h2 className="section">Next up</h2>
      <div className="next">
        {next.map(({ values, reason }) => (
          <button key={values.kind} className={`card next-card ${values.kind}`}
            onClick={() => open({ mode: values.kind, values })}>
            <span className="next-head"><KindBadge kind={values.kind} />{KIND_LABEL[values.kind]}</span>
            <span className="big">{values.minutes}<small> min</small></span>
            <span className="next-desc">{describe(values)}</span>
            <span className="next-reason">{reason}</span>
            <span className="next-cta">Log it <ChevronIcon width={14} height={14} /></span>
          </button>
        ))}
      </div>

      <h2 className="section">Goals</h2>
      <GoalTiles open={open} />

      <h2 className="section">Recent</h2>
      <div className="card list">
        {sorted.length === 0 && <p className="empty">No sessions yet. Tap + to log your first.</p>}
        {sorted.slice(-6).reverse().map((s) => (
          <SessionRow key={s.id} session={s} relative onClick={() => open({ mode: s.kind, session: s })} />
        ))}
      </div>
    </div>
  )
}
