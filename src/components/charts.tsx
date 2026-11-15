import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { addDays, diffDays, fmtMonth, fmtShort, fromISO, toISO } from '../domain/dates'
import { weekMinutes, type WeekTotal } from '../domain/stats'
import type { ISODate, Period } from '../domain/types'
import { PERIOD_LABEL } from '../domain/types'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const niceTicks = (min: number, max: number, count = 4): number[] => {
  if (min === max) { min -= 1; max += 1 }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const ticks: number[] = []
  for (let v = Math.floor(min / step) * step; v < max + step - 1e-9; v += step) ticks.push(+v.toFixed(6))
  return ticks
}

/** First-of-month dates strictly inside (from, to]. */
const monthStarts = (from: ISODate, to: ISODate): ISODate[] => {
  const d = fromISO(from)
  const out: ISODate[] = []
  for (let m = new Date(d.getFullYear(), d.getMonth() + 1, 1); toISO(m) <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    out.push(toISO(m))
  }
  return out
}

const PAD = { l: 30, r: 12, t: 18, b: 22 }

export interface Pt {
  date: ISODate
  y: number
  /** Range mode: the lower end of the bar. */
  y0?: number
  /** Short direct label drawn above the point (use sparingly). */
  label?: string
  value: string
  detail: string
}

interface TimeChartProps {
  points: Pt[]
  periods: Period[]
  color: string
  height?: number
  range?: boolean
  /** Draw point labels under the marker instead of above it. */
  labelBelow?: boolean
  /** Horizontal reference line, e.g. a target. */
  goal?: { value: number; label: string }
  ariaLabel: string
}

