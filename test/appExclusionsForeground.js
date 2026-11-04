import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import { expect } from 'chai'

const watchers = []
vi.mock('electron-log/main.js', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
vi.mock('ps-list', () => ({ default: async () => [{ name: 'other.exe', cmd: 'other.exe' }] }))
vi.mock('../app/utils/foregroundWindow.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    watchForegroundWindow: (options) => {
      const watcher = { options, stopped: false }
      watchers.push(watcher)
      return () => { watcher.stopped = true }
    }
  }
})

const { default: AppExclusionsManager } = await import('../app/utils/appExclusionsManager.js')

const settingsWith = (values) => ({
  get: key => ({ appExclusions: [], appExclusionsCheckInterval: 1000, pauseWhileUsing: [], ...values })[key]
})

describe('AppExclusionsManager pause while using', () => {
  let manager

  beforeEach(() => {
    vi.useFakeTimers()
    watchers.length = 0
  })

  afterEach(() => {
    manager?.stop()
    vi.useRealTimers()
  })

  it('does not watch the foreground window when nothing is listed', () => {
    manager = new AppExclusionsManager(settingsWith({}))
    expect(watchers).to.have.length(0)
    expect(manager.isSchedulerCleared).to.equal(false)
  })

  it('pauses while a listed app or window title is in front and resumes when it is not', async () => {
    manager = new AppExclusionsManager(settingsWith({ pauseWhileUsing: ['gmail', ' '] }))
    const events = []
    manager.on('appExclusionStarted', (rule, found) => events.push(['started', rule, found]))
    manager.on('appExclusionFinished', rule => events.push(['finished', rule]))
    expect(watchers).to.have.length(1)
    expect(watchers[0].options.interval).to.equal(1000)

    watchers[0].options.onChange({ process: 'chrome', title: 'Inbox - Gmail' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(manager.isSchedulerCleared).to.equal(true)

    watchers[0].options.onChange({ process: 'chrome', title: 'Docs' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(manager.isSchedulerCleared).to.equal(false)
    expect(events).to.deep.equal([['started', 'pause', 'gmail'], ['finished', 'pause']])
  })

  it('stops watching when the list is cleared', () => {
    manager = new AppExclusionsManager(settingsWith({ pauseWhileUsing: ['gmail'] }))
    manager.reinitialize(settingsWith({ pauseWhileUsing: [] }))
    expect(watchers[0].stopped).to.equal(true)
    expect(watchers).to.have.length(1)
  })

  it('adds the list to a pause rule from the preferences file', async () => {
    const rule = { rule: 'pause', active: true, commands: ['other.exe'] }
    manager = new AppExclusionsManager(settingsWith({ appExclusions: [rule], pauseWhileUsing: ['gmail'] }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(manager.isSchedulerCleared).to.equal(true)
    manager.stop()
    expect(watchers[0].stopped).to.equal(true)
  })

  it('leaves a resume rule alone, since "only while running" and "pause while using" would conflict', () => {
    const rule = { rule: 'resume', active: true, commands: ['other.exe'] }
    manager = new AppExclusionsManager(settingsWith({ appExclusions: [rule], pauseWhileUsing: ['gmail'] }))
    expect(watchers).to.have.length(0)
  })
})
