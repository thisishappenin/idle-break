import { describe, it } from 'vitest'
import { expect } from 'chai'
import { isLightColor } from '../app/utils/colorContrast.js'

describe('colorContrast', () => {
  it('treats white and pale colors as light', () => {
    expect(isLightColor('#ffffff')).to.equal(true)
    expect(isLightColor('#f0f0a0')).to.equal(true)
  })

  it('keeps the bundled themes on their current text color', () => {
    for (const color of ['#478484', '#633738', '#1D1F21', '#A49898', '#567890']) {
      expect(isLightColor(color)).to.equal(false)
    }
  })
})
