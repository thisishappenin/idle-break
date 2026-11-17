import { describe, it } from 'vitest'
import { expect } from 'chai'
import { dayKey, startOfWeek, summarize, formatWorkDuration } from '../app/utils/workTime.js'

const date = (year, month, day) => new Date(year, month - 1, day, 12)

describe('workTime', () => {
  it('names a day by its local date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).to.equal('2026-01-05')
    expect(dayKey(new Date(2026, 10, 17, 0, 0))).to.equal('2026-11-17')
  })

  it('starts the week on Monday', () => {
    expect(dayKey(startOfWeek(date(2026, 11, 18)))).to.equal('2026-11-16')
    expect(dayKey(startOfWeek(date(2026, 11, 16)))).to.equal('2026-11-16')
    expect(dayKey(startOfWeek(date(2026, 11, 22)))).to.equal('2026-11-16')
  })

  it('adds up today, this week and this month, and leaves out other periods', () => {
    const days = {
      '2026-11-18': 3600,
      '2026-11-17': 7200,
      '2026-11-16': 1800,
      '2026-11-15': 5000,
      '2026-11-01': 600,
      '2026-10-31': 9999,
      '2026-11-19': 4000
    }
    const summary = summarize(days, date(2026, 11, 18))
    expect(summary.today).to.equal(3600)
    expect(summary.week).to.equal(3600 + 7200 + 1800)
    expect(summary.month).to.equal(3600 + 7200 + 1800 + 5000 + 600)
  })

  it('averages the month over the days that had work', () => {
    const summary = summarize({ '2026-11-02': 3600, '2026-11-03': 7200, '2026-11-04': 10 }, date(2026, 11, 4))
    expect(summary.monthAverage).to.equal(5400)
    expect(summarize({}, date(2026, 11, 4)).monthAverage).to.equal(0)
  })

  it('builds a chart of the last days ending today', () => {
    const summary = summarize({ '2026-11-18': 100 }, date(2026, 11, 18), 7)
    expect(summary.chart).to.have.length(7)
    expect(summary.chart[0].date).to.equal('2026-11-12')
    expect(summary.chart[6]).to.include({ date: '2026-11-18', seconds: 100, today: true })
    expect(summary.chart.filter(item => item.today)).to.have.length(1)
  })

  it('crosses month and year ends in the chart', () => {
    const summary = summarize({ '2025-12-31': 60 }, date(2026, 1, 2), 3)
    expect(summary.chart.map(item => item.date)).to.deep.equal(['2025-12-31', '2026-01-01', '2026-01-02'])
    expect(summary.chart[0].seconds).to.equal(60)
  })

  it('formats durations as hours and minutes', () => {
    expect(formatWorkDuration(0)).to.equal('0m')
    expect(formatWorkDuration(59)).to.equal('0m')
    expect(formatWorkDuration(45 * 60)).to.equal('45m')
    expect(formatWorkDuration(3600)).to.equal('1h 00m')
    expect(formatWorkDuration(3 * 3600 + 12 * 60 + 30)).to.equal('3h 12m')
    expect(formatWorkDuration(-5)).to.equal('0m')
  })
})
