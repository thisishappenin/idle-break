import { describe, it } from 'vitest'
import { expect } from 'chai'
import { countdownColor, hexToRgb } from '../app/utils/countdownColor.js'

const settingsWith = values => ({ get: key => values[key] })

describe('countdownColor', () => {
  it('is the chosen colour when a custom colour is on', () => {
    expect(countdownColor(settingsWith({ countdownColorCustom: true, countdownColor: '#ffcc00' }))).to.equal('#ffcc00')
  })

  it('is null when the custom colour is off, so the theme decides', () => {
    expect(countdownColor(settingsWith({ countdownColorCustom: false, countdownColor: '#ffcc00' }))).to.equal(null)
  })

  it('is null for a value that is not a six digit hex colour', () => {
    expect(countdownColor(settingsWith({ countdownColorCustom: true, countdownColor: 'red; background: url(x)' }))).to.equal(null)
    expect(countdownColor(settingsWith({ countdownColorCustom: true, countdownColor: '#fff' }))).to.equal(null)
    expect(countdownColor(settingsWith({ countdownColorCustom: true, countdownColor: undefined }))).to.equal(null)
  })

  it('turns a hex colour into red, green and blue', () => {
    expect(hexToRgb('#ffcc00')).to.deep.equal([255, 204, 0])
    expect(hexToRgb('#000000')).to.deep.equal([0, 0, 0])
  })
})
