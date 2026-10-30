import { describe, it } from 'vitest'
import { expect } from 'chai'
import { parsePauseDurations, formatPauseDurations } from '../app/utils/pauseDurations.js'

describe('pauseDurations', () => {
  it('parses comma or space separated minutes', () => {
    expect(parsePauseDurations('30, 60 120;300')).to.deep.equal([30, 60, 120, 300])
  })

  it('sorts and removes duplicates', () => {
    expect(parsePauseDurations('60, 15, 60')).to.deep.equal([15, 60])
  })

  it('drops values that are not whole positive minutes', () => {
    expect(parsePauseDurations('abc, 0, -5, 2.5, 45')).to.deep.equal([45])
  })

  it('drops durations longer than a week', () => {
    expect(parsePauseDurations('30, 20000')).to.deep.equal([30])
  })

  it('returns an empty list for empty input', () => {
    expect(parsePauseDurations('')).to.deep.equal([])
  })

  it('formats minutes back into the text box', () => {
    expect(formatPauseDurations([30, 60])).to.equal('30, 60')
  })
})
