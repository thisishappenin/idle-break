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
const settingsWith = (values = {}) => ({
  get: (key) => ({
    break: false,
    microbreak: true,
    microbreakInterval: 40 * MINUTE,
    microbreakDuration: 20000,
    microbreakNotification: false,
    monitorMeetings: false,
    monitorMeetingsCheckInterval: 5000,
    meetingBreakDelay: 5000,
    naturalBreaks: true,
    naturalBreaksCheckInterval: 2000,
    naturalBreaksInactivityResetTime: 5 * MINUTE,
    naturalBreaksResetNotificationMaxIdleTime: 10 * MINUTE,
    monitorDnd: false,
    ...values
  })[key]
})

describe('breaksPlanner while the computer is locked or asleep', () => {
  let planner

  const start = (values) => {
    planner = new BreaksPlanner(settingsWith(values))
    planner.nextBreak()
    vi.advanceTimersByTime(10 * MINUTE)
  }

  beforeEach(() => { vi.useFakeTimers() })

  afterEach(() => {
    planner.clear()
    vi.useRealTimers()
  })

  it('freezes the countdown while away and carries on from the same point after a short absence', () => {
    start()
    expect(planner.holdForAway()).to.equal(true)
    vi.advanceTimersByTime(3 * MINUTE)
    expect(planner.scheduler.timeLeft).to.equal(30 * MINUTE)

    expect(planner.returnFromAway(3 * MINUTE)).to.equal('resumed')
    expect(planner.scheduler.held).to.equal(false)
    expect(planner.scheduler.timeLeft).to.be.within(30 * MINUTE - 100, 30 * MINUTE)
  })

  it('starts a fresh countdown when the absence was longer than the idle reset time', () => {
    start()
    planner.holdForAway()
    vi.advanceTimersByTime(20 * MINUTE)

    expect(planner.returnFromAway(20 * MINUTE)).to.equal('reset')
    expect(planner.scheduler.timeLeft).to.be.within(40 * MINUTE - 100, 40 * MINUTE)
  })

  it('treats exactly the idle reset time as a short absence', () => {
    start()
    planner.holdForAway()
    expect(planner.returnFromAway(5 * MINUTE)).to.equal('resumed')
  })

  it('never resets when resetting after idle time is turned off', () => {
    start({ naturalBreaks: false })
    planner.holdForAway()
    expect(planner.returnFromAway(12 * 60 * MINUTE)).to.equal('resumed')
    expect(planner.scheduler.timeLeft).to.be.within(30 * MINUTE - 100, 30 * MINUTE)
  })

  it('keeps the countdown frozen when the idle monitor reports a long idle time during the lock', () => {
    start()
    planner.holdForAway()
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    expect(planner.scheduler.held).to.equal(true)
    expect(planner.scheduler.timeLeft).to.equal(30 * MINUTE)
  })

  it('leaves a running break to the normal pause when locked mid-break', () => {
    start()
    planner.emit('microbreakStarted', false)
    expect(planner.holdForAway()).to.equal(false)
  })
})
