import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import TrayNumberIcons from '../app/utils/trayNumberIcons.js'

vi.mock('electron-log/main.js', () => ({ default: { error: () => {}, info: () => {} } }))

const frames = [{ size: 16, rgba: new Uint8ClampedArray(16 * 16 * 4) }]
const request = { text: '15', font: 'DejaVu Sans', dark: false, crisp: true, heightRatio: 0.5 }
const settle = () => new Promise(resolve => setTimeout(resolve, 20))

describe('trayNumberIcons', () => {
  let directory

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'stretchly-icons-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('has no icon yet, then writes one and announces it', async () => {
    const render = vi.fn(async () => frames)
    const onReady = vi.fn()
    const icons = new TrayNumberIcons({ directory, render, onReady })

    expect(icons.pathFor(request)).to.equal(null)
    await settle()

    const path = icons.pathFor(request)
    expect(path).to.be.a('string')
    expect(existsSync(path)).to.equal(true)
    expect(readFileSync(path).readUInt16LE(2)).to.equal(1)
    expect(onReady.mock.calls.length).to.equal(1)
  })

  it('passes the number, font, colour and style to the renderer', async () => {
    const render = vi.fn(async () => frames)
    const icons = new TrayNumberIcons({ directory, render, onReady: () => {} })

    icons.pathFor({ ...request, dark: true, crisp: false })
    await settle()

    expect(render.mock.calls[0][0]).to.deep.equal({
      text: '15',
      fontFamily: 'DejaVu Sans',
      color: [255, 255, 255],
      crisp: false,
      heightRatio: 0.5
    })
  })

  it('draws the number in the countdown colour when one is set', async () => {
    const render = vi.fn(async () => frames)
    const icons = new TrayNumberIcons({ directory, render, onReady: () => {} })

    icons.pathFor({ ...request, color: '#ffcc00' })
    await settle()

    expect(render.mock.calls[0][0].color).to.deep.equal([255, 204, 0])
  })

  it('keeps a separate icon for each countdown colour', async () => {
    const render = vi.fn(async () => frames)
    const icons = new TrayNumberIcons({ directory, render, onReady: () => {} })

    icons.pathFor(request)
    icons.pathFor({ ...request, color: '#ffcc00' })
    icons.pathFor({ ...request, color: '#00ccff' })
    await settle()

    expect(render.mock.calls.length).to.equal(3)
  })

  it('draws each number, colour and font only once', async () => {
    const render = vi.fn(async () => frames)
    const icons = new TrayNumberIcons({ directory, render, onReady: () => {} })

    icons.pathFor(request)
    icons.pathFor(request)
    await settle()
    icons.pathFor(request)

    expect(render.mock.calls.length).to.equal(1)

    icons.pathFor({ ...request, dark: true })
    icons.pathFor({ ...request, font: 'Segoe UI' })
    icons.pathFor({ ...request, text: '14' })
    icons.pathFor({ ...request, heightRatio: 0.6 })
    await settle()
    expect(render.mock.calls.length).to.equal(5)
  })

  it('tries again later when the renderer is not ready', async () => {
    let ready = false
    const render = vi.fn(async () => (ready ? frames : null))
    const icons = new TrayNumberIcons({ directory, render, onReady: () => {} })

    expect(icons.pathFor(request)).to.equal(null)
    await settle()
    expect(icons.pathFor(request)).to.equal(null)
    await settle()
    expect(render.mock.calls.length).to.equal(2)

    ready = true
    expect(icons.pathFor(request)).to.equal(null)
    await settle()
    expect(icons.pathFor(request)).to.be.a('string')
  })

  it('gives up on a combination whose drawing failed', async () => {
    const render = vi.fn(async () => { throw new Error('no such font') })
    const onReady = vi.fn()
    const icons = new TrayNumberIcons({ directory, render, onReady })

    icons.pathFor(request)
    await settle()
    expect(icons.pathFor(request)).to.equal(null)
    await settle()

    expect(render.mock.calls.length).to.equal(1)
    expect(onReady.mock.calls.length).to.equal(0)
  })
})
