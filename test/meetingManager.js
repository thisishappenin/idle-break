import { describe, it } from 'vitest'
import { expect } from 'chai'
import { isMicrophoneInUse } from '../app/utils/meetingManager.js'

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
})