export function TimeChart({ points, periods, color, height = 190, range, labelBelow, goal, ariaLabel }: TimeChartProps) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const g = useMemo(() => {
    if (!points.length) return null
    const t0 = points[0].date
    const t1 = points[points.length - 1].date
    const span = Math.max(1, diffDays(t0, t1))
    // Nudge same-day sessions apart so both stay visible.
    const seen = new Map<ISODate, number>()
    const offs = points.map((p) => {
      const n = seen.get(p.date) ?? 0
      seen.set(p.date, n + 1)
      return diffDays(t0, p.date) + n * 0.9
    })
    const extra = goal ? [goal.value] : []
    const ticks = niceTicks(Math.min(...extra, ...points.map((p) => p.y0 ?? p.y)), Math.max(...extra, ...points.map((p) => p.y)))
    return { t0, t1, span, offs, ticks }
  }, [points, goal?.value])

  if (!g) return <div ref={ref} className="chart-empty">Nothing logged yet</div>

  const iw = Math.max(1, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const [dmin, dmax] = [g.ticks[0], g.ticks[g.ticks.length - 1]]
  const x = (off: number) => PAD.l + (Math.min(off, g.span) / g.span) * iw
  const y = (v: number) => PAD.t + (1 - (v - dmin) / (dmax - dmin)) * ih
  const xs = g.offs.map(x)
  const shown = active ?? points.length - 1
  const pt = points[shown]

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    let best = 0
    xs.forEach((v, i) => { if (Math.abs(v - px) < Math.abs(xs[best] - px)) best = i })
    setActive(best)
  }

  const bands = periods
    .filter((p) => p.end >= g.t0 && p.start <= g.t1)
    .map((p) => {
      const a = x(Math.max(0, diffDays(g.t0, p.start) - 0.5))
      const b = x(Math.min(g.span, diffDays(g.t0, p.end) + 0.5))
      return { p, a, b }
    })

  return (
    <div ref={ref} className="chart">
      <div className="readout">
        <b>{pt.value}</b>
        <span>{fmtShort(pt.date)} · {pt.detail}</span>
      </div>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel} onPointerDown={pick} onPointerMove={pick}>
          {bands.map(({ p, a, b }) => (
            <g key={p.id}>
              <rect x={a} y={PAD.t} width={Math.max(3, b - a)} height={ih} className={`band ${p.kind}`} rx={3} />
              <text x={(a + b) / 2} y={PAD.t - 6} textAnchor="middle" className="band-label">{PERIOD_LABEL[p.kind].toLowerCase()}</text>
            </g>
          ))}
          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
            </g>
          ))}
          {monthStarts(g.t0, g.t1).map((m) => (
            <text key={m} x={x(diffDays(g.t0, m))} y={height - 5} textAnchor="middle" className="tick">{fmtMonth(m)}</text>
          ))}
          {goal && (
            <g>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(goal.value)} y2={y(goal.value)} className="goal-line" />
              <text x={w - PAD.r} y={y(goal.value) - 6} textAnchor="end" className="goal-label">{goal.label}</text>
            </g>
          )}
          <line x1={xs[shown]} x2={xs[shown]} y1={PAD.t} y2={PAD.t + ih} className="crosshair" />
          {range ? (
            points.map((p, i) => (
              <rect key={i} x={xs[i] - 4} width={8} rx={4} y={y(p.y) - 4} height={y(p.y0 ?? p.y) - y(p.y) + 8}
                fill={color} opacity={i === shown ? 1 : 0.75} />
            ))
          ) : (
            <>
              <path d={points.map((p, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y(p.y).toFixed(1)}`).join('')}
                fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={xs[i]} cy={y(p.y)} r={i === shown ? 6 : 4.5} fill={color} className="marker" />
                  {p.label && (
                    <text x={xs[i]} y={y(p.y) + (labelBelow ? 20 : -11)} textAnchor={xs[i] > w - 40 ? 'end' : 'middle'} className="point-label">{p.label}</text>
                  )}
                </g>
              ))}
            </>
          )}
        </svg>
      )}
    </div>
  )
}

const STACK = ['steady', 'hiit', 'interval'] as const

export function WeeklyBars({ weeks, height = 190 }: { weeks: WeekTotal[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  if (!weeks.length) return <div ref={ref} className="chart-empty">Nothing logged yet</div>

  const iw = Math.max(1, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const ticks = niceTicks(0, Math.max(10, ...weeks.map(weekMinutes)))
  const dmax = ticks[ticks.length - 1]
  const slot = iw / weeks.length
  const bw = Math.min(24, Math.max(4, slot - 4))
  const y = (v: number) => PAD.t + (1 - v / dmax) * ih
  const cx = (i: number) => PAD.l + slot * (i + 0.5)
  const shown = active ?? weeks.length - 1
  const wk = weeks[shown]

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    setActive(Math.max(0, Math.min(weeks.length - 1, Math.floor((px - PAD.l) / slot))))
  }
  // Rounded top (data end), square bottom (baseline).
  const bar = (i: number, from: number, to: number, round: boolean) => {
    const x0 = cx(i) - bw / 2, top = y(to), bottom = y(from), r = round ? Math.min(4, bw / 2, bottom - top) : 0
    return `M${x0},${bottom}V${top + r}q0,${-r} ${r},${-r}h${bw - 2 * r}q${r},0 ${r},${r}V${bottom}z`
  }

  return (
    <div ref={ref} className="chart">
      <div className="readout">
        <b>{weekMinutes(wk)} min</b>
        <span>
          {fmtShort(wk.week)} – {fmtShort(addDays(wk.week, 6))} · {wk.sessions} session{wk.sessions === 1 ? '' : 's'}
        </span>
      </div>
      <div className="legend">
        <span><i className="swatch steady" />Steady</span>
        <span><i className="swatch hiit" />4×4</span>
        <span><i className="swatch interval" />Speed</span>
      </div>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="Minutes of cardio per week, split by steady, 4×4 and speed"
          onPointerDown={pick} onPointerMove={pick}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
            </g>
          ))}
          {weeks.map((t, i) => {
            const gap = 2 / (ih / dmax) // 2px of surface between stacked segments
            const parts = STACK.filter((k) => t[k] > 0)
            let base = 0
            return (
              <g key={t.week} opacity={active === null || i === shown ? 1 : 0.55}>
                {parts.map((k, j) => {
                  const from = base + (j ? gap : 0)
                  base += t[k]
                  return <path key={k} d={bar(i, Math.min(from, base), base, j === parts.length - 1)} className={`fill-${k}`} />
                })}
                {fromISO(t.week).getDate() <= 7 && (
                  <text x={cx(i)} y={height - 5} textAnchor="middle" className="tick">{fmtMonth(t.week)}</text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
