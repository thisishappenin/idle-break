import { describe, it, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drawRing, ringKey, ringColor, ringStep, TrayRingIcons, DEFAULT_IDLE_COLOR } from '../app/utils/trayRingDrawer.js'

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

  it('empties clockwise from the top: half a ring is the left half, and the end stays at the top', () => {
    const rgba = ring({ fraction: 0.5 })
    expect(alphaAt(rgba, 3, 24)).to.equal(255)
    expect(alphaAt(rgba, 23, 44)).to.equal(255)
    expect(alphaAt(rgba, 12, 6)).to.equal(255)
    expect(alphaAt(rgba, 23, 3)).to.equal(255)
    expect(alphaAt(rgba, 44, 24)).to.equal(0)
    expect(alphaAt(rgba, 36, 6)).to.equal(0)
  })

  it('a quarter ring is the top left, so the used part has grown clockwise over the right side first', () => {
    const rgba = ring({ fraction: 0.25 })
    expect(alphaAt(rgba, 12, 6)).to.equal(255)
    expect(alphaAt(rgba, 36, 6)).to.equal(0)
    expect(alphaAt(rgba, 44, 24)).to.equal(0)
    expect(alphaAt(rgba, 36, 42)).to.equal(0)
  })

  it('shows a faint ring with a dot in the middle when the time is up, never a blank icon', () => {
    const rgba = ring({ fraction: 0 })
    expect(alphaAt(rgba, 24, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 3)).to.be.within(60, 100)
    expect(alphaAt(rgba, 3, 24)).to.be.within(60, 100)
    expect(alphaAt(rgba, 24, 14)).to.equal(0)
  })

  it('is never fully transparent at any size or step, which Windows would paint as a solid square', () => {
    for (const size of [16, 20, 24, 32, 40, 48]) {
      for (const fraction of [0, 0.004, 0.02, 0.5, 1, null]) {
        for (const paused of [false, true]) {
          if (fraction === null && !paused) continue
          const rgba = drawRing({ size, fraction, paused, color: white })
          let any = false
          for (let index = 3; index < rgba.length; index += 4) if (rgba[index] > 0) any = true
          expect(any, `${size}px fraction ${fraction} paused ${paused}`).to.equal(true)
        }
      }
    }
  })

  it('shows a pause symbol in the middle and a faint track where the ring is missing', () => {
    const rgba = ring({ fraction: 0.25, paused: true })
    expect(alphaAt(rgba, 20, 24)).to.equal(255)
    expect(alphaAt(rgba, 27, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 24)).to.equal(0)
    expect(alphaAt(rgba, 12, 6)).to.equal(255)
    expect(alphaAt(rgba, 44, 24)).to.be.within(60, 100)
  })

  it('shows only the pause symbol and track when no time is known', () => {
    const rgba = ring({ fraction: null, paused: true })
    expect(alphaAt(rgba, 20, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 3)).to.be.within(60, 100)
  })

  it('draws a thicker ring when asked to', () => {
    const thin = ring({ thickness: 0.1 })
    const thick = ring({ thickness: 0.3 })
    expect(alphaAt(thin, 24, 8)).to.equal(0)
    expect(alphaAt(thick, 24, 8)).to.equal(255)
    expect(alphaAt(thick, 24, 24)).to.equal(0)
  })

  it('is thicker by default than a thin line, so it is easy to see at 16 pixels', () => {
    const rgba = drawRing({ size: 16, fraction: 1, paused: false, color: white })
    const opaque = []
    for (let x = 0; x < 16; x++) if (rgba[(8 * 16 + x) * 4 + 3] >= 128) opaque.push(x)
    expect(opaque.filter(x => x < 8).length).to.be.at.least(3)
  })

  it('keeps the pause symbol inside even the thickest ring', () => {
    const rgba = ring({ fraction: 0.5, paused: true, thickness: 0.35 })
    expect(alphaAt(rgba, 21, 24)).to.equal(255)
    expect(alphaAt(rgba, 26, 24)).to.equal(255)
    expect(alphaAt(rgba, 24, 24)).to.equal(0)
    expect(alphaAt(rgba, 3, 24)).to.equal(255)
  })

  it('uses the given colour and works at every icon size', () => {
    const rgba = drawRing({ size: 16, fraction: 1, paused: false, color: [10, 20, 30] })
    expect(Array.from(rgba.slice(0, 3))).to.deep.equal([10, 20, 30])
    expect(rgba.length).to.equal(16 * 16 * 4)
    expect(rgba.some((value, index) => index % 4 === 3 && value === 255)).to.equal(true)
  })
})

describe('ring colour and keys', () => {
  it('moves from the base colour to the idle colour as idle time grows', () => {
    const idleColor = [200, 40, 30]
    expect(ringColor({ base: [0, 0, 0], idleFraction: 0, idleColor })).to.deep.equal([0, 0, 0])
    expect(ringColor({ base: [0, 0, 0], idleFraction: 1, idleColor })).to.deep.equal(idleColor)
    expect(ringColor({ base: [0, 0, 0], idleFraction: 5, idleColor })).to.deep.equal(idleColor)
    expect(ringColor({ base: [0, 0, 0], idleFraction: 0.5, idleColor })).to.deep.equal([100, 20, 15])
  })

  it('keeps the base colour when no idle colour is set', () => {
    expect(ringColor({ base: [255, 255, 255], idleFraction: 1 })).to.deep.equal([255, 255, 255])
    expect(ringColor({ base: [255, 255, 255], idleFraction: 1, idleColor: null })).to.deep.equal([255, 255, 255])
  })

  it('defaults the idle colour to red', () => {
    expect(DEFAULT_IDLE_COLOR[0]).to.be.above(200)
    expect(DEFAULT_IDLE_COLOR[1]).to.be.below(80)
    expect(DEFAULT_IDLE_COLOR[2]).to.be.below(80)
  })

  it('gives the same icon to times within a step and a new one for the next step', () => {
    const base = [0, 0, 0]
    const key = fraction => ringKey({ fraction, paused: false, idleFraction: 0, base })
    expect(key(0.5)).to.equal(key(0.5 + 0.004))
    expect(key(0.5)).to.not.equal(key(0.52))
    expect(ringStep(1)).to.equal(60)
    expect(ringStep(0)).to.equal(0)
  })

  it('tells thickness and idle colour apart', () => {
    const base = [0, 0, 0]
    const keys = new Set([
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0.5, base, idleColor: [200, 0, 0], thickness: 0.2 }),
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0.5, base, idleColor: [200, 0, 0], thickness: 0.3 }),
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0.5, base, idleColor: [0, 0, 200], thickness: 0.2 }),
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0.5, base, idleColor: null, thickness: 0.2 })
    ])
    expect(keys.size).to.equal(4)
  })

  it('ignores idle time in the key when there is no idle colour', () => {
    const base = [0, 0, 0]
    expect(ringKey({ fraction: 0.5, paused: false, idleFraction: 0, base })).to.equal(ringKey({ fraction: 0.5, paused: false, idleFraction: 1, base }))
  })

  it('tells paused, idle and colour apart', () => {
    const base = [255, 255, 255]
    const keys = new Set([
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0, base }),
      ringKey({ fraction: 0.5, paused: true, idleFraction: 0, base }),
      ringKey({ fraction: 0.5, paused: false, idleFraction: 0.5, base, idleColor: [200, 0, 0] }),
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
