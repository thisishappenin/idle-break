import { describe, it, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateLegacyUserData } from '../app/utils/legacyUserData.js'

describe('migrateLegacyUserData', () => {
  let root, from, to

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'idle-break-migrate-'))
    from = join(root, 'Stretchly')
    to = join(root, 'Idle Break')
    mkdirSync(from)
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('copies settings, images and audio from the old folder', () => {
    writeFileSync(join(from, 'config.json'), '{"breakDuration":60000}')
    mkdirSync(join(from, 'images'))
    writeFileSync(join(from, 'images', 'a.png'), 'png')
    mkdirSync(join(from, 'audio'))
    writeFileSync(join(from, 'audio', 'a.mp3'), 'mp3')
    writeFileSync(join(from, 'log.txt'), 'not copied')

    expect(migrateLegacyUserData(from, to)).to.deep.equal(['config.json', 'images', 'audio'])
    expect(readFileSync(join(to, 'config.json'), 'utf8')).to.equal('{"breakDuration":60000}')
    expect(existsSync(join(to, 'images', 'a.png'))).to.equal(true)
    expect(existsSync(join(to, 'audio', 'a.mp3'))).to.equal(true)
    expect(existsSync(join(to, 'log.txt'))).to.equal(false)
    expect(existsSync(join(from, 'config.json'))).to.equal(true)
  })

  it('does nothing when there is no old settings file', () => {
    expect(migrateLegacyUserData(from, to)).to.deep.equal([])
    expect(existsSync(to)).to.equal(false)
  })

  it('never overwrites settings that already exist in the new folder', () => {
    writeFileSync(join(from, 'config.json'), '{"old":true}')
    mkdirSync(to)
    writeFileSync(join(to, 'config.json'), '{"new":true}')

    expect(migrateLegacyUserData(from, to)).to.deep.equal([])
    expect(readFileSync(join(to, 'config.json'), 'utf8')).to.equal('{"new":true}')
  })
})
