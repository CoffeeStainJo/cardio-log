import { useRef, useState } from 'react'
import type { OpenSheet } from '../App'
import { PlusIcon } from '../components/Icons'
import { diffDays, fmtShort, today } from '../domain/dates'
import { seedData } from '../domain/seed'
import { fmtPace, fmtTime, speedFor } from '../domain/stats'
import { PERIOD_LABEL } from '../domain/types'
import { parseData, useStore } from '../store/store'

export function SettingsScreen({ open }: { open: OpenSheet }) {
  const { data, replaceAll, setGoals } = useStore()
  const { goals } = data
  const bump = (key: keyof typeof goals, by: number) => setGoals({ ...goals, [key]: Math.max(1, +(goals[key] + by).toFixed(1)) })
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const exportData = async () => {
    const name = `cardio-log-${today()}.json`
    const json = JSON.stringify(data, null, 2)
    const f = new File([json], name, { type: 'application/json' })
    try {
      // The share sheet is the reliable way to save a file from an iOS home-screen app.
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: 'Cardio Log backup' })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg(`Saved ${name}`)
  }

  const importData = async (f: File | undefined) => {
    if (!f) return
    try {
      const next = parseData(JSON.parse(await f.text()))
      if (confirm(`Replace everything with this backup (${next.sessions.length} sessions)?`)) {
        replaceAll(next)
        setMsg(`Imported ${next.sessions.length} sessions`)
      }
    } catch {
      setMsg("That file isn't a Cardio Log backup.")
    }
    if (file.current) file.current.value = ''
  }

  const periods = [...data.periods].sort((a, b) => b.start.localeCompare(a.start))

  return (
    <div className="screen">
      <header className="top">
        <p className="eyebrow">{data.sessions.length} sessions stored on this device</p>
        <h1>Settings</h1>
      </header>

      <h2 className="section">Sick &amp; deload periods</h2>
      <div className="card list">
        {periods.map((p) => (
          <button key={p.id} className="row" onClick={() => open({ mode: 'period', period: p })}>
            <span className={`badge ${p.kind}`} />
            <span className="row-main">
              <span className="row-title">{PERIOD_LABEL[p.kind]}</span>
              <span className="row-sub">{fmtShort(p.start)} – {fmtShort(p.end)} · {diffDays(p.start, p.end) + 1} days</span>
            </span>
          </button>
        ))}
        <button className="row add" onClick={() => open({ mode: 'period' })}>
          <span className="badge plus"><PlusIcon /></span>
          <span className="row-main"><span className="row-title">Add period</span></span>
        </button>
      </div>

      <h2 className="section">Goals</h2>
      <div className="card goal-edit">
        {([
          ['rhr', 'Resting HR below', `${goals.rhr} bpm`, 1],
          ['vo2', 'VO₂ max above', String(goals.vo2), 1],
          ['run3kSec', '3 km under', fmtTime(goals.run3kSec), 10],
        ] as const).map(([key, label, value, step]) => (
          <div key={key} className="stepper">
            <span className="field-label">{label}</span>
            <div className="stepper-ctl">
              <button aria-label={`Lower: ${label}`} onClick={() => bump(key, -step)}>−</button>
              <output>{value}</output>
              <button aria-label={`Raise: ${label}`} onClick={() => bump(key, step)}>+</button>
            </div>
          </div>
        ))}
        <p className="hint">3 km in {fmtTime(goals.run3kSec)} means holding {fmtPace(speedFor(3, goals.run3kSec))} /km ({speedFor(3, goals.run3kSec).toFixed(1)} km/h).</p>
      </div>

      <h2 className="section">Backup</h2>
      <div className="card pad">
        <p className="card-sub">Your log lives only in this browser. Export a backup now and then — iOS can clear app storage.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={exportData}>Export backup</button>
          <button className="btn" onClick={() => file.current?.click()}>Import backup</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => importData(e.target.files?.[0])} />
        {msg && <p className="hint" role="status">{msg}</p>}
      </div>

      <h2 className="section">Reset</h2>
      <div className="card pad">
        <div className="btn-row">
          <button className="btn" onClick={() => confirm('Replace everything with the history from your Keep note?') && replaceAll(seedData())}>
            Restore Keep history
          </button>
          <button className="btn danger" onClick={() => confirm('Erase all sessions and periods? This cannot be undone.') && replaceAll({ version: 1, sessions: [], periods: [], measurements: [], goals })}>
            Erase everything
          </button>
        </div>
      </div>
    </div>
  )
}
