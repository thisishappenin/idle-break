import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { encodeIco } from './icoEncoder.js'

export const RING_SIZES = [16, 20, 24, 32, 40, 48]
export const RING_STEPS = 60
export const IDLE_STEPS = 10
export const DEFAULT_IDLE_COLOR = [229, 57, 53]
export const DEFAULT_THICKNESS = 0.22

const SUPERSAMPLE = 4
const OUTER_RADIUS = 0.48
const TRACK_ALPHA = 0.3
const DOT_RADIUS = 0.4
const BAR_WIDTH = 0.4
const BAR_HALF_GAP = 0.22
const BAR_HALF_HEIGHT = 0.62

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

export function drawRing ({ size, fraction, paused, color, thickness = DEFAULT_THICKNESS }) {
  const arc = (fraction === null ? 0 : clamp01(fraction)) * Math.PI * 2
  const waiting = !paused && arc === 0
  const showTrack = paused || waiting
  const rgba = new Uint8ClampedArray(size * size * 4)
  const center = size / 2
  const outer = size * OUTER_RADIUS
  const inner = outer - Math.max(2, size * thickness)
  const barWidth = inner * BAR_WIDTH
  const barHalfGap = inner * BAR_HALF_GAP
  const barHalfHeight = inner * BAR_HALF_HEIGHT
  const dotRadius = inner * DOT_RADIUS
  const samples = SUPERSAMPLE * SUPERSAMPLE

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alpha = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const dx = x + (sx + 0.5) / SUPERSAMPLE - center
          const dy = y + (sy + 0.5) / SUPERSAMPLE - center
          const radius = Math.hypot(dx, dy)
          if (waiting && radius <= dotRadius) {
            alpha += 1
          } else if (paused && Math.abs(dy) <= barHalfHeight && Math.abs(dx) >= barHalfGap && Math.abs(dx) <= barHalfGap + barWidth) {
            alpha += 1
          } else if (radius >= inner && radius <= outer) {
            const angle = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)
            if (angle >= Math.PI * 2 - arc) alpha += 1
            else if (showTrack) alpha += TRACK_ALPHA
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

export function ringFrames ({ fraction, paused, color, thickness }) {
  return RING_SIZES.map(size => ({ size, rgba: Buffer.from(drawRing({ size, fraction, paused, color, thickness })) }))
}

export function ringColor ({ base, idleFraction, idleColor = null }) {
  return idleColor ? mixColors(base, idleColor, idleStep(idleFraction) / IDLE_STEPS) : base
}

const hex = color => color.map(value => value.toString(16).padStart(2, '0')).join('')

export function ringKey ({ fraction, paused, idleFraction, base, idleColor = null, thickness = DEFAULT_THICKNESS }) {
  const idle = idleColor ? `${idleStep(idleFraction)}${hex(idleColor)}` : 'n'
  return `ring-${paused && fraction === null ? 'x' : ringStep(fraction)}-${paused ? 'p' : 'r'}-${idle}-${hex(base)}-t${Math.round(thickness * 100)}`
}

export class TrayRingIcons {
  constructor (directory) {
    this.directory = directory
    this.paths = new Map()
    rmSync(directory, { recursive: true, force: true })
    mkdirSync(directory, { recursive: true })
  }

  pathFor ({ fraction, paused, idleFraction, base, idleColor = null, thickness = DEFAULT_THICKNESS }) {
    const key = ringKey({ fraction, paused, idleFraction, base, idleColor, thickness })
    if (!this.paths.has(key)) {
      const path = join(this.directory, `${key}.ico`)
      const quantised = fraction === null ? null : ringStep(fraction) / RING_STEPS
      writeFileSync(path, encodeIco(ringFrames({ fraction: quantised, paused, thickness, color: ringColor({ base, idleFraction, idleColor }) })))
      this.paths.set(key, path)
    }
    return this.paths.get(key)
  }
}
