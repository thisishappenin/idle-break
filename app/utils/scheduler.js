class Scheduler {
  constructor (func, delay, reference = null) {
    this.timer = null
    this.delay = delay
    this.func = func
    this.reference = reference
  }

  get timeLeft () {
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

  adjust (milliseconds, minimum = 1000) {
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
    this.reference = null
    this.func = null
  }
}

export default Scheduler
