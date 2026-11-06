import { describe, it, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drawRing, ringKey, ringColor, ringStep, TrayRingIcons, IDLE_COLOR } from '../app/utils/trayRingDrawer.js'

const SIZE = 48
const alphaAt = (rgba, x, y) => rgba[(y * SIZE + x) * 4 + 3]
const white = [255, 255, 255]

describe('drawRing', () => {
  const ring = options => drawRing({ size: SIZE, fraction: 1, paused: false, color: white, ...options })

  it('draws a full ring with an empty middle', () => {
    const rgba = ring({})
    expect(alphaAt(rgba, 24, 3)).to.equal(255)
    expect(alphaAt(rgba, 44, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 44)).to.equal(255)
    expect(alphaAt(rgba, 3, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 24)).to.equal(0)
  })

  it('starts at the top and shortens clockwise: half a ring covers the right side only', () => {
    const rgba = ring({ fraction: 0.5 })
    expect(alphaAt(rgba, 24, 3)).to.equal(255)
    expect(alphaAt(rgba, 44, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 44)).to.equal(255)
    expect(alphaAt(rgba, 3, 24)).to.equal(0)
    expect(alphaAt(rgba, 12, 6)).to.equal(0)
  })

  it('leaves nothing when the time is up', () => {
    const rgba = ring({ fraction: 0 })
    expect(rgba.every((value, index) => index % 4 !== 3 || value === 0)).to.equal(true)
  })

  it('shows a pause symbol in the middle and a faint track where the ring is missing', () => {
    const rgba = ring({ fraction: 0.25, paused: true })
    expect(alphaAt(rgba, 20, 24)).to.equal(255)
    expect(alphaAt(rgba, 27, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 24)).to.equal(0)
    expect(alphaAt(rgba, 3, 24)).to.be.within(60, 100)
  })

  it('shows only the pause symbol and track when no time is known', () => {
    const rgba = ring({ fraction: null, paused: true })
    expect(alphaAt(rgba, 20, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 3)).to.be.within(60, 100)
  })

  it('uses the given colour and works at every icon size', () => {
    const rgba = drawRing({ size: 16, fraction: 1, paused: false, color: [10, 20, 30] })
    expect(Array.from(rgba.slice(0, 3))).to.deep.equal([10, 20, 30])
    expect(rgba.length).to.equal(16 * 16 * 4)
    expect(rgba.some((value, index) => index % 4 === 3 && value === 255)).to.equal(true)
  })
})

describe('ring colour and keys', () => {
  it('moves from the base colour to green as idle time grows', () => {
    expect(ringColor({ base: [0, 0, 0], idleFraction: 0 })).to.deep.equal([0, 0, 0])
    expect(ringColor({ base: [0, 0, 0], idleFraction: 1 })).to.deep.equal(IDLE_COLOR)
    expect(ringColor({ base: [0, 0, 0], idleFraction: 5 })).to.deep.equal(IDLE_COLOR)
    const half = ringColor({ base: [0, 0, 0], idleFraction: 0.5 })
    expect(half[1]).to.be.within(80, 95)
  })

  it('gives the same icon to times within a step and a new one for the next step', () => {
    const base = [0, 0, 0]
    const key = fraction => ringKey({ fraction, paused: false, idleFraction: 0, base })
    expect(key(0.5)).to.equal(key(0.5 + 0.004))
    expect(key(0.5)).to.not.equal(key(0.52))
    expect(ringStep(1)).to.equal(60)
    expect(ringStep(0)).to.equal(0)
  })

  it('tells paused, idle and colour apart', () => {
    const base = [255, 255, 255]
    const keys = new Set([
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0, base }),
      ringKey({ fraction: 0.5, paused: true, idleFraction: 0, base }),
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0.5, base }),
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0, base: [0, 0, 0] })
    ])
    expect(keys.size).to.equal(4)
  })
})

describe('TrayRingIcons', () => {
  let directory

  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'idle-break-ring-')) })
  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  it('writes an icon file once per look and reuses it', () => {
    const icons = new TrayRingIcons(join(directory, 'rings'))
    const request = { fraction: 0.4, paused: false, idleFraction: 0, base: [0, 0, 0] }
    const path = icons.pathFor(request)
    expect(existsSync(path)).to.equal(true)
    expect(readFileSync(path).readUInt16LE(4)).to.equal(6)
    expect(icons.pathFor({ ...request, fraction: 0.401 })).to.equal(path)
    expect(icons.pathFor({ ...request, fraction: 0.8 })).to.not.equal(path)
  })

  it('can draw a paused icon when no time is known', () => {
    const icons = new TrayRingIcons(join(directory, 'rings'))
    expect(existsSync(icons.pathFor({ fraction: null, paused: true, idleFraction: 0, base: [0, 0, 0] }))).to.equal(true)
  })
})
