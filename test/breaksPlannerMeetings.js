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
    naturalBreaks: false,
    monitorDnd: false
  })[key]
}

describe('breaksPlanner meetings', () => {
  let planner

  beforeEach(() => {
    planner = new BreaksPlanner(settings)
    planner.nextBreak()
  })

  afterEach(() => {
    planner.clear()
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
    expect(started).to.deep.equal(['startMicrobreak'])
  })

  it('turns a deferred break notification into the break itself', () => {
    const started = []
    planner.on('startBreak', () => started.push('startBreak'))
    planner.meetingManager.isInMeeting = true
    planner.deferBreakForMeeting('startBreakNotification')
    planner.meetingManager.emit('meetingFinished')
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
})
