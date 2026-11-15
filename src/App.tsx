import { useCallback, useState } from 'react'
import { CalendarIcon, ChartIcon, GearIcon, HomeIcon, PlusIcon } from './components/Icons'
import { LogSheet, type SheetInit } from './components/LogSheet'
import { byDate } from './domain/stats'
import { KINDS } from './domain/types'
import { CalendarScreen } from './screens/CalendarScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { useStore } from './store/store'

type Tab = 'home' | 'calendar' | 'progress' | 'settings'
export type OpenSheet = (init?: Partial<SheetInit>) => void

const TABS: [Tab, string, typeof HomeIcon][] = [
  ['home', 'Today', HomeIcon],
  ['calendar', 'Calendar', CalendarIcon],
  ['progress', 'Progress', ChartIcon],
  ['settings', 'Settings', GearIcon],
]

export default function App() {
  const { data } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [sheet, setSheet] = useState<SheetInit | null>(null)

  const open: OpenSheet = useCallback((init = {}) => {
    // Default to whichever type you haven't done for the longest.
    const last = (k: string) => byDate(data.sessions.filter((s) => s.kind === k)).at(-1)?.date ?? ''
    const mode = [...KINDS].sort((a, b) => last(a).localeCompare(last(b)))[0]
    setSheet({ mode, ...init })
  }, [data.sessions])
  const close = useCallback(() => setSheet(null), [])

  return (
    <div className="app">
      <main key={tab}>
        {tab === 'home' && <HomeScreen open={open} />}
        {tab === 'calendar' && <CalendarScreen open={open} />}
        {tab === 'progress' && <ProgressScreen open={open} />}
        {tab === 'settings' && <SettingsScreen open={open} />}
      </main>

      <nav className="tabbar">
        {TABS.slice(0, 2).map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id} onClick={() => setTab(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
        <button className="fab" aria-label="Log a session" onClick={() => open()}><PlusIcon /></button>
        {TABS.slice(2).map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id} onClick={() => setTab(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>

      {sheet && <LogSheet init={sheet} onClose={close} />}
    </div>
  )
}
