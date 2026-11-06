import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { encodeIco } from './icoEncoder.js'

export const RING_SIZES = [16, 20, 24, 32, 40, 48]
export const RING_STEPS = 60
export const IDLE_STEPS = 10
export const IDLE_COLOR = [76, 175, 80]

const SUPERSAMPLE = 4
const OUTER_RADIUS = 0.46
const THICKNESS = 0.15
const TRACK_ALPHA = 0.3
const BAR_WIDTH = 0.1
const BAR_GAP = 0.1
const BAR_HEIGHT = 0.34

const clamp01 = value => Math.min(1, Math.max(0, value))

export function ringStep (fraction) {
  return Math.round(clamp01(fraction ?? 0) * RING_STEPS)
}

export function idleStep (idleFraction) {
  return Math.round(clamp01(idleFraction ?? 0) * IDLE_STEPS)
}

export function mixColors (from, to, amount) {
  return from.map((value, index) => Math.round(value + (to[index] - value) * amount))
}

export function drawRing ({ size, fraction, paused, color }) {
  const arc = (fraction === null ? 0 : clamp01(fraction)) * Math.PI * 2
  const rgba = new Uint8ClampedArray(size * size * 4)
  const center = size / 2
  const outer = size * OUTER_RADIUS
  const inner = outer - Math.max(2, size * THICKNESS)
  const barWidth = size * BAR_WIDTH
  const barHalfGap = size * BAR_GAP / 2
  const barHalfHeight = size * BAR_HEIGHT / 2
  const samples = SUPERSAMPLE * SUPERSAMPLE

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alpha = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const dx = x + (sx + 0.5) / SUPERSAMPLE - center
          const dy = y + (sy + 0.5) / SUPERSAMPLE - center
          const radius = Math.hypot(dx, dy)
          if (paused && Math.abs(dy) <= barHalfHeight && Math.abs(dx) >= barHalfGap && Math.abs(dx) <= barHalfGap + barWidth) {
            alpha += 1
          } else if (radius >= inner && radius <= outer) {
            const angle = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)
            if (angle <= arc) alpha += 1
            else if (paused) alpha += TRACK_ALPHA
          }
        }
      }
      const target = (y * size + x) * 4
      rgba[target] = color[0]
      rgba[target + 1] = color[1]
      rgba[target + 2] = color[2]
      rgba[target + 3] = Math.round(alpha / samples * 255)
    }
  }
  return rgba
}

export function ringFrames ({ fraction, paused, color }) {
  return RING_SIZES.map(size => ({ size, rgba: Buffer.from(drawRing({ size, fraction, paused, color })) }))
}

export function ringColor ({ base, idleFraction }) {
  return mixColors(base, IDLE_COLOR, idleStep(idleFraction) / IDLE_STEPS)
}

export function ringKey ({ fraction, paused, idleFraction, base }) {
  return `ring-${paused && fraction === null ? 'x' : ringStep(fraction)}-${paused ? 'p' : 'r'}-${idleStep(idleFraction)}-${base.map(value => value.toString(16).padStart(2, '0')).join('')}`
}

export class TrayRingIcons {
  constructor (directory) {
    this.directory = directory
    this.paths = new Map()
    rmSync(directory, { recursive: true, force: true })
    mkdirSync(directory, { recursive: true })
  }

  pathFor ({ fraction, paused, idleFraction, base }) {
    const key = ringKey({ fraction, paused, idleFraction, base })
    if (!this.paths.has(key)) {
      const path = join(this.directory, `${key}.ico`)
      const quantised = fraction === null ? null : ringStep(fraction) / RING_STEPS
      writeFileSync(path, encodeIco(ringFrames({ fraction: quantised, paused, color: ringColor({ base, idleFraction }) })))
      this.paths.set(key, path)
    }
    return this.paths.get(key)
  }
}
