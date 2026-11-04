import EventEmitter from 'events'
import log from 'electron-log/main.js'
import { getFocusAssist } from 'windows-focus-assist'

class DndManager extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.monitorDnd = settings.get('monitorDnd')
    this.monitorDndCheckInterval = settings.get('monitorDndCheckInterval')
    this.timer = null
    this.isOnDnd = false

    if (this.monitorDnd) {
      this.start()
    }
  }

  start () {
    if (this.timer) return
    this.monitorDnd = true
    this._checkDnd()
    log.info('Stretchly: starting Do Not Disturb monitoring')
  }

  stop () {
    if (!this.timer) return
    this.monitorDnd = false
    this.isOnDnd = false
    clearInterval(this.timer)
    this.timer = null
    log.info('Stretchly: stopping Do Not Disturb monitoring')
  }

  async _doNotDisturb () {
    if (!this.monitorDnd) return false
    try {
      const focusAssist = getFocusAssist().value
      return focusAssist === 1 || focusAssist === 2
    } catch (e) {
      return false
    }
  }

  _checkDnd () {
    this.timer = setInterval(async () => {
      const doNotDisturb = await this._doNotDisturb()
      if (!this.isOnDnd && doNotDisturb) {
        this.isOnDnd = true
        this.emit('dndStarted')
      }
      if (this.isOnDnd && !doNotDisturb) {
        this.isOnDnd = false
        this.emit('dndFinished')
      }
    }, this.monitorDndCheckInterval)
  }
}

export default DndManager
