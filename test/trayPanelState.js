import { describe, it } from 'vitest'
import { expect } from 'chai'
import { buildTrayPanelState } from '../app/utils/trayPanelState.js'

const t = (key, options = {}) => (options.minutes !== undefined ? `${key}:${options.minutes}` : options.duration ? `${key}:${options.duration}` : key)

const base = {
  t,
  formatDuration: ms => `${ms / 60000}m`,
  statusLines: ['Next Mini break in 24 minutes'],
  locked: false,
  newVersion: false,
  paused: false,
  canAct: true,
  hasMicrobreak: true,
  hasBreak: true,
  singleBreakType: false,
  canAdjust: true,
  timeToNextBreak: 24 * 60000,
  countdownRunning: true,
  sessionStepMinutes: 5,
  pauseDurations: [30, 60],
  pauseUntilMorning: true,
  pauseIndefinitely: false,
  idleEnabled: true,
  contributor: false
}

describe('trayPanelState', () => {
  it('offers the 5 minute session adjustment while a break is scheduled', () => {
    const state = buildTrayPanelState(base)
    expect(state.adjust.step).to.equal(5)
    expect(state.adjust.shorten).to.equal('main.shortenWorkSession:5')
    expect(state.adjust.extend).to.equal('main.extendWorkSession:5')
  })

  it('hides the session adjustment when no break is scheduled', () => {
    expect(buildTrayPanelState({ ...base, canAdjust: false }).adjust).to.equal(null)
  })

  it('lists the break start actions that apply', () => {
    expect(buildTrayPanelState(base).start.map(item => item.type)).to.deep.equal(['startMicrobreak', 'startBreak'])
    expect(buildTrayPanelState({ ...base, hasBreak: false }).start.map(item => item.type)).to.deep.equal(['startMicrobreak'])
  })

  it('uses the single break wording when only one break type is used', () => {
    const state = buildTrayPanelState({ ...base, hasBreak: false, singleBreakType: true })
    expect(state.start[0].label).to.equal('main.startSingleBreakNow')
  })

  it('lists the pause options from the settings', () => {
    const { pause } = buildTrayPanelState(base)
    expect(pause.options.map(option => option.minutes)).to.deep.equal([30, 60])
    expect(pause.options[0].label).to.equal('main.pauseFor:30m')
    expect(pause.morning).to.equal(true)
    expect(pause.indefinitely).to.equal(false)
  })

  it('shows resume instead of pause options while paused', () => {
    const state = buildTrayPanelState({ ...base, paused: true })
    expect(state.paused).to.equal(true)
    expect(state.pause).to.equal(null)
    expect(state.reset).to.equal(false)
  })

  it('shows only the status in strict mode', () => {
    const state = buildTrayPanelState({ ...base, locked: true })
    expect(state.status).to.deep.equal(base.statusLines)
    expect(state.adjust).to.equal(null)
    expect(state.start).to.deep.equal([])
    expect(state.pause).to.equal(null)
    expect(state.idle).to.equal(null)
  })

  it('does not offer breaks or pausing during Do Not Disturb', () => {
    const state = buildTrayPanelState({ ...base, canAct: false })
    expect(state.start).to.deep.equal([])
    expect(state.pause).to.equal(null)
    expect(state.idle.enabled).to.equal(true)
  })

  it('reports the countdown, and no countdown when there is none', () => {
    expect(buildTrayPanelState(base).countdown).to.deep.equal({ ms: 24 * 60000, running: true })
    expect(buildTrayPanelState({ ...base, timeToNextBreak: null, countdownRunning: false }).countdown).to.deep.equal({ ms: null, running: false })
  })

  it('reflects the idle setting and contributor access', () => {
    expect(buildTrayPanelState({ ...base, idleEnabled: false }).idle.enabled).to.equal(false)
    expect(buildTrayPanelState({ ...base, contributor: true }).contributor).to.equal(true)
  })
})
