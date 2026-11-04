import EventEmitter from 'events'
import log from 'electron-log/main.js'
import psList from 'ps-list'
import { matchForeground, watchForegroundWindow } from './foregroundWindow.js'

function effectiveRule (settings) {
  const rule = settings.get('appExclusions').find(ex => ex.active)
  const foreground = (settings.get('pauseWhileUsing') ?? []).map(entry => entry.trim()).filter(Boolean)
  if (!foreground.length) return rule
  if (!rule) return { rule: 'pause', active: true, commands: [], foreground }
  if (rule.rule === 'pause') return { ...rule, foreground }
  return rule
}

class AppExclusionsManager extends EventEmitter {
  constructor (settings) {
    super()
    this.timer = null
    this.foreground = null
    this.matchedForeground = false
    this.stopForeground = null
    this.appExclusion = effectiveRule(settings)
    this.appExclusionsCheckInterval = settings.get('appExclusionsCheckInterval')
    this.reset()
    if (this.appExclusion) {
      this.start()
    }
  }

  reinitialize (settings) {
    clearInterval(this.timer)
    this.timer = null
    this._stopForeground()
    this.appExclusion = effectiveRule(settings)
    this.appExclusionsCheckInterval = settings.get('appExclusionsCheckInterval')
    this.reset()
    if (this.appExclusion) {
      this.start()
    }
  }

  start () {
    if (this.timer) return
    if (this.appExclusion.foreground?.length) {
      this.stopForeground = watchForegroundWindow({
        interval: this.appExclusionsCheckInterval,
        onChange: foreground => { this.foreground = foreground }
      })
    }
    this._checkRunningExceptions()
    log.info('Stretchly: starting App exclusions monitoring')
  }

  stop () {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
    this._stopForeground()
    log.info('Stretchly: stopping App exclusions monitoring')
  }

  _stopForeground () {
    this.stopForeground?.()
    this.stopForeground = null
    this.foreground = null
  }

  reset () {
    this.isOnAppExclusion = false
    if (this.appExclusion) {
      this.isOnAppExclusion = this.appExclusion.rule === 'resume'
    }
  }

  async _runningAppExclusion () {
    this.matchedForeground = false
    const found = await this._runningCommand()
    if (found) return found
    const foreground = matchForeground(this.appExclusion.foreground ?? [], this.foreground)
    this.matchedForeground = Boolean(foreground)
    return foreground
  }

  async _runningCommand () {
    const appExclusionCommands = this.appExclusion.commands ?? []
    if (!appExclusionCommands.length) return false
    const runningCommands = await psList()
    for (const appExclusionCommand of appExclusionCommands) {
      const found = runningCommands.find(el =>
        (el.cmd && el.cmd.includes(appExclusionCommand)) ||
          (el.name && el.name.includes(appExclusionCommand)))
      if (found) return appExclusionCommand
    }
    return false
  }

  _checkRunningExceptions () {
    this.timer = setInterval(async () => {
      const appExclusion = await this._runningAppExclusion()
      if (!this.isOnAppExclusion && appExclusion) {
        this.isOnAppExclusion = true
        this.emit('appExclusionStarted', this.appExclusion.rule, appExclusion, { foreground: this.matchedForeground })
      }
      if (this.isOnAppExclusion && !appExclusion) {
        this.isOnAppExclusion = false
        this.emit('appExclusionFinished', this.appExclusion.rule)
      }
    }, this.appExclusionsCheckInterval)
  }

  get isSchedulerCleared () {
    if (this.appExclusion === undefined) { return false }
    if (this.appExclusion.rule === 'pause') {
      return this.isOnAppExclusion
    } else {
      return !this.isOnAppExclusion
    }
  }
}

export default AppExclusionsManager
