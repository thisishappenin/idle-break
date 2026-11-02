import { describe, it } from 'vitest'
import { expect } from 'chai'
import formatClock from '../app/utils/formatClock.js'

describe('formatClock', () => {
  it('shows minutes and seconds', () => {
    expect(formatClock(210000)).to.equal('3:30')
  })

  it('rounds partial seconds up so the clock never shows 0:00 early', () => {
    expect(formatClock(400)).to.equal('0:01')
  })

  it('adds hours for long breaks', () => {
    expect(formatClock(3725000)).to.equal('1:02:05')
  })

  it('never goes negative', () => {
    expect(formatClock(-500)).to.equal('0:00')
  })
})
