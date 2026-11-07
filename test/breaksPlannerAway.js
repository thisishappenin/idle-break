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

  it('still carries on after lock followed by sleep, which holds the countdown twice', () => {
    start()
    expect(planner.holdForAway()).to.equal(true)
    expect(planner.holdForAway()).to.equal(true)
    vi.advanceTimersByTime(MINUTE)
    expect(planner.returnFromAway(MINUTE)).to.equal('resumed')
    expect(planner.scheduler.held).to.equal(false)
    expect(planner.scheduler.timeLeft).to.be.within(30 * MINUTE - 100, 30 * MINUTE)
  })

  it('releases a countdown that nothing is holding any more', () => {
    start()
    planner.scheduler.hold()
    expect(planner.releaseOrphanedHold()).to.equal(true)
    expect(planner.scheduler.held).to.equal(false)
    expect(planner.scheduler.timeLeft).to.be.within(30 * MINUTE - 100, 30 * MINUTE)
  })

  it('leaves a countdown alone while it is held on purpose', () => {
    start()
    planner.holdForAway()
    expect(planner.releaseOrphanedHold()).to.equal(false)
    expect(planner.scheduler.held).to.equal(true)
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

describe('breaksPlanner remaining fraction for the tray ring', () => {
  let planner

  beforeEach(() => {
    vi.useFakeTimers()
    planner = new BreaksPlanner(settingsWith())
    planner.nextBreak()
  })

  afterEach(() => {
    planner.clear()
    vi.useRealTimers()
  })

  it('shrinks from 1 towards 0 as the break gets closer', () => {
    expect(planner.remainingFraction).to.equal(1)
    vi.advanceTimersByTime(10 * MINUTE)
    expect(planner.remainingFraction).to.be.within(0.749, 0.751)
    vi.advanceTimersByTime(30 * MINUTE - 1)
    expect(planner.remainingFraction).to.be.below(0.001)
  })

  it('keeps counting against the full length after a pause instead of jumping back to a full ring', () => {
    vi.advanceTimersByTime(10 * MINUTE)
    planner.holdForAway()
    vi.advanceTimersByTime(60 * MINUTE)
    planner.returnFromAway(MINUTE)
    expect(planner.remainingFraction).to.be.within(0.749, 0.751)
    vi.advanceTimersByTime(10 * MINUTE)
    expect(planner.remainingFraction).to.be.within(0.499, 0.501)
  })

  it('is based on the default interval, so a countdown set shorter starts as a short ring, not a full one', () => {
    expect(planner.adjustWorkSession(-35 * MINUTE)).to.equal(true)
    expect(planner.remainingFraction).to.be.within(0.1249, 0.1251)
    vi.advanceTimersByTime(MINUTE)
    expect(planner.remainingFraction).to.be.within(0.0999, 0.1001)
  })

  it('stays full when a session is extended past the default interval until it falls below it', () => {
    planner.adjustWorkSession(5 * MINUTE)
    expect(planner.remainingFraction).to.equal(1)
    vi.advanceTimersByTime(10 * MINUTE)
    expect(planner.remainingFraction).to.be.within(0.874, 0.876)
  })

  it('uses the default interval of a long-breaks-only schedule', () => {
    planner.clear()
    planner = new BreaksPlanner(settingsWith({ break: true, microbreak: false, breakInterval: 2, breakNotification: false }))
    planner.nextBreak()
    expect(planner.defaultInterval).to.equal(120 * MINUTE)
    expect(planner.remainingFraction).to.equal(1)
    vi.advanceTimersByTime(60 * MINUTE)
    expect(planner.remainingFraction).to.be.within(0.499, 0.501)
  })

  it('has no fraction during a break, and no countdown when nothing is scheduled', () => {
    planner.emit('microbreakStarted', false)
    expect(planner.remainingFraction).to.equal(null)
  })

  it('remembers where the ring was when idle time cleared the countdown', () => {
    vi.advanceTimersByTime(20 * MINUTE)
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    expect(planner.remainingFraction).to.be.within(0.499, 0.501)
  })
})
