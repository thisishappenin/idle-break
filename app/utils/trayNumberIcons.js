import { createHash } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import log from 'electron-log/main.js'
import { encodeIco } from './icoEncoder.js'
import { hexToRgb } from './countdownColor.js'

class TrayNumberIcons {
  constructor ({ directory, render, onReady }) {
    this.directory = directory
    this.render = render
    this.onReady = onReady
    this.ready = new Map()
    this.pending = new Set()
    this.failed = new Set()
    rmSync(directory, { recursive: true, force: true })
    mkdirSync(directory, { recursive: true })
  }

  keyFor ({ text, font, dark, crisp, heightRatio, color }) {
    const fontHash = createHash('sha1').update(font).digest('hex').slice(0, 8)
    return `n${text}-${dark ? 'dark' : 'light'}-${crisp ? 'crisp' : 'smooth'}-h${Math.round(heightRatio * 100)}-c${color ? color.slice(1) : 'auto'}-${fontHash}`
  }

  pathFor (request) {
    const key = this.keyFor(request)
    if (this.ready.has(key)) return this.ready.get(key)
    if (!this.pending.has(key) && !this.failed.has(key)) {
      this.pending.add(key)
      this.create(key, request)
    }
    return null
  }

  async create (key, { text, font, dark, crisp, heightRatio, color: custom }) {
    try {
      const color = custom ? hexToRgb(custom) : dark ? [255, 255, 255] : [0, 0, 0]
      const frames = await this.render({ text, fontFamily: font, color, crisp, heightRatio })
      if (!frames) return
      const path = join(this.directory, `${key}.ico`)
      await writeFile(path, encodeIco(frames.map(({ size, rgba }) => ({ size, rgba: Buffer.from(rgba) }))))
      this.ready.set(key, path)
      this.onReady()
    } catch (exception) {
      this.failed.add(key)
      log.error(`Stretchly: could not draw tray icon "${text}" with font "${font}"`, exception)
    } finally {
      this.pending.delete(key)
    }
  }
}

export default TrayNumberIcons
