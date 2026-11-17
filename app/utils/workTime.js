const pad = value => String(value).padStart(2, '0')

export function dayKey (date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfDay (date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function startOfWeek (date) {
  const start = startOfDay(date)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

function sumFrom (days, start, end) {
  const last = dayKey(end)
  const cursor = new Date(start)
  let total = 0
  while (dayKey(cursor) <= last) {
    total += days[dayKey(cursor)] ?? 0
    cursor.setDate(cursor.getDate() + 1)
  }
  return Math.round(total)
}

export function summarize (days, now = new Date(), chartDays = 14) {
  const today = startOfDay(now)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const week = startOfWeek(today)
  const chart = []
  for (let offset = chartDays - 1; offset >= 0; offset--) {
    const date = new Date(today)
    date.setDate(date.getDate() - offset)
    chart.push({ date: dayKey(date), weekday: date.getDay(), seconds: Math.round(days[dayKey(date)] ?? 0), today: offset === 0 })
  }
  const worked = Object.entries(days).filter(([key, seconds]) => seconds >= 60 && key >= dayKey(monthStart) && key <= dayKey(today))
  const monthSeconds = sumFrom(days, monthStart, today)
  return {
    today: Math.round(days[dayKey(today)] ?? 0),
    week: sumFrom(days, week, today),
    month: monthSeconds,
    monthAverage: worked.length ? Math.round(worked.reduce((total, [, seconds]) => total + seconds, 0) / worked.length) : 0,
    chart
  }
}

export function formatWorkDuration (seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${pad(minutes % 60)}m` : `${minutes}m`
}
