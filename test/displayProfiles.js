import { describe, it, beforeEach } from 'vitest'
import { expect } from 'chai'
import { displayProfileKey, saveDisplayProfile, applyDisplayProfile } from '../app/utils/displayProfiles.js'

const fakeSettings = (values) => {
  const store = { breakWindowProfiles: {}, breakWindowPosition: 'center', breakWindowWidth: 0.85, breakWindowHeight: 0.85, ...values }
  return { get: key => store[key], set: (key, value) => { store[key] = value }, store }
}

describe('displayProfiles', () => {
  let settings
  const laptop = { bounds: { width: 1536, height: 864 }, scaleFactor: 1.25 }
  const widescreen = { bounds: { width: 3440, height: 1440 }, scaleFactor: 1 }

  beforeEach(() => { settings = fakeSettings({}) })

  it('names a screen by its size and scale, so the same pixel size at another scale is different', () => {
    expect(displayProfileKey(laptop)).to.equal('1536x864@1.25')
    expect(displayProfileKey(widescreen)).to.equal('3440x1440@1')
    expect(displayProfileKey({ bounds: { width: 1536, height: 864 }, scaleFactor: 1 })).to.not.equal(displayProfileKey(laptop))
  })

  it('remembers the position and size for each screen and switches between them', () => {
    settings.set('breakWindowPosition', 'bottom-left')
    settings.set('breakWindowWidth', 0.2)
    settings.set('breakWindowHeight', 0.15)
    saveDisplayProfile(settings, displayProfileKey(laptop))

    settings.set('breakWindowPosition', 'bottom-right')
    settings.set('breakWindowWidth', 0.1)
    settings.set('breakWindowHeight', 0.1)
    saveDisplayProfile(settings, displayProfileKey(widescreen))

    expect(applyDisplayProfile(settings, displayProfileKey(laptop))).to.equal(true)
    expect([settings.get('breakWindowPosition'), settings.get('breakWindowWidth'), settings.get('breakWindowHeight')])
      .to.deep.equal(['bottom-left', 0.2, 0.15])

    expect(applyDisplayProfile(settings, displayProfileKey(widescreen))).to.equal(true)
    expect([settings.get('breakWindowPosition'), settings.get('breakWindowWidth'), settings.get('breakWindowHeight')])
      .to.deep.equal(['bottom-right', 0.1, 0.1])
  })

  it('keeps the current values on a screen it has not seen before', () => {
    settings.set('breakWindowWidth', 0.3)
    expect(applyDisplayProfile(settings, displayProfileKey(widescreen))).to.equal(false)
    expect(settings.get('breakWindowWidth')).to.equal(0.3)
  })

  it('reports no change when the values already match', () => {
    saveDisplayProfile(settings, displayProfileKey(laptop))
    expect(applyDisplayProfile(settings, displayProfileKey(laptop))).to.equal(false)
  })

  it('does not touch the other screens when one is saved again', () => {
    saveDisplayProfile(settings, displayProfileKey(laptop))
    settings.set('breakWindowWidth', 0.4)
    saveDisplayProfile(settings, displayProfileKey(widescreen))
    expect(settings.get('breakWindowProfiles')[displayProfileKey(laptop)].breakWindowWidth).to.equal(0.85)
    expect(settings.get('breakWindowProfiles')[displayProfileKey(widescreen)].breakWindowWidth).to.equal(0.4)
  })
})
