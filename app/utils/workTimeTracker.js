import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dayKey } from './workTime.js'

const MAX_TICK_MS = 30000
const SAVE_EVERY_MS = 60000

class WorkTimeTracker {
  constructor ({ filePath, now = () => Date.now() }) {
    this.filePath = filePath
    this.now = now
    this.days = {}
    this.goalNotified = null
    this.lastTick = null
    this.lastSave = now()
    this.dirty = false
    this.load()
  }

  load () {
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf8'))
      if (data && typeof data.days === 'object' && data.days !== null) {
        for (const [key, seconds] of Object.entries(data.days)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(seconds) && seconds >= 0) this.days[key] = seconds
        }
        this.goalNotified = data.goalNotified ?? null
      }
    } catch {
      this.days = {}
    }
  }

  save () {
    if (!this.dirty) return
    const temporary = `${this.filePath}.tmp`
    writeFileSync(temporary, JSON.stringify({ version: 1, days: this.days, goalNotified: this.goalNotified }))
    renameSync(temporary, this.filePath)
    this.dirty = false
    this.lastSave = this.now()
  }

  tick (active) {
    const now = this.now()
    const gap = this.lastTick === null ? 0 : now - this.lastTick
    const elapsed = gap > MAX_TICK_MS ? 0 : gap
    this.lastTick = now
    if (active && elapsed > 0) {
      const key = dayKey(new Date(now))
      this.days[key] = (this.days[key] ?? 0) + elapsed / 1000
      this.dirty = true
    }
    if (this.dirty && now - this.lastSave >= SAVE_EVERY_MS) this.save()
  }

  stopCounting () {
    this.lastTick = null
  }

  todaySeconds () {
    return Math.round(this.days[dayKey(new Date(this.now()))] ?? 0)
  }

  shouldNotifyGoal (goalSeconds) {
    const today = dayKey(new Date(this.now()))
    if (!(goalSeconds > 0) || this.todaySeconds() < goalSeconds) return false
    if (this.goalNotified?.date === today && this.goalNotified?.goal === goalSeconds) return false
    this.goalNotified = { date: today, goal: goalSeconds }
    this.dirty = true
    return true
  }

  snapshot () {
    return { ...this.days }
  }
}

export default WorkTimeTracker
