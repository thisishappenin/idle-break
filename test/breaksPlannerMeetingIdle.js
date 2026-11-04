import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import { expect } from 'chai'
import BreaksPlanner from '../app/breaksPlanner.js'

const system = vi.hoisted(() => ({ idleSeconds: 0 }))

vi.mock('electron', () => ({ powerMonitor: { getSystemIdleTime: () => system.idleSeconds }, app: { getPath: () => '' } }))
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
    naturalBreaks: true,
    naturalBreaksInactivityResetTime: 5 * MINUTE,
    naturalBreaksCheckInterval: 2000,
    naturalBreaksResetNotificationMaxIdleTime: 10 * MINUTE,
    monitorDnd: false
  })[key]
}

describe('breaksPlanner idle time and meetings', () => {
  let planner

  beforeEach(() => {
    vi.useFakeTimers()
    system.idleSeconds = 0
    planner = new BreaksPlanner(settings)
    planner.nextBreak()
  })

  afterEach(() => {
    planner.clear()
    planner.naturalBreaksManager.stop()
    vi.useRealTimers()
  })

  function idleThroughMeeting (minutes) {
    planner.meetingManager.isInMeeting = true
    planner.meetingManager.emit('meetingStarted')
    for (let i = 0; i < minutes; i++) {
      system.idleSeconds += 60
      vi.advanceTimersByTime(MINUTE)
    }
  }

  function endMeeting () {
    planner.meetingManager.isInMeeting = false
    planner.meetingManager.emit('meetingFinished')
  }

  it('does not pause the countdown while the user is idle in a meeting', () => {
    idleThroughMeeting(20)
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
  })

  it('does not treat the meeting as time away when it ends', () => {
    idleThroughMeeting(20)
    endMeeting()
    vi.advanceTimersByTime(4000)
    expect(planner.scheduler.reference).to.equal('startMicrobreak')
    expect(planner.naturalBreaksManager.isSchedulerCleared).to.equal(false)
  })

  it('still starts the break that waited for the meeting', () => {
    let started = false
    planner.on('startMicrobreak', () => { started = true })
    idleThroughMeeting(45)
    planner.deferredBreakEvent = 'startMicrobreak'
    started = false
    endMeeting()
    vi.advanceTimersByTime(7000)
    expect(started).to.equal(true)
  })

  it('still resets after a real absence that follows the meeting', () => {
    idleThroughMeeting(20)
    endMeeting()
    for (let i = 0; i < 8; i++) {
      system.idleSeconds += 60
      vi.advanceTimersByTime(MINUTE)
    }
    expect(planner.scheduler.reference).to.equal(null)
    expect(planner.naturalBreaksManager.isSchedulerCleared).to.equal(true)
  })

  it('counts idle time from the end of the meeting, not from its start', () => {
    idleThroughMeeting(20)
    endMeeting()
    vi.advanceTimersByTime(2 * MINUTE)
    system.idleSeconds += 2 * 60
    expect(planner.naturalBreaksManager.idleTime).to.be.closeTo(2 * MINUTE, 2000)
  })
})
