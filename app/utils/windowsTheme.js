import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const PERSONALIZE_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'

export function parseSystemUsesDarkTheme (regOutput) {
  const match = regOutput.match(/SystemUsesLightTheme\s+REG_DWORD\s+(0x[0-9a-fA-F]+)/)
  if (!match) return null
  return parseInt(match[1], 16) === 0
}

export async function readSystemUsesDarkTheme () {
  if (process.platform !== 'win32') return null
  try {
    const { stdout } = await promisify(execFile)('reg', ['query', PERSONALIZE_KEY, '/v', 'SystemUsesLightTheme'], { windowsHide: true })
    return parseSystemUsesDarkTheme(stdout)
  } catch (e) {
    return null
  }
}
