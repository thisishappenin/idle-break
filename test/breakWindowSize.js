import { describe, it } from 'vitest'
import { expect } from 'chai'
import { breakWindowSize, MIN_BREAK_WINDOW_HEIGHT, MIN_BREAK_WINDOW_WIDTH } from '../app/utils/breakWindowSize.js'

describe('breakWindowSize', () => {
  it('uses the percentage of the display when the window is big enough', () => {
    expect(breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 0.85, heightRatio: 0.85 }))
      .to.deep.equal({ width: 1632, height: 918 })
  })

  it('does not let a small percentage make the window too small to hold its content', () => {
    const size = breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 0.05, heightRatio: 0.05 })
    expect(size).to.deep.equal({ width: MIN_BREAK_WINDOW_WIDTH, height: MIN_BREAK_WINDOW_HEIGHT })
  })

  it('keeps the same percentage on a bigger monitor but the minimum on a smaller one', () => {
    const request = { widthRatio: 0.2, heightRatio: 0.15 }
    expect(breakWindowSize({ displayWidth: 3840, displayHeight: 2160, ...request })).to.deep.equal({ width: 768, height: 324 })
    expect(breakWindowSize({ displayWidth: 1366, displayHeight: 768, ...request })).to.deep.equal({ width: 273, height: 115 })
  })

  it('sizes the width as if an ultrawide monitor were 16:9, so the popup is not stretched', () => {
    const request = { widthRatio: 0.2, heightRatio: 0.15 }
    expect(breakWindowSize({ displayWidth: 2560, displayHeight: 1440, ...request })).to.deep.equal({ width: 512, height: 216 })
    expect(breakWindowSize({ displayWidth: 3440, displayHeight: 1440, ...request })).to.deep.equal({ width: 512, height: 216 })
    expect(breakWindowSize({ displayWidth: 5120, displayHeight: 1440, ...request })).to.deep.equal({ width: 512, height: 216 })
  })

  it('keeps the same look at every resolution by scaling the minimum size with the display height', () => {
    const small = { widthRatio: 0.12, heightRatio: 0.1 }
    expect(breakWindowSize({ displayWidth: 1920, displayHeight: 1080, ...small })).to.deep.equal({ width: 240, height: 108 })
    expect(breakWindowSize({ displayWidth: 2560, displayHeight: 1440, ...small })).to.deep.equal({ width: 320, height: 144 })
    expect(breakWindowSize({ displayWidth: 3840, displayHeight: 2160, ...small })).to.deep.equal({ width: 480, height: 216 })
    expect(breakWindowSize({ displayWidth: 3440, displayHeight: 1440, ...small })).to.deep.equal({ width: 320, height: 144 })
  })

  it('does not shrink the popup below the minimum on small displays', () => {
    expect(breakWindowSize({ displayWidth: 1280, displayHeight: 720, widthRatio: 0.12, heightRatio: 0.1 })).to.deep.equal({ width: MIN_BREAK_WINDOW_WIDTH, height: MIN_BREAK_WINDOW_HEIGHT })
  })

  it('lets 100% cover the whole display, even an ultrawide one, and the last stretch blends in smoothly', () => {
    expect(breakWindowSize({ displayWidth: 3440, displayHeight: 1440, widthRatio: 1, heightRatio: 1 })).to.deep.equal({ width: 3440, height: 1440 })
    expect(breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 1, heightRatio: 1 })).to.deep.equal({ width: 1920, height: 1080 })
    expect(breakWindowSize({ displayWidth: 3440, displayHeight: 1440, widthRatio: 0.85, heightRatio: 0.85 }).width).to.equal(2176)
    const almost = breakWindowSize({ displayWidth: 3440, displayHeight: 1440, widthRatio: 0.99, heightRatio: 0.99 }).width
    expect(almost).to.be.within(3300, 3440)
  })

  it('gives the minimum size for 1%', () => {
    expect(breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 0.01, heightRatio: 0.01 }))
      .to.deep.equal({ width: MIN_BREAK_WINDOW_WIDTH, height: MIN_BREAK_WINDOW_HEIGHT })
  })

  it('never makes the window bigger than the display', () => {
    expect(breakWindowSize({ displayWidth: 200, displayHeight: 60, widthRatio: 0.1, heightRatio: 0.1 }))
      .to.deep.equal({ width: 200, height: 60 })
    expect(breakWindowSize({ displayWidth: 1920, displayHeight: 1080, widthRatio: 1.5, heightRatio: 1.5 }))
      .to.deep.equal({ width: 1920, height: 1080 })
  })
})
