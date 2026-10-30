import { describe, it } from 'vitest'
import { expect } from 'chai'
import { parseSystemUsesDarkTheme } from '../app/utils/windowsTheme.js'

const output = (value) => `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize
    SystemUsesLightTheme    REG_DWORD    ${value}
`

describe('windowsTheme', () => {
  it('reports dark when the taskbar uses the dark theme', () => {
    expect(parseSystemUsesDarkTheme(output('0x0'))).to.equal(true)
  })

  it('reports light when the taskbar uses the light theme', () => {
    expect(parseSystemUsesDarkTheme(output('0x1'))).to.equal(false)
  })

  it('reports unknown when the value is missing', () => {
    expect(parseSystemUsesDarkTheme('')).to.equal(null)
  })
})
