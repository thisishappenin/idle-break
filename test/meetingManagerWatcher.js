import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import { expect } from 'chai'
import { EventEmitter } from 'events'

const children = []
vi.mock('electron-log/main.js', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
vi.mock('node:child_process', () => ({
  execFile: () => {},
  spawn: () => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.kill = () => {}
    children.push(child)
    return child
  }
}))

const { default: MeetingManager } = await import('../app/utils/meetingManager.js')

const settingsWith = (values) => ({
  get: key => ({ monitorMeetings: false, monitorMeetingsCheckInterval: 5000, monitorMeetingsIgnoreApps: [], ...values })[key]
})

describe('MeetingManager audio session watcher', () => {
  const platform = process.platform

  beforeEach(() => {
    vi.useFakeTimers()
    children.length = 0
    Object.defineProperty(process, 'platform', { value: 'win32' })
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(process, 'platform', { value: platform })
  })

  it('ends the meeting and restarts when the watcher exits mid-call', () => {
    const manager = new MeetingManager(settingsWith({}))
    const events = []
    manager.on('meetingStarted', () => events.push('started'))
    manager.on('meetingFinished', () => events.push('finished'))
    manager.start()
    children[0].stdout.emit('data', 'ACTIVE|ms-teams\n')
    children[0].emit('exit', 1)
    expect(events).to.deep.equal(['started', 'finished'])
    vi.advanceTimersByTime(10000)
    expect(children).to.have.length(2)
    manager.stop()
  })

  it('does not restart after being stopped', () => {
    const manager = new MeetingManager(settingsWith({}))
    manager.start()
    children[0].stdout.emit('data', 'ACTIVE|\n')
    children[0].emit('exit', 1)
    manager.stop()
    vi.advanceTimersByTime(10000)
    expect(children).to.have.length(1)
  })
})
