import { describe, it, vi } from 'vitest'
import { expect } from 'chai'

vi.mock('electron-log/main.js', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

const { parseForeground, matchForeground } = await import('../app/utils/foregroundWindow.js')

describe('parseForeground', () => {
  it('reads the process name and the window title', () => {
    expect(parseForeground('FOREGROUND|chrome|YouTube - Google Chrome'))
      .to.deep.equal({ process: 'chrome', title: 'YouTube - Google Chrome' })
  })

  it('keeps separators that are part of the title', () => {
    expect(parseForeground('FOREGROUND|code|a | b - Visual Studio Code'))
      .to.deep.equal({ process: 'code', title: 'a | b - Visual Studio Code' })
  })

  it('accepts an empty title and process when nothing is in front', () => {
    expect(parseForeground('FOREGROUND||')).to.deep.equal({ process: '', title: '' })
  })

  it('ignores lines that are not foreground reports', () => {
    expect(parseForeground('ERROR|nope')).to.equal(null)
    expect(parseForeground('FOREGROUND|missing separator')).to.equal(null)
  })
})

describe('matchForeground', () => {
  const chrome = { process: 'chrome', title: 'Inbox - Gmail - Google Chrome' }

  it('matches an app by process name, ignoring case and .exe', () => {
    expect(matchForeground(['Chrome'], chrome)).to.equal('Chrome')
    expect(matchForeground(['chrome.exe'], { process: 'chrome.exe', title: '' })).to.equal('chrome.exe')
  })

  it('matches a website by a word in the window title', () => {
    expect(matchForeground(['gmail'], chrome)).to.equal('gmail')
    expect(matchForeground(['youtube'], chrome)).to.equal(false)
  })

  it('returns the first entry that matches', () => {
    expect(matchForeground(['netflix', 'gmail', 'chrome'], chrome)).to.equal('gmail')
  })

  it('never matches blank entries or when nothing is known about the foreground', () => {
    expect(matchForeground(['', '  '], chrome)).to.equal(false)
    expect(matchForeground(['chrome'], null)).to.equal(false)
    expect(matchForeground([], chrome)).to.equal(false)
  })
})
