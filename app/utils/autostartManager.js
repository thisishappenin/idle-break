import log from 'electron-log/main.js'

class AutostartManager {
  constructor ({ app }) {
    this.app = app
  }

  async setAutostartEnabled (value) {
    log.info(`Stretchly: setting autostart to ${value}`)
    this.app.setLoginItemSettings({ openAtLogin: value })
  }

  async autoLaunchStatus () {
    return this.app.getLoginItemSettings().openAtLogin
  }
}

export default AutostartManager
