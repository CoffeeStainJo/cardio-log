import { fmtShort, fmtWeekday, relativeDay } from '../domain/dates'
import { describe } from '../domain/stats'
import { KIND_LABEL, type Session } from '../domain/types'
import { BoltIcon, PeaksIcon, WaveIcon } from './Icons'

export function KindBadge({ kind }: { kind: Session['kind'] }) {
  return <span className={`badge ${kind}`}>{kind === 'interval' ? <BoltIcon /> : kind === 'hiit' ? <PeaksIcon /> : <WaveIcon />}</span>
}

export function SessionRow({ session, onClick, relative }: { session: Session; onClick: () => void; relative?: boolean }) {
  return (
    <button className="row" onClick={onClick}>
      <KindBadge kind={session.kind} />
      <span className="row-main">
        <span className="row-title">
          <b>{session.minutes}</b> min <span className="row-kind">{KIND_LABEL[session.kind]}</span>
        </span>
        <span className="row-sub">{describe(session)}{session.note ? ` · ${session.note}` : ''}</span>
      </span>
      <span className="row-date">
        {relative ? relativeDay(session.date) : `${fmtWeekday(session.date)} ${fmtShort(session.date)}`}
      </span>
    </button>
  )
}
