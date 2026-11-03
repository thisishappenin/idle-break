import { describe, it } from 'vitest'
import { expect } from 'chai'
import StatusMessages from '../app/utils/statusMessages.js'

const planner = {
  scheduler: { reference: 'startMicrobreak', timeLeft: 600000 },
  dndManager: { isOnDnd: false },
  appExclusionsManager: { isSchedulerCleared: false },
  timeToNextBreak: 600000,
  isPaused: false,
  breakNumber: 1
}
const i18next = { t: (key, options) => options?.count !== undefined ? `${key}(${options.count})` : key }
const humanizeDuration = () => '10 minutes'
const settingsWith = values => ({
  get: key => ({ language: 'en', breakInterval: 2, break: true, singleBreakType: false, ...values })[key]
})
const trayMessage = settings => new StatusMessages({ breakPlanner: planner, settings, i18next, humanizeDuration }).trayMessage

describe('StatusMessages', () => {
  it('names Mini and Long breaks when both types are used', () => {
    const message = trayMessage(settingsWith({}))
    expect(message).to.contain('statusMessages.nextMiniBreak')
    expect(message).to.contain('statusMessages.nextLongBreak')
  })

  it('says the break is waiting and which app holds the microphone', () => {
    const waiting = { ...planner, deferredBreakEvent: 'startMicrobreak', meetingManager: { meetingApps: ['ms-teams'] } }
    const message = new StatusMessages({ breakPlanner: waiting, settings: settingsWith({}), i18next, humanizeDuration }).trayMessage
    expect(message).to.equal('statusMessages.waitingForCall (ms-teams)')
  })

  it('just says "Next break" in single break type mode', () => {
    const message = trayMessage(settingsWith({ singleBreakType: true, break: false }))
    expect(message).to.equal('statusMessages.nextSingleBreak utils.inAbout(10 minutes)')
  })

  describe('panel and tooltip lines', () => {
    const lines = (breakPlanner, values = {}) => new StatusMessages({ breakPlanner, settings: settingsWith(values), i18next, humanizeDuration })

    it('leaves out the next break line in the panel because the countdown already shows it', () => {
      const status = lines(planner)
      expect(status.trayMessage.split('\n').length).to.equal(2)
      expect(status.panelLines).to.deep.equal([status.trayMessage.split('\n')[1]])
    })

    it('has no extra lines when only one break type is used', () => {
      expect(lines(planner, { break: false }).panelLines).to.deep.equal([])
    })

    it('keeps the status when paused or waiting for a call', () => {
      const paused = { ...planner, isPaused: true, scheduler: { reference: 'resumeBreaks', timeLeft: 600000 } }
      expect(lines(paused).panelLines).to.deep.equal([lines(paused).trayMessage])
      const waiting = { ...planner, deferredBreakEvent: 'startMicrobreak', meetingManager: { isInMeeting: true, meetingApps: ['ms-teams'] } }
      expect(lines(waiting).panelLines).to.deep.equal(['statusMessages.waitingForCall (ms-teams)'])
    })

    it('says when the user is in a meeting, with the apps', () => {
      const inMeeting = { ...planner, meetingManager: { isInMeeting: true, meetingApps: ['ms-teams'] } }
      expect(lines(inMeeting).meetingMessage).to.equal('statusMessages.inMeeting (ms-teams)')
      expect(lines(inMeeting).tooltipMessage.split('\n').pop()).to.equal('statusMessages.inMeeting (ms-teams)')
    })

    it('says nothing about a meeting when there is none', () => {
      const status = lines({ ...planner, meetingManager: { isInMeeting: false, meetingApps: [] } })
      expect(status.meetingMessage).to.equal('')
      expect(status.tooltipMessage).to.equal(status.trayMessage)
    })

    it('does not repeat the meeting in the tooltip when a break is already waiting for it', () => {
      const waiting = { ...planner, deferredBreakEvent: 'startMicrobreak', meetingManager: { isInMeeting: true, meetingApps: ['ms-teams'] } }
      expect(lines(waiting).tooltipMessage).to.equal('statusMessages.waitingForCall (ms-teams)')
    })
  })
})
