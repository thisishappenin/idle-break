import EventEmitter from 'events'
import log from 'electron-log/main.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const MICROPHONE_CONSENT_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'

export function isMicrophoneInUse (regOutput) {
  let start = 0n
  let stop = 0n
  const flush = () => start > stop
  let inUse = false
  for (const line of regOutput.split(/\r?\n/)) {
    if (line.startsWith('HKEY_')) {
      inUse = inUse || flush()
      start = 0n
      stop = 0n
      continue
    }
    const match = line.match(/^\s*LastUsedTime(Start|Stop)\s+REG_QWORD\s+(0x[0-9a-fA-F]+)/)
    if (!match) continue
    if (match[1] === 'Start') start = BigInt(match[2])
    else stop = BigInt(match[2])
  }
  return inUse || flush()
}

class MeetingManager extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.monitorMeetings = settings.get('monitorMeetings')
    this.monitorMeetingsCheckInterval = settings.get('monitorMeetingsCheckInterval')
    this.timer = null
    this.isInMeeting = false
    this._errorLogged = false
    if (this.monitorMeetings) {
      this.start()
    }
  }

  start () {
    if (this.timer) return
    this.monitorMeetings = true
    this._checkMeeting()
    log.info('Stretchly: starting meeting monitoring')
  }

  stop () {
    if (!this.timer) return
    this.monitorMeetings = false
    this.isInMeeting = false
    clearInterval(this.timer)
    this.timer = null
    log.info('Stretchly: stopping meeting monitoring')
  }

  async _microphoneInUse () {
    if (process.platform !== 'win32') return false
    try {
      const { stdout } = await promisify(execFile)('reg', ['query', MICROPHONE_CONSENT_KEY, '/s'], { windowsHide: true })
      return isMicrophoneInUse(stdout)
    } catch (e) {
      if (!this._errorLogged) {
        log.error('Stretchly: meeting detection error:', e)
        this._errorLogged = true
      }
      return false
    }
  }

  _checkMeeting () {
    this.timer = setInterval(async () => {
      const inMeeting = await this._microphoneInUse()
      if (!this.timer) return
      if (!this.isInMeeting && inMeeting) {
        this.isInMeeting = true
        this.emit('meetingStarted')
      } else if (this.isInMeeting && !inMeeting) {
        this.isInMeeting = false
        this.emit('meetingFinished')
      }
    }, this.monitorMeetingsCheckInterval)
  }
}

export default MeetingManager
