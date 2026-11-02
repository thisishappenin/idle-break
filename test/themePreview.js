import { describe, it } from 'vitest'
import { expect } from 'chai'
import { previewWindowStyle, trayPreviewSize } from '../app/utils/themePreview.js'

const base = { color: '#478484', opacity: 1, width: 85, height: 60, position: 'center' }

describe('themePreview', () => {
  it('sizes the mock window as a percentage of the mock screen', () => {
    const style = previewWindowStyle(base)
    expect(style.width).to.equal('85%')
    expect(style.height).to.equal('60%')
  })

  it('centres the window', () => {
    const style = previewWindowStyle(base)
    expect(style.left).to.equal('50%')
    expect(style.top).to.equal('50%')
    expect(style.transform).to.equal('translate(-50%, -50%)')
  })

  it('pins the window to the chosen corner', () => {
    const style = previewWindowStyle({ ...base, position: 'bottom-right' })
    expect(style.bottom).to.equal('3%')
    expect(style.right).to.equal('3%')
    expect(style.top).to.equal('')
    expect(style.left).to.equal('')
    expect(style.transform).to.equal('')
  })

  it('uses dark text and a dark outline on a light colour so the window shows on white', () => {
    const style = previewWindowStyle({ ...base, color: '#ffffff' })
    expect(style.color).to.equal('#1b1b1b')
    expect(style.outline).to.contain('#000000 30%')
  })

  it('uses light text and a faint light outline on a dark colour', () => {
    const style = previewWindowStyle({ ...base, color: '#1D1F21' })
    expect(style.color).to.equal('#ffffff')
    expect(style.outline).to.contain('#ffffff 10%')
  })

  it('passes the opacity through', () => {
    expect(previewWindowStyle({ ...base, opacity: 0.6 }).opacity).to.equal('0.6')
  })

  it('previews the tray image size closest to the display scale', () => {
    expect(trayPreviewSize(1)).to.equal(16)
    expect(trayPreviewSize(1.25)).to.equal(20)
    expect(trayPreviewSize(1.5)).to.equal(24)
    expect(trayPreviewSize(2)).to.equal(32)
    expect(trayPreviewSize(3)).to.equal(48)
  })
})
