import { useMemo, useState } from 'react'
import type { OpenSheet } from '../App'
import { ChevronIcon, PlusIcon } from '../components/Icons'
import { SessionRow } from '../components/SessionRow'
import { addDays, fmtLong, fmtMonthYear, fromISO, toISO, today, weekStart } from '../domain/dates'
import { periodOn, sum } from '../domain/stats'
import type { ISODate, Session } from '../domain/types'
import { PERIOD_LABEL } from '../domain/types'
import { useStore } from '../store/store'

const monthOf = (s: ISODate) => `${s.slice(0, 7)}-01`
const shiftMonth = (s: ISODate, n: number) => {
  const d = fromISO(s)
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, 1))
}

export function CalendarScreen({ open }: { open: OpenSheet }) {
  const { data } = useStore()
  const now = today()
  const [month, setMonth] = useState(monthOf(now))
  const [selected, setSelected] = useState(now)

  const byDay = useMemo(() => {
    const m = new Map<ISODate, Session[]>()
    for (const s of data.sessions) m.set(s.date, [...(m.get(s.date) ?? []), s])
    return m
  }, [data.sessions])

  const days: ISODate[] = []
  const lastDay = addDays(shiftMonth(month, 1), -1)
  for (let d = weekStart(month); d <= lastDay || days.length % 7; d = addDays(d, 1)) days.push(d)

  const inMonth = data.sessions.filter((s) => monthOf(s.date) === month)
  const daySessions = byDay.get(selected) ?? []
  const dayPeriod = periodOn(selected, data.periods)

  const go = (n: number) => setMonth(shiftMonth(month, n))

  return (
    <div className="screen">
      <header className="top row-between">
        <div>
          <p className="eyebrow">
            {inMonth.length} session{inMonth.length === 1 ? '' : 's'} · {sum(inMonth.map((s) => s.minutes))} min
          </p>
          <h1>{fmtMonthYear(month)}</h1>
        </div>
        <div className="month-nav">
          <button aria-label="Previous month" onClick={() => go(-1)}><ChevronIcon style={{ transform: 'rotate(180deg)' }} /></button>
          <button aria-label="Next month" onClick={() => go(1)}><ChevronIcon /></button>
        </div>
      </header>

      <section className="card cal">
        <div className="cal-grid cal-head">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="cal-grid">
          {days.map((d) => {
            const sessions = byDay.get(d) ?? []
            const period = periodOn(d, data.periods)
            const cls = ['day']
            if (monthOf(d) !== month) cls.push('out')
            if (d === now) cls.push('today')
            if (d === selected) cls.push('sel')
            if (period) {
              cls.push(`p-${period.kind}`)
              if (d === period.start || fromISO(d).getDay() === 1) cls.push('p-first')
              if (d === period.end || fromISO(d).getDay() === 0) cls.push('p-last')
            }
            return (
              <button key={d} className={cls.join(' ')} onClick={() => { setSelected(d); if (monthOf(d) !== month) setMonth(monthOf(d)) }}
                aria-label={`${fmtLong(d)}, ${sessions.length} sessions`}>
                <span className="num">{Number(d.slice(8))}</span>
                <span className="dots">
                  {sessions.slice(0, 3).map((s) => <i key={s.id} className={s.kind} />)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="legend">
          <span><i className="swatch interval" />Speed</span>
          <span><i className="swatch hiit" />4×4</span>
          <span><i className="swatch steady" />Steady</span>
          <span><i className="swatch sick" />Sick</span>
          <span><i className="swatch deload" />Deload</span>
          {month !== monthOf(now) && (
            <button className="text-btn" onClick={() => { setMonth(monthOf(now)); setSelected(now) }}>Today</button>
          )}
        </div>
      </section>

      <h2 className="section">{selected === now ? 'Today' : fmtLong(selected)}</h2>
      <div className="card list">
        {dayPeriod && (
          <button className="row" onClick={() => open({ mode: 'period', period: dayPeriod })}>
            <span className={`badge ${dayPeriod.kind}`} />
            <span className="row-main">
              <span className="row-title">{PERIOD_LABEL[dayPeriod.kind]} period</span>
              <span className="row-sub">Tap to edit</span>
            </span>
          </button>
        )}
        {daySessions.map((s) => <SessionRow key={s.id} session={s} onClick={() => open({ mode: s.kind, session: s })} />)}
        {!daySessions.length && !dayPeriod && <p className="empty">Rest day.</p>}
        <button className="row add" onClick={() => open({ date: selected })}>
          <span className="badge plus"><PlusIcon /></span>
          <span className="row-main"><span className="row-title">Add entry</span></span>
        </button>
      </div>
    </div>
  )
}
