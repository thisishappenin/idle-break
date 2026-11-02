import { describe, it } from 'vitest'
import { expect } from 'chai'
import { breakWindowSize, MIN_BREAK_WINDOW_HEIGHT, MIN_BREAK_WINDOW_WIDTH } from '../app/utils/breakWindowSize.js'

describe('breakWindowSize', () => {
  it('uses the percentage of the display when the window is big enough', () => {
    expect(breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 0.85, heightRatio: 0.85 }))
      .to.deep.equal({ width: 1632, height: 918 })
  })

  it('does not let a small percentage make the window too small to hold its content', () => {
    const size = breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 0.12, heightRatio: 0.1 })
    expect(size).to.deep.equal({ width: MIN_BREAK_WINDOW_WIDTH, height: MIN_BREAK_WINDOW_HEIGHT })
  })

  it('keeps the same percentage on a bigger monitor but the minimum on a smaller one', () => {
    const request = { widthRatio: 0.2, heightRatio: 0.15 }
    expect(breakWindowSize({ displayWidth: 3840, displayHeight: 2160, ...request })).to.deep.equal({ width: 768, height: 324 })
    expect(breakWindowSize({ displayWidth: 1366, displayHeight: 768, ...request })).to.deep.equal({ width: MIN_BREAK_WINDOW_WIDTH, height: MIN_BREAK_WINDOW_HEIGHT })
  })

  it('never makes the window bigger than the display', () => {
    expect(breakWindowSize({ displayWidth: 320, displayHeight: 100, widthRatio: 0.1, heightRatio: 0.1 }))
      .to.deep.equal({ width: 320, height: 100 })
    expect(breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 1.5, heightRatio: 1.5 }))
      .to.deep.equal({ width: 1920, height: 1080 })
  })
})
