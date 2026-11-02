import Scheduler from './utils/scheduler.js'
import EventEmitter from 'events'
import NaturalBreaksManager from './utils/naturalBreaksManager.js'
import DndManager from './utils/dndManager.js'
import AppExclusionsManager from './utils/appExclusionsManager.js'
import MeetingManager from './utils/meetingManager.js'
import log from 'electron-log/main.js'

const USAGE_IDLE_LIMIT = 5000

class BreaksPlanner extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.breakNumber = 0
    this.postponesNumber = 0
    this.scheduler = null
    this.isPaused = false
    this.pollersSuspended = false
    this.naturalBreaksManager = new NaturalBreaksManager(settings)
    this.dndManager = new DndManager(settings)
    this.appExclusionsManager = new AppExclusionsManager(settings)
    this.meetingManager = new MeetingManager(settings)
    this.deferredBreakEvent = null
    this.startedManually = false
    this.meetingDelayTimer = null
    this.idleSnapshot = null
    this.usageTimer = null
    this.lastBreakFinishedAt = null

    this.on('microbreakStarted', (shouldPlaySound) => {
      this.idleSnapshot = null
      const interval = this.settings.get('microbreakDuration')
      this.scheduler = new Scheduler(() => this.emit('finishMicrobreak', shouldPlaySound, true), interval, 'finishMicrobreak')
      this.scheduler.plan()
    })

    this.on('breakStarted', (shouldPlaySound) => {
      this.idleSnapshot = null
      const interval = this.settings.get('breakDuration')
      this.scheduler = new Scheduler(() => this.emit('finishBreak', shouldPlaySound, true), interval, 'finishBreak')
      this.scheduler.plan()
    })

    this.naturalBreaksManager.on('clearBreakScheduler', () => {
      if (this.isHoldingForUsage) {
        this.naturalBreaksManager.isSchedulerCleared = false
        return
      }
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
        this.idleSnapshot = {
          reference: this.scheduler.reference,
          timeLeft: this.scheduler.timeLeft,
          breakNumber: this.breakNumber
        }
        this.clear()
        log.info('Stretchly: pausing breaks because of idle time')
      }
    })

    this.naturalBreaksManager.on('naturalBreakFinished', (idleTime) => {
      if (this.isHoldingForUsage) {
        this.resumeAfterUsage()
        return
      }
      if (this.breakFinishedDuringIdle(idleTime)) return
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && !this.dndManager.isOnDnd) {
        this.reset()
        log.info('Stretchly: resuming breaks after idle time')
        if (!(idleTime > this.settings.get('naturalBreaksResetNotificationMaxIdleTime'))) {
          this.emit('idleReset')
        }
        this.emit('updateToolTip')
      }
    })

    this.meetingManager.on('meetingStarted', () => {
      clearTimeout(this.meetingDelayTimer)
      const naturalBreaks = this.naturalBreaksManager
      naturalBreaks.isSuspended = true
      if (naturalBreaks.isSchedulerCleared) {
        naturalBreaks.isSchedulerCleared = false
        naturalBreaks.isOnNaturalBreak = false
        naturalBreaks.emit('naturalBreakFinished')
      }
      log.info('Stretchly: meeting started, breaks will wait until it ends')
    })

    this.meetingManager.on('meetingFinished', () => {
      this.naturalBreaksManager.isSuspended = false
      log.info('Stretchly: meeting finished')
      clearTimeout(this.meetingDelayTimer)
      if (this.isPaused) return
      this.meetingDelayTimer = setTimeout(() => {
        const eventName = this.deferredBreakEvent
        this.deferredBreakEvent = null
        if (eventName && !this.isPaused) this.emit(eventName)
      }, this.settings.get('meetingBreakDelay'))
    })

    this.dndManager.on('dndStarted', () => {
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
        this.clear()
        log.info('Stretchly: pausing breaks for Do Not Distrub')
        this.emit('updateToolTip')
      } else {
        this.dndManager.isOnDnd = false
      }
    })

    this.dndManager.on('dndFinished', () => {
      if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
        this.reset()
        log.info('Stretchly: resuming breaks for Do Not Distrub')
        this.emit('updateToolTip')
      }
    })

    this.appExclusionsManager.on('appExclusionStarted', (rule, exclusion) => {
      if (rule === 'pause') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
          this.clear()
          log.info(`Stretchly: pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        } else if (!this.isPaused && this.scheduler.reference === 'finishBreak') {
          this.emit('finishBreak', false, false)
          this.clear()
          log.info(`Stretchly: closing current and pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        } else if (!this.isPaused && this.scheduler.reference === 'finishMicrobreak') {
          this.emit('finishMicrobreak', false, false)
          this.clear()
          log.info(`Stretchly: closing current and pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        } else {
          this.appExclusionsManager.isOnAppExclusion = false
        }
      } else if (rule === 'resume') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
          this.reset()
          log.info(`Stretchly: resuming breaks as 'resume' exclusion found running: '${exclusion}'`)
          this.emit('updateToolTip')
        }
      }
    })

    this.appExclusionsManager.on('appExclusionFinished', (rule) => {
      if (rule === 'pause') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
          this.reset()
          log.info("Stretchly: resuming breaks as no 'pause' exclusion found running")
          this.emit('updateToolTip')
        }
      } else if (rule === 'resume') {
        if (!this.isPaused && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak' && this.scheduler.reference !== null) {
          this.clear()
          log.info("Stretchly: pausing breaks as no 'resume' exclusion found running")
          this.emit('updateToolTip')
        } else {
          this.appExclusionsManager.isOnAppExclusion = true
        }
      }
    })
  }

  breakFinishedDuringIdle (idleTime) {
    if (!(idleTime > 0) || this.lastBreakFinishedAt === null) return false
    return Date.now() - this.lastBreakFinishedAt < idleTime + USAGE_IDLE_LIMIT
  }

  get isHoldingForUsage () {
    return this.usageTimer !== null && this.scheduler?.held === true
  }

  stopUsageWatch () {
    clearInterval(this.usageTimer)
    this.usageTimer = null
  }

  nextBreakAfterBreak () {
    this.lastBreakFinishedAt = Date.now()
    this.nextBreak()
    const manager = this.naturalBreaksManager
    if (manager.usingNaturalBreaks && manager.idleTime >= USAGE_IDLE_LIMIT && this.scheduler.hold()) {
      log.info('Stretchly: waiting for usage before counting down to the next break')
      this.usageTimer = setInterval(() => this.checkUsage(), this.settings.get('naturalBreaksCheckInterval'))
      this.emit('updateToolTip')
    }
  }

  checkUsage () {
    if (!this.scheduler?.held) {
      this.stopUsageWatch()
    } else if (this.naturalBreaksManager.idleTime < USAGE_IDLE_LIMIT) {
      this.resumeAfterUsage()
    }
  }

  resumeAfterUsage () {
    this.stopUsageWatch()
    if (this.scheduler?.release()) {
      log.info('Stretchly: usage detected, counting down to the next break')
      this.emit('updateToolTip')
    }
  }

  nextBreak () {
    this.stopUsageWatch()
    this.postponesNumber = 0
    this.deferredBreakEvent = null
    this.startedManually = false
    clearTimeout(this.meetingDelayTimer)
    if (this.scheduler) this.scheduler.cancel()
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    const interval = this.settings.get('microbreakInterval')
    const breakNotification = this.settings.get('breakNotification')
    const breakNotificationInterval = this.settings.get('breakNotificationInterval')
    const microbreakNotification = this.settings.get('microbreakNotification')
    const microbreakNotificationInterval = this.settings.get('microbreakNotificationInterval')
    if (!shouldBreak && shouldMicrobreak) {
      if (microbreakNotification) {
        this.scheduler = new Scheduler(() => this.emit('startMicrobreakNotification'), interval - microbreakNotificationInterval, 'startMicrobreakNotification')
      } else {
        this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), interval, 'startMicrobreak')
      }
    } else if (shouldBreak && !shouldMicrobreak) {
      if (breakNotification) {
        this.scheduler = new Scheduler(() => this.emit('startBreakNotification'), interval * (this.settings.get('breakInterval') + 1) - breakNotificationInterval, 'startBreakNotification')
      } else {
        this.scheduler = new Scheduler(() => this.emit('startBreak'), interval * (this.settings.get('breakInterval') + 1), 'startBreak')
      }
    } else if (shouldBreak && shouldMicrobreak) {
      this.breakNumber = this.breakNumber + 1
      const breakInterval = this.settings.get('breakInterval') + 1
      if (this.breakNumber % breakInterval === 0) {
        if (breakNotification) {
          this.scheduler = new Scheduler(() => this.emit('startBreakNotification'), interval - breakNotificationInterval, 'startBreakNotification')
        } else {
          this.scheduler = new Scheduler(() => this.emit('startBreak'), interval, 'startBreak')
        }
      } else {
        if (microbreakNotification) {
          this.scheduler = new Scheduler(() => this.emit('startMicrobreakNotification'), interval - microbreakNotificationInterval, 'startMicrobreakNotification')
        } else {
          this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), interval, 'startMicrobreak')
        }
      }
    }
    this.scheduler.plan()
  }

  nextBreakAfterNotification () {
    this.scheduler.cancel()
    const scheduledBreakType = this._scheduledBreakType
    const breakNotificationInterval = this.settings.get(`${scheduledBreakType}NotificationInterval`)
    const eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}`
    this.scheduler = new Scheduler(() => this.emit(eventName), breakNotificationInterval, eventName)
    this.scheduler.plan()
  }

  postponeCurrentBreak () {
    this.scheduler.cancel()
    this.postponesNumber += 1
    let postponeTime, eventName
    const scheduledBreakType = this._scheduledBreakType
    const notification = this.settings.get(`${scheduledBreakType}Notification`)
    if (notification && this.settings.get(`${scheduledBreakType}PostponeTime`) > this.settings.get(`${scheduledBreakType}NotificationInterval`)) {
      postponeTime = this.settings.get(`${scheduledBreakType}PostponeTime`) - this.settings.get(`${scheduledBreakType}NotificationInterval`)
      eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}Notification`
    } else {
      postponeTime = this.settings.get(`${scheduledBreakType}PostponeTime`)
      eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}`
    }
    this.scheduler = new Scheduler(() => this.emit(eventName), postponeTime, eventName)
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  adjustWorkSession (milliseconds) {
    const reference = this.scheduler?.reference
    if (this.isPaused || !reference?.startsWith('start')) return false
    const adjusted = this.scheduler.adjust(milliseconds)
    if (adjusted) this.emit('updateToolTip')
    return adjusted
  }

  undoIdleReset () {
    const snapshot = this.idleSnapshot
    this.idleSnapshot = null
    if (!snapshot || this.isPaused || !this.scheduler || !snapshot.reference.startsWith('start')) return
    this.scheduler.cancel()
    this.breakNumber = snapshot.breakNumber
    const eventName = snapshot.reference
    this.scheduler = new Scheduler(() => this.emit(eventName), Math.max(1000, snapshot.timeLeft), eventName)
    this.scheduler.plan()
    log.info('Stretchly: restored break timer after ignoring idle reset')
    this.emit('updateToolTip')
  }

  deferBreakForMeeting (eventName) {
    if (this.startedManually) {
      this.startedManually = false
      return false
    }
    if (!this.meetingManager.isInMeeting) return false
    this.deferredBreakEvent = eventName.replace('Notification', '')
    log.info(`Stretchly: deferring ${this.deferredBreakEvent} until the meeting ends`)
    this.emit('updateToolTip')
    return true
  }

  meetings (shouldUse) {
    if (shouldUse) {
      this.meetingManager.start()
    } else {
      this.meetingManager.stop()
      this.naturalBreaksManager.isSuspended = false
      this.deferredBreakEvent = null
      clearTimeout(this.meetingDelayTimer)
    }
  }

  skipToMicrobreak (delay = 100) {
    this.scheduler.cancel()
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    if (shouldBreak && shouldMicrobreak) {
      const breakInterval = this.settings.get('breakInterval') + 1
      if (this.breakNumber % breakInterval === 0) {
        this.breakNumber = 1
      }
    }
    this.startedManually = true
    this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), delay, 'startMicrobreak')
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  skipToBreak (delay = 100) {
    this.scheduler.cancel()
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    if (shouldBreak && shouldMicrobreak) {
      const breakInterval = this.settings.get('breakInterval') + 1
      this.breakNumber = breakInterval
    }
    this.startedManually = true
    this.scheduler = new Scheduler(() => this.emit('startBreak'), delay, 'startBreak')
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  clear () {
    this.stopUsageWatch()
    this.scheduler.cancel()
    this.deferredBreakEvent = null
    clearTimeout(this.meetingDelayTimer)
    this.breakNumber = 0
    this.postponesNumber = 0
  }

  pause (milliseconds) {
    this.clear()
    this.isPaused = true
    this.pollersSuspended = true
    this.naturalBreaksManager.stop()
    this.dndManager.stop()
    this.appExclusionsManager.stop()
    this.meetingManager.stop()
    if (milliseconds !== 1) {
      this.scheduler = new Scheduler(() => this.emit('resumeBreaks'), milliseconds, 'resumeBreaks')
      this.scheduler.plan()
    }
  }

  resume () {
    this.scheduler.cancel()
    this.isPaused = false
    this.appExclusionsManager.reset()
    this.nextBreak()
    if (this.pollersSuspended) {
      this.pollersSuspended = false
      if (this.settings.get('naturalBreaks')) this.naturalBreaksManager.start()
      if (this.settings.get('monitorDnd')) this.dndManager.start()
      if (this.settings.get('monitorMeetings')) this.meetingManager.start()
      this.appExclusionsManager.reinitialize(this.settings)
    }
  }

  correctScheduler () {
    if (this.scheduler) this.scheduler.correct()
  }

  reset () {
    this.clear()
    this.resume()
  }

  get _scheduledBreakType () {
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    const breakInterval = this.settings.get('breakInterval') + 1
    let scheduledBreakType
    if (shouldBreak && shouldMicrobreak) {
      scheduledBreakType = this.breakNumber % breakInterval !== 0 ? 'microbreak' : 'break'
    } else if (!shouldBreak) {
      scheduledBreakType = 'microbreak'
    } else if (!shouldMicrobreak) {
      scheduledBreakType = 'break'
    }
    return scheduledBreakType
  }

  naturalBreaks (shouldUse) {
    if (shouldUse) {
      this.naturalBreaksManager.start()
    } else {
      this.naturalBreaksManager.stop()
    }
  }

  setIdleReset (shouldUse) {
    this.naturalBreaks(shouldUse)
    if (!shouldUse && !this.isPaused && this.scheduler.reference === null && !this.dndManager.isOnDnd) {
      this.reset()
    }
  }

  doNotDisturb (shouldUse) {
    if (shouldUse) {
      this.dndManager.start()
    } else {
      this.dndManager.stop()
      if (!this.isPaused && this.scheduler.reference === null) {
        this.reset()
      }
    }
  }

  get timeToNextBreak () {
    if (!this.scheduler) return null
    if (this.scheduler.reference === 'startMicrobreak' || this.scheduler.reference === 'startBreak') {
      return Math.max(0, this.scheduler.timeLeft)
    }
    if (this.scheduler.reference === 'startBreakNotification') {
      return this.scheduler.timeLeft + (this.settings.get('breakNotification')
        ? this.settings.get('breakNotificationInterval')
        : 0)
    }
    if (this.scheduler.reference === 'startMicrobreakNotification') {
      return this.scheduler.timeLeft + (this.settings.get('microbreakNotification')
        ? this.settings.get('microbreakNotificationInterval')
        : 0)
    }
    return null
  }

  get _progressInterval () {
    if (!this.scheduler) return null
    const { reference, delay } = this.scheduler

    if (reference === 'startMicrobreak' || reference === 'startBreak') {
      return delay
    }

    if (reference === 'startBreakNotification') {
      return delay + this.settings.get('breakNotificationInterval')
    }

    if (reference === 'startMicrobreakNotification') {
      return delay + this.settings.get('microbreakNotificationInterval')
    }

    return null
  }

  get progressPercentage () {
    const total = this._progressInterval
    const remaining = this.timeToNextBreak
    if (total === null || total <= 0 || remaining === null) return 0

    const progress = 1 - (remaining / total)
    return Math.max(0, Math.min(100, Math.round(progress * 100)))
  }
}

export default BreaksPlanner
