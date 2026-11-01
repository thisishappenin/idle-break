import { describe, it } from 'vitest'
import { expect } from 'chai'
import { isMicrophoneInUse, hasMeetingSession, meetingApps } from '../app/utils/meetingManager.js'

const entry = (name, start, stop) => `HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\${name}
    Value    REG_SZ    Allow
    LastUsedTimeStart    REG_QWORD    ${start}
    LastUsedTimeStop    REG_QWORD    ${stop}
`

describe('meetingManager', () => {
  describe('isMicrophoneInUse', () => {
    it('is false when no app has used the microphone', () => {
      expect(isMicrophoneInUse('')).to.equal(false)
    })

    it('is true when an app started and has not stopped', () => {
      expect(isMicrophoneInUse(entry('Teams', '0x1dc0000000000000', '0x0'))).to.equal(true)
    })

    it('is false when the last use has stopped', () => {
      expect(isMicrophoneInUse(entry('Teams', '0x1dc0000000000000', '0x1dc0000000000010'))).to.equal(false)
    })

    it('is true when any one of several apps is using the microphone', () => {
      const output = entry('Zoom', '0x1dc0000000000000', '0x1dc0000000000010') +
        entry('Teams', '0x1dc0000000000100', '0x0')
      expect(isMicrophoneInUse(output)).to.equal(true)
    })

    it('ignores apps that never used the microphone', () => {
      expect(isMicrophoneInUse(entry('Zoom', '0x0', '0x0'))).to.equal(false)
    })
  })

  describe('hasMeetingSession', () => {
    it('is true when a call app is capturing audio', () => {
      expect(hasMeetingSession('ACTIVE|ms-teams')).to.equal(true)
    })

    it('is false when nothing is capturing', () => {
      expect(hasMeetingSession('ACTIVE|')).to.equal(false)
    })

    it('ignores apps on the ignore list', () => {
      expect(hasMeetingSession('ACTIVE|screenpipe-app', ['screenpipe-app'])).to.equal(false)
    })

    it('still detects a call when an ignored app is also capturing', () => {
      expect(hasMeetingSession('ACTIVE|screenpipe-app,ms-teams', ['screenpipe-app'])).to.equal(true)
    })

    it('matches ignored apps case-insensitively', () => {
      expect(hasMeetingSession('ACTIVE|ScreenPipe-App', ['screenpipe-app'])).to.equal(false)
    })

    it('lists the apps that count as a call', () => {
      expect(meetingApps('ACTIVE|screenpipe-app,ms-teams', ['screenpipe-app'])).to.deep.equal(['ms-teams'])
    })

    it('does not treat error lines as meetings', () => {
      expect(hasMeetingSession('ERROR|boom')).to.equal(false)
    })
  })
})
