import type { ISODate } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromISO = (s: ISODate): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = (): ISODate => toISO(new Date())

export const addDays = (s: ISODate, n: number): ISODate => {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Whole days from a to b (positive when b is later). */
export const diffDays = (a: ISODate, b: ISODate): number =>
  Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)

/** Monday of the week containing s. */
export const weekStart = (s: ISODate): ISODate => addDays(s, -((fromISO(s).getDay() + 6) % 7))

const fmt = (opts: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat('en-GB', opts)
  return (s: ISODate) => f.format(fromISO(s))
}

export const fmtShort = fmt({ day: 'numeric', month: 'short' }) // 8 Nov
export const fmtLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' }) // Sunday 8 November
export const fmtWeekday = fmt({ weekday: 'short' }) // Sun
export const fmtMonthYear = fmt({ month: 'long', year: 'numeric' })
export const fmtMonth = fmt({ month: 'short' })

export const relativeDay = (s: ISODate, now: ISODate = today()): string => {
  const d = diffDays(s, now)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d > 1 && d < 7) return `${d} days ago`
  if (d === -1) return 'Tomorrow'
  return fmtShort(s)
}
