import { describe, it, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WorkTimeTracker from '../app/utils/workTimeTracker.js'

describe('WorkTimeTracker', () => {
  let directory, filePath, clock

  const tracker = () => new WorkTimeTracker({ filePath, now: () => clock })
  const at = (hour, minute = 0, second = 0, day = 17) => new Date(2026, 10, day, hour, minute, second).getTime()

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'idle-break-work-'))
    filePath = join(directory, 'work-time.json')
    clock = at(9)
  })

  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  const run = (instance, seconds, active, step = 5) => {
    for (let elapsed = 0; elapsed < seconds; elapsed += step) {
      clock += step * 1000
      instance.tick(active)
    }
  }

  it('counts the time between ticks while active and ignores it while not', () => {
    const work = tracker()
    work.tick(true)
    run(work, 60, true)
    run(work, 120, false)
    run(work, 30, true)
    expect(work.todaySeconds()).to.equal(90)
  })

  it('counts nothing for a long gap, such as the computer sleeping', () => {
    const work = tracker()
    work.tick(true)
    run(work, 10, true)
    clock += 3 * 3600 * 1000
    work.tick(true)
    run(work, 10, true)
    expect(work.todaySeconds()).to.equal(20)
  })

  it('starts again from nothing after counting was switched off', () => {
    const work = tracker()
    work.tick(true)
    run(work, 10, true)
    work.stopCounting()
    clock += 20000
    work.tick(true)
    expect(work.todaySeconds()).to.equal(10)
  })

  it('keeps each day separate', () => {
    const work = tracker()
    work.tick(true)
    run(work, 60, true)
    clock = at(0, 0, 0, 18)
    work.tick(true)
    run(work, 30, true)
    expect(work.snapshot()).to.deep.equal({ '2026-11-17': 60, '2026-11-18': 30 })
  })

  it('saves to disk, reloads, and writes no temporary file behind it', () => {
    const work = tracker()
    work.tick(true)
    run(work, 120, true)
    work.save()
    expect(existsSync(`${filePath}.tmp`)).to.equal(false)
    expect(JSON.parse(readFileSync(filePath, 'utf8')).days['2026-11-17']).to.equal(120)
    expect(tracker().todaySeconds()).to.equal(120)
  })

  it('saves by itself about once a minute', () => {
    const work = tracker()
    work.tick(true)
    run(work, 30, true)
    expect(existsSync(filePath)).to.equal(false)
    run(work, 40, true)
    expect(existsSync(filePath)).to.equal(true)
  })

  it('starts empty when the file is missing, damaged or has odd entries', () => {
    expect(tracker().snapshot()).to.deep.equal({})
    writeFileSync(filePath, '{not json')
    expect(tracker().snapshot()).to.deep.equal({})
    writeFileSync(filePath, JSON.stringify({ days: { '2026-11-17': 50, bad: 5, '2026-11-16': -1, '2026-11-15': 'x' } }))
    expect(tracker().snapshot()).to.deep.equal({ '2026-11-17': 50 })
  })

  it('says the goal was reached once per day and goal, and again if the goal changes', () => {
    const work = tracker()
    work.tick(true)
    run(work, 100, true)
    expect(work.shouldNotifyGoal(120)).to.equal(false)
    run(work, 30, true)
    expect(work.shouldNotifyGoal(120)).to.equal(true)
    expect(work.shouldNotifyGoal(120)).to.equal(false)
    expect(work.shouldNotifyGoal(100)).to.equal(true)
    work.save()
    expect(tracker().shouldNotifyGoal(100)).to.equal(false)
  })

  it('does not announce a goal of zero', () => {
    const work = tracker()
    work.tick(true)
    run(work, 60, true)
    expect(work.shouldNotifyGoal(0)).to.equal(false)
  })
})
