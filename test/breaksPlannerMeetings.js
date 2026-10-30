import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import BreaksPlanner from '../app/breaksPlanner.js'

vi.mock('electron', () => ({ powerMonitor: { getSystemIdleTime: () => 0 }, app: { getPath: () => '' } }))
vi.mock('node-desktop-idle-v2', () => ({ desktopIdle: { startMonitoring: () => {}, stopMonitoring: () => {}, getIdleTime: () => 0 } }))
vi.mock('windows-focus-assist', () => ({ getFocusAssist: () => ({ value: 0 }) }))
vi.mock('@particle/dbus-next', () => ({ default: { sessionBus: () => ({ on: () => {}, disconnect: () => {} }) } }))
vi.mock('../app/utils/appExclusionsManager.js', () => ({
  default: class { on () {} stop () {} reset () {} reinitialize () {} }
}))

const settings = {
  get: (key) => ({
    break: false,
    microbreak: true,
    microbreakInterval: 60000,
    microbreakNotification: false,
    monitorMeetings: false,
    monitorMeetingsCheckInterval: 5000,
    meetingBreakDelay: 5000,
    naturalBreaks: false,
    monitorDnd: false
  })[key]
}

describe('breaksPlanner meetings', () => {
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

  it('does not defer a break when no meeting is running', () => {
    expect(planner.deferBreakForMeeting('startMicrobreak')).to.equal(false)
  })

  it('defers a due break during a meeting and releases it when the meeting ends', () => {
    const started = []
    planner.on('startMicrobreak', () => started.push('startMicrobreak'))
    planner.meetingManager.isInMeeting = true
    expect(planner.deferBreakForMeeting('startMicrobreak')).to.equal(true)
    expect(started).to.have.length(0)
    planner.meetingManager.emit('meetingFinished')
    expect(started).to.have.length(0)
    vi.advanceTimersByTime(5000)
    expect(started).to.deep.equal(['startMicrobreak'])
  })

  it('turns a deferred break notification into the break itself', () => {
    const started = []
    planner.on('startBreak', () => started.push('startBreak'))
    planner.meetingManager.isInMeeting = true
    planner.deferBreakForMeeting('startBreakNotification')
    planner.meetingManager.emit('meetingFinished')
    vi.advanceTimersByTime(5000)
    expect(started).to.deep.equal(['startBreak'])
  })

  it('suspends idle detection while a meeting runs', () => {
    planner.meetingManager.emit('meetingStarted')
    expect(planner.naturalBreaksManager.isSuspended).to.equal(true)
    planner.meetingManager.emit('meetingFinished')
    expect(planner.naturalBreaksManager.isSuspended).to.equal(false)
  })

  it('forgets a deferred break when the schedule is reset', () => {
    planner.meetingManager.isInMeeting = true
    planner.deferBreakForMeeting('startMicrobreak')
    planner.nextBreak()
    expect(planner.deferredBreakEvent).to.equal(null)
  })

  it('announces when idle time resets the break timer', () => {
    let announced = false
    planner.on('idleReset', () => { announced = true })
    planner.naturalBreaksManager.emit('naturalBreakFinished')
    expect(announced).to.equal(true)
  })

  it('restores the remaining time when an idle reset is undone', () => {
    const before = planner.scheduler.timeLeft
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    planner.naturalBreaksManager.emit('naturalBreakFinished')
    expect(planner.scheduler.timeLeft).to.be.closeTo(60000, 1000)
    planner.undoIdleReset()
    expect(planner.scheduler.timeLeft).to.be.closeTo(before, 1000)
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
  })

  it('does nothing when there is no idle reset to undo', () => {
    const scheduler = planner.scheduler
    planner.undoIdleReset()
    expect(planner.scheduler).to.equal(scheduler)
  })

  it('keeps the break deferred if another meeting starts during the delay', () => {
    const started = []
    planner.on('startMicrobreak', () => started.push('startMicrobreak'))
    planner.meetingManager.isInMeeting = true
    planner.deferBreakForMeeting('startMicrobreak')
    planner.meetingManager.emit('meetingFinished')
    vi.advanceTimersByTime(3000)
    planner.meetingManager.emit('meetingStarted')
    vi.advanceTimersByTime(10000)
    expect(started).to.have.length(0)
    planner.meetingManager.emit('meetingFinished')
    vi.advanceTimersByTime(5000)
    expect(started).to.deep.equal(['startMicrobreak'])
  })

  it('resumes the schedule when idle monitoring is turned off after an idle pause', () => {
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    expect(planner.scheduler.reference).to.equal(null)
    planner.setIdleReset(false)
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
  })

  it('does not defer a break the user started manually during a meeting', () => {
    planner.meetingManager.isInMeeting = true
    planner.skipToMicrobreak()
    expect(planner.deferBreakForMeeting('startMicrobreak')).to.equal(false)
  })

  it('resumes the timer when a meeting starts after idle time paused it', () => {
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    planner.naturalBreaksManager.isSchedulerCleared = true
    planner.meetingManager.emit('meetingStarted')
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
    expect(planner.naturalBreaksManager.isSchedulerCleared).to.equal(false)
  })

  it('releases idle detection when monitoring stops during a meeting', () => {
    planner.meetingManager.timer = setInterval(() => {}, 1000)
    planner.meetingManager.isInMeeting = true
    planner.naturalBreaksManager.isSuspended = true
    planner.meetings(false)
    expect(planner.naturalBreaksManager.isSuspended).to.equal(false)
  })
})
