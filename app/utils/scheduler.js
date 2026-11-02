class Scheduler {
  constructor (func, delay, reference = null) {
    this.timer = null
    this.delay = delay
    this.func = func
    this.reference = reference
    this.remaining = null
  }

  get held () {
    return this.remaining !== null
  }

  get timeLeft () {
    if (this.held) return this.remaining
    if (this.timer === null) return false
    return this.now + this.delay - Date.now()
  }

  plan () {
    this.now = Date.now()
    this.timer = setTimeout(this.func, this.delay)
  }

  correct () {
    if (this.timer === null) return
    clearTimeout(this.timer)
    this.timer = setTimeout(this.func, this.timeLeft)
  }

  hold () {
    if (this.timer === null || this.held) return false
    this.remaining = this.timeLeft
    clearTimeout(this.timer)
    this.timer = null
    return true
  }

  release () {
    if (!this.held) return false
    this.delay = this.remaining
    this.remaining = null
    this.plan()
    return true
  }

  adjust (milliseconds, minimum = 1000) {
    if (this.held) {
      this.remaining = Math.max(minimum, this.remaining + milliseconds)
      return true
    }
    if (this.timer === null) return false
    const timeLeft = this.timeLeft
    clearTimeout(this.timer)
    this.delay = Math.max(minimum, timeLeft + milliseconds)
    this.plan()
    return true
  }

  cancel () {
    clearTimeout(this.timer)
    this.timer = null
    this.remaining = null
    this.reference = null
    this.func = null
  }
}

export default Scheduler
