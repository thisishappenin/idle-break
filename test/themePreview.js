import { describe, it } from 'vitest'
import { expect } from 'chai'
import { trayPreviewSize } from '../app/utils/themePreview.js'

describe('themePreview', () => {
  it('previews the tray image size closest to the display scale', () => {
    expect(trayPreviewSize(1)).to.equal(16)
    expect(trayPreviewSize(1.25)).to.equal(20)
    expect(trayPreviewSize(1.5)).to.equal(24)
    expect(trayPreviewSize(2)).to.equal(32)
    expect(trayPreviewSize(3)).to.equal(48)
  })
})
