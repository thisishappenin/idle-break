import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import BreaksPlanner from '../app/breaksPlanner.js'

vi.mock('electron', () => ({ powerMonitor: { getSystemIdleTime: () => 0 }, app: { getPath: () => '' } }))
vi.mock('node-desktop-idle-v2', () => ({ desktopIdle: { startMonitoring: () => {}, stopMonitoring: () => {}, getIdleTime: () => 0 } }))
vi.mock('windows-focus-assist', () => ({ getFocusAssist: () => ({ value: 0 }) }))
vi.mock('../app/utils/appExclusionsManager.js', () => ({
  default: class { on () {} stop () {} reset () {} reinitialize () {} }
}))

const MINUTE = 60000
const settings = {
  get: (key) => ({
    break: false,
    microbreak: true,
    microbreakInterval: 40 * MINUTE,
    microbreakNotification: false,
    monitorMeetings: false,
    monitorMeetingsCheckInterval: 5000,
    meetingBreakDelay: 5000,
    naturalBreaks: false,
    naturalBreaksCheckInterval: 2000,
    naturalBreaksResetNotificationMaxIdleTime: 10 * MINUTE,
    monitorDnd: false
  })[key]
}

describe('breaksPlanner waiting for usage after a break', () => {
  let planner
  let idle

  beforeEach(() => {
    vi.useFakeTimers()
    idle = 0
    planner = new BreaksPlanner(settings)
    planner.nextBreak()
    planner.naturalBreaksManager.usingNaturalBreaks = true
    Object.defineProperty(planner.naturalBreaksManager, 'idleTime', { get: () => idle, configurable: true })
  })

  afterEach(() => {
    planner.clear()
    vi.useRealTimers()
  })

  it('keeps the full countdown frozen after a break while the user is away', () => {
    idle = 30000
    planner.nextBreakAfterBreak()
    expect(planner.scheduler.held).to.equal(true)
    vi.advanceTimersByTime(10 * MINUTE)
    expect(planner.scheduler.timeLeft).to.equal(40 * MINUTE)
    expect(planner.timeToNextBreak).to.equal(40 * MINUTE)
  })

  it('does not start the next break while waiting', () => {
    let started = false
    planner.on('startMicrobreak', () => { started = true })
    idle = 30000
    planner.nextBreakAfterBreak()
    vi.advanceTimersByTime(90 * MINUTE)
    expect(started).to.equal(false)
  })

  it('starts counting down once there is usage', () => {
    idle = 30000
    planner.nextBreakAfterBreak()
    vi.advanceTimersByTime(10 * MINUTE)
    idle = 0
    vi.advanceTimersByTime(2000)
    expect(planner.scheduler.held).to.equal(false)
    expect(planner.scheduler.timeLeft).to.be.closeTo(40 * MINUTE, 1000)
    vi.advanceTimersByTime(10 * MINUTE)
    expect(planner.scheduler.timeLeft).to.be.closeTo(30 * MINUTE, 1000)
  })

  it('counts down straight away when the user is already active', () => {
    idle = 1000
    planner.nextBreakAfterBreak()
    expect(planner.scheduler.held).to.equal(false)
    vi.advanceTimersByTime(MINUTE)
    expect(planner.scheduler.timeLeft).to.be.closeTo(39 * MINUTE, 1000)
  })

  it('counts down straight away when idle monitoring is off', () => {
    planner.naturalBreaksManager.usingNaturalBreaks = false
    idle = 30000
    planner.nextBreakAfterBreak()
    expect(planner.scheduler.held).to.equal(false)
  })

  it('keeps the countdown when the idle time passes the reset time', () => {
    idle = 30000
    planner.nextBreakAfterBreak()
    planner.naturalBreaksManager.isSchedulerCleared = true
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    expect(planner.scheduler.held).to.equal(true)
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
    expect(planner.naturalBreaksManager.isSchedulerCleared).to.equal(false)
  })

  it('resumes without announcing a reset when the user returns', () => {
    let announced = false
    planner.on('idleReset', () => { announced = true })
    idle = 6 * MINUTE
    planner.nextBreakAfterBreak()
    planner.naturalBreaksManager.emit('naturalBreakFinished', 6 * MINUTE)
    expect(planner.scheduler.held).to.equal(false)
    expect(announced).to.equal(false)
  })

  it('does not announce a reset when a break happened during the idle time', () => {
    let announced = false
    planner.on('idleReset', () => { announced = true })
    idle = 30000
    planner.nextBreakAfterBreak()
    vi.advanceTimersByTime(2 * MINUTE)
    idle = 0
    vi.advanceTimersByTime(2000)
    planner.naturalBreaksManager.emit('naturalBreakFinished', 6 * MINUTE)
    expect(announced).to.equal(false)
  })

  it('restarts the countdown when the user returns after a break, a lock and an idle pause', () => {
    let announced = false
    planner.on('idleReset', () => { announced = true })
    idle = 30000
    planner.nextBreakAfterBreak()
    planner.pause(1)
    vi.advanceTimersByTime(20 * MINUTE)
    planner.resume()
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    expect(planner.scheduler.reference).to.equal(null)
    vi.advanceTimersByTime(3 * MINUTE)
    planner.naturalBreaksManager.emit('naturalBreakFinished', 23 * MINUTE)
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
    expect(planner.scheduler.timeLeft).to.be.closeTo(40 * MINUTE, 1000)
    expect(announced).to.equal(false)
  })

  it('restarts the countdown without a popup when a break happened during a short absence', () => {
    let announced = false
    planner.on('idleReset', () => { announced = true })
    idle = 30000
    planner.nextBreakAfterBreak()
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    planner.naturalBreaksManager.isSchedulerCleared = true
    vi.advanceTimersByTime(7 * MINUTE)
    planner.resumeAfterUsage()
    planner.clear()
    planner.naturalBreaksManager.emit('naturalBreakFinished', 7 * MINUTE)
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
    expect(announced).to.equal(false)
  })

  it('still announces a reset when the idle time had no break', () => {
    let announced = false
    planner.on('idleReset', () => { announced = true })
    planner.nextBreakAfterBreak()
    vi.advanceTimersByTime(30 * MINUTE)
    planner.naturalBreaksManager.emit('naturalBreakFinished', 6 * MINUTE)
    expect(announced).to.equal(true)
  })

  it('stops waiting when the breaks are cleared', () => {
    idle = 30000
    planner.nextBreakAfterBreak()
    planner.clear()
    expect(planner.isHoldingForUsage).to.equal(false)
    idle = 0
    vi.advanceTimersByTime(10000)
    expect(planner.scheduler.held).to.equal(false)
  })

  it('lets the work session be adjusted while waiting', () => {
    idle = 30000
    planner.nextBreakAfterBreak()
    expect(planner.adjustWorkSession(-5 * MINUTE)).to.equal(true)
    expect(planner.scheduler.timeLeft).to.equal(35 * MINUTE)
  })
})
