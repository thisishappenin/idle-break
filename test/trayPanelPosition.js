import { describe, it } from 'vitest'
import { expect } from 'chai'
import { trayPanelPosition } from '../app/utils/trayPanelPosition.js'

const size = { width: 300, height: 400 }

describe('trayPanelPosition', () => {
  it('opens above a taskbar tray icon, right-aligned to the screen edge', () => {
    const position = trayPanelPosition({
      trayBounds: { x: 1800, y: 1040, width: 24, height: 40 },
      cursor: { x: 1810, y: 1060 },
      size,
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    })
    expect(position).to.deep.equal({ x: 1612, y: 632 })
  })

  it('centres on the tray icon when there is room', () => {
    const position = trayPanelPosition({
      trayBounds: { x: 900, y: 1040, width: 24, height: 40 },
      cursor: { x: 0, y: 0 },
      size,
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    })
    expect(position.x).to.equal(912 - 150)
  })

  it('opens below a menu bar tray icon', () => {
    const position = trayPanelPosition({
      trayBounds: { x: 1500, y: 0, width: 24, height: 24 },
      cursor: { x: 0, y: 0 },
      size,
      workArea: { x: 0, y: 24, width: 1920, height: 1056 }
    })
    expect(position.y).to.equal(32)
    expect(position.x).to.equal(1512 - 150)
  })

  it('falls back to the cursor when the tray position is unknown', () => {
    const position = trayPanelPosition({
      trayBounds: { x: 0, y: 0, width: 0, height: 0 },
      cursor: { x: 1000, y: 1000 },
      size,
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    })
    expect(position).to.deep.equal({ x: 850, y: 632 })
  })

  it('stays inside a work area that does not start at the origin', () => {
    const position = trayPanelPosition({
      trayBounds: { x: 3700, y: 1040, width: 24, height: 40 },
      cursor: { x: 0, y: 0 },
      size,
      workArea: { x: 1920, y: 0, width: 1920, height: 1040 }
    })
    expect(position.x).to.equal(1920 + 1920 - 300 - 8)
  })

  it('stays on screen when the panel is taller than the work area', () => {
    const position = trayPanelPosition({
      trayBounds: { x: 100, y: 700, width: 24, height: 40 },
      cursor: { x: 0, y: 0 },
      size: { width: 300, height: 900 },
      workArea: { x: 0, y: 0, width: 1366, height: 700 }
    })
    expect(position.y).to.equal(8)
  })
})
