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
})
