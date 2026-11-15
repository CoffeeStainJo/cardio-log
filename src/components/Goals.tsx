import type { OpenSheet } from '../App'
import { byDate, fmtGoal, fmtMetric, fmtPace, goalMet, hiitOf, latestOf, metricUnit, speedFor } from '../domain/stats'
import { METRICS, METRIC_LABEL } from '../domain/types'
import { useStore } from '../store/store'
import { CheckIcon } from './Icons'

/** One tile per goal: latest value, the target, and whether it's met. Tap to log a new value. */
export function GoalTiles({ open }: { open: OpenSheet }) {
  const { data } = useStore()
  const lastHiit = byDate(hiitOf(data.sessions)).at(-1)

  return (
    <div className="goals">
      {METRICS.map((type) => {
        const latest = latestOf(data.measurements, type)
        const met = latest ? goalMet(type, latest.value, data.goals) : false
        // Until a 3 km test is logged, show how the 4×4 pace compares with the pace the goal needs.
        const proxy = type === 'run3k' && !latest && lastHiit
          ? `4×4 at ${fmtPace(lastHiit.speedKmh)} /km`
          : undefined
        return (
          <button key={type} className={`goal${met ? ' met' : ''}`} onClick={() => open({ mode: 'body', metric: type })}>
            <span className="label">{METRIC_LABEL[type]}</span>
            <b>{latest ? fmtMetric(type, latest.value) : '–'}<small> {latest && metricUnit(type)}</small></b>
            <span className="goal-target">
              {met ? <><CheckIcon width={13} height={13} /> Goal met</> : `Goal ${fmtGoal(type, data.goals)}`}
            </span>
            {type === 'run3k' && (
              <span className="sub">{proxy ?? `needs ${fmtPace(speedFor(3, data.goals.run3kSec))} /km`}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
