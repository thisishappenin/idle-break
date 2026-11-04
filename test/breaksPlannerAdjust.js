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
    monitorDnd: false
  })[key]
}

describe('breaksPlanner work session adjustment', () => {
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

  it('shortens the next work session in 5 minute steps', () => {
    for (let i = 0; i < 4; i++) {
      expect(planner.adjustWorkSession(-5 * MINUTE)).to.equal(true)
    }
    expect(planner.scheduler.timeLeft).to.be.closeTo(20 * MINUTE, 1000)
  })

  it('extends the next work session', () => {
    planner.adjustWorkSession(5 * MINUTE)
    expect(planner.scheduler.timeLeft).to.be.closeTo(45 * MINUTE, 1000)
  })

  it('keeps the same scheduled break', () => {
    const reference = planner.scheduler.reference
    planner.adjustWorkSession(-5 * MINUTE)
    expect(planner.scheduler.reference).to.equal(reference)
  })

  it('applies to one session only', () => {
    planner.adjustWorkSession(-20 * MINUTE)
    planner.nextBreak()
    expect(planner.scheduler.timeLeft).to.be.closeTo(40 * MINUTE, 1000)
  })

  it('does not shorten below a second', () => {
    planner.adjustWorkSession(-100 * MINUTE)
    expect(planner.scheduler.timeLeft).to.be.within(0, 1000)
  })

  it('starts the break at the adjusted time', () => {
    let started = false
    planner.on('startMicrobreak', () => { started = true })
    planner.adjustWorkSession(-30 * MINUTE)
    vi.advanceTimersByTime(9 * MINUTE)
    expect(started).to.equal(false)
    vi.advanceTimersByTime(1.5 * MINUTE)
    expect(started).to.equal(true)
  })

  it('updates the tooltip', () => {
    let updated = false
    planner.on('updateToolTip', () => { updated = true })
    planner.adjustWorkSession(-5 * MINUTE)
    expect(updated).to.equal(true)
  })

  it('does nothing while paused', () => {
    planner.pause(30 * MINUTE)
    expect(planner.adjustWorkSession(-5 * MINUTE)).to.equal(false)
  })

  it('does nothing during a break', () => {
    planner.emit('microbreakStarted', false)
    expect(planner.adjustWorkSession(-5 * MINUTE)).to.equal(false)
  })

  it('does nothing when no break is scheduled', () => {
    planner.clear()
    expect(planner.adjustWorkSession(-5 * MINUTE)).to.equal(false)
  })
})
