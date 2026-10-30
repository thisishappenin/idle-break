import { describe, it } from 'vitest'
import { expect } from 'chai'
import acceleratorFromEvent from '../app/utils/acceleratorFromEvent.js'

const press = (code, modifiers = {}) => acceleratorFromEvent({ code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers })

describe('acceleratorFromEvent', () => {
  it('builds an accelerator from modifiers and a letter', () => {
    expect(press('KeyP', { ctrlKey: true, altKey: true, shiftKey: true })).to.equal('CmdOrCtrl+Alt+Shift+P')
  })

  it('handles digits and function keys', () => {
    expect(press('Digit5', { altKey: true })).to.equal('Alt+5')
    expect(press('F9', { ctrlKey: true })).to.equal('CmdOrCtrl+F9')
  })

  it('maps Meta to CmdOrCtrl', () => {
    expect(press('KeyB', { metaKey: true })).to.equal('CmdOrCtrl+B')
  })

  it('ignores a modifier pressed on its own', () => {
    expect(press('ControlLeft', { ctrlKey: true })).to.equal(null)
  })

  it('requires Ctrl, Cmd or Alt so a plain key never becomes a global shortcut', () => {
    expect(press('KeyP')).to.equal(null)
    expect(press('KeyP', { shiftKey: true })).to.equal(null)
  })

  it('ignores keys that have no accelerator name', () => {
    expect(press('CapsLock', { ctrlKey: true })).to.equal(null)
  })
})
