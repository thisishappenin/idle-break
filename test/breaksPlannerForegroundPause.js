import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'

vi.mock('electron', () => ({ powerMonitor: { getSystemIdleTime: () => 0 }, app: { getPath: () => '' } }))
vi.mock('node-desktop-idle-v2', () => ({ desktopIdle: { startMonitoring: () => {}, stopMonitoring: () => {}, getIdleTime: () => 0 } }))
vi.mock('windows-focus-assist', () => ({ getFocusAssist: () => ({ value: 0 }) }))
vi.mock('../app/utils/appExclusionsManager.js', async () => {
  const { EventEmitter } = await import('events')
  return {
    default: class extends EventEmitter {
      isOnAppExclusion = false
      stop () {}
      reset () {}
      reinitialize () {}
    }
  }
})

const { default: BreaksPlanner } = await import('../app/breaksPlanner.js')

const MINUTE = 60000
const settings = {
  get: (key) => ({
    break: false,
    microbreak: true,
    microbreakInterval: 40 * MINUTE,
    microbreakDuration: 20000,
    microbreakNotification: false,
    monitorMeetings: false,
    monitorMeetingsCheckInterval: 5000,
    meetingBreakDelay: 5000,
    naturalBreaks: false,
    naturalBreaksCheckInterval: 2000,
    monitorDnd: false
  })[key]
}

describe('breaksPlanner pausing for an app in front', () => {
  let planner

  beforeEach(() => {
    vi.useFakeTimers()
    planner = new BreaksPlanner(settings)
    planner.nextBreak()
  })

  afterEach(() => {
    planner.clear()
    vi.useRealTimers()
  })

  it('pauses the countdown to the next break when a listed app comes to the front', () => {
    const manager = planner.appExclusionsManager
    manager.isOnAppExclusion = true
    const clear = vi.spyOn(planner, 'clear')
    manager.emit('appExclusionStarted', 'pause', 'gmail', { foreground: true })
    expect(clear).toHaveBeenCalledTimes(1)
    expect(manager.isOnAppExclusion).to.equal(true)
  })

  it('keeps a running break counting down when the match is an app in front', () => {
    const manager = planner.appExclusionsManager
    planner.emit('microbreakStarted', false)
    expect(planner.scheduler.reference).to.equal('finishMicrobreak')
    const before = planner.scheduler
    const clear = vi.spyOn(planner, 'clear')

    manager.isOnAppExclusion = true
    manager.emit('appExclusionStarted', 'pause', 'gmail', { foreground: true })

    expect(clear).not.toHaveBeenCalled()
    expect(planner.scheduler).to.equal(before)
    expect(planner.scheduler.reference).to.equal('finishMicrobreak')
    expect(manager.isOnAppExclusion).to.equal(false)
  })

  it('still ends a running break when a pause-listed program is running', () => {
    const manager = planner.appExclusionsManager
    planner.emit('microbreakStarted', false)
    const finished = []
    planner.on('finishMicrobreak', (...args) => finished.push(args))

    manager.isOnAppExclusion = true
    manager.emit('appExclusionStarted', 'pause', 'vlc.exe', { foreground: false })

    expect(finished).to.have.length(1)
  })
})
