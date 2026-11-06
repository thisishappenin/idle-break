import { vi } from 'vitest'
import { expect } from 'chai'
import 'chai/register-should'
import Scheduler from '../app/utils/scheduler'

const timeout = process.env.CI ? 30000 : 10000

let test

describe('scheduler', function () {
  vi.setConfig({ testTimeout: timeout })
  beforeEach(function () {
    test = true
  })

  it('kinda runs schedule on time', () =>
    new Promise((resolve) => {
      const time = 100
      const callback = function () {
        test = false
      }
      const schedule = new Scheduler(callback, time)
      schedule.plan()
      setTimeout(function () {
        test.should.equal(false)
        resolve()
      }, 200)
    }))

  it('kinda runs schedule on time with correct', () =>
    new Promise((resolve) => {
      const time = 1000
      const start = Date.now()
      const callback = function () {
        // allow margin due to event loop delay
        (Date.now() - start).should.be
          .within(time - 200, time + 200)
        test = false
      }
      const schedule = new Scheduler(callback, time)
      schedule.plan()
      setTimeout(function () {
        schedule.correct()
      }, 200)
      setTimeout(function () {
        test.should.equal(false)
        resolve()
      }, time + 100)
    }))

  it('it cancels schedule on cancel()', () =>
    new Promise((resolve) => {
      const time = 100
      const callback = function () {
        test = false
      }
      const schedule = new Scheduler(callback, time)
      schedule.plan()
      setTimeout(function () {
        schedule.cancel()
      }, 50)
      setTimeout(function () {
        test.should.equal(true)
        resolve()
      }, 200)
    }))

  it('adjust moves the time left by the given amount', () => {
    vi.useFakeTimers()
    try {
      const schedule = new Scheduler(() => {}, 60000)
      schedule.plan()
      vi.advanceTimersByTime(10000)
      schedule.adjust(-20000).should.equal(true)
      schedule.timeLeft.should.be.within(29000, 30000)
      schedule.adjust(5000)
      schedule.timeLeft.should.be.within(34000, 35000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('adjust fires the function at the adjusted time', () => {
    vi.useFakeTimers()
    try {
      let fired = false
      const schedule = new Scheduler(() => { fired = true }, 60000)
      schedule.plan()
      schedule.adjust(-50000)
      vi.advanceTimersByTime(9000)
      fired.should.equal(false)
      vi.advanceTimersByTime(1500)
      fired.should.equal(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('adjust never goes below the minimum', () => {
    vi.useFakeTimers()
    try {
      const schedule = new Scheduler(() => {}, 60000)
      schedule.plan()
      schedule.adjust(-1000000)
      schedule.timeLeft.should.be.within(0, 1000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('adjust does nothing when not planned', () => {
    new Scheduler(() => {}, 1000).adjust(1000).should.equal(false)
  })

  it('hold freezes the time left until release', () => {
    vi.useFakeTimers()
    try {
      let fired = false
      const schedule = new Scheduler(() => { fired = true }, 60000, 'startMicrobreak')
      schedule.plan()
      vi.advanceTimersByTime(10000)
      schedule.hold().should.equal(true)
      schedule.held.should.equal(true)
      vi.advanceTimersByTime(120000)
      fired.should.equal(false)
      schedule.timeLeft.should.be.within(49000, 50000)
      schedule.reference.should.equal('startMicrobreak')
      schedule.release().should.equal(true)
      schedule.held.should.equal(false)
      vi.advanceTimersByTime(49000)
      fired.should.equal(false)
      vi.advanceTimersByTime(1500)
      fired.should.equal(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('adjust changes the time left while held', () => {
    vi.useFakeTimers()
    try {
      const schedule = new Scheduler(() => {}, 60000)
      schedule.plan()
      schedule.hold()
      schedule.adjust(-20000).should.equal(true)
      schedule.timeLeft.should.equal(40000)
      schedule.adjust(-100000)
      schedule.timeLeft.should.equal(1000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancel clears a hold', () => {
    vi.useFakeTimers()
    try {
      const schedule = new Scheduler(() => {}, 60000)
      schedule.plan()
      schedule.hold()
      schedule.cancel()
      schedule.held.should.equal(false)
      schedule.timeLeft.should.equal(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hold and release do nothing when not planned or not held', () => {
    const schedule = new Scheduler(() => {}, 60000)
    schedule.hold().should.equal(false)
    schedule.release().should.equal(false)
  })

  it('it kinda gets the time left', () =>
    new Promise((resolve) => {
      const time = 100
      const callback = function () {
        test = false
      }
      const schedule = new Scheduler(callback, time)
      schedule.plan()
      setTimeout(function () {
        schedule.timeLeft.should.be.a('number').and.to.be.below(100)
      }, 50)
      setTimeout(function () {
        test.should.equal(false)
        resolve()
      }, 160)
    }))
})

describe('Scheduler total', () => {
  it('keeps the full length after a hold and release', async () => {
    const { default: Scheduler } = await import('../app/utils/scheduler.js')
    vi.useFakeTimers()
    const scheduler = new Scheduler(() => {}, 40 * 60000, 'startMicrobreak')
    scheduler.plan()
    vi.advanceTimersByTime(10 * 60000)
    scheduler.hold()
    scheduler.release()
    expect(scheduler.total).to.equal(40 * 60000)
    expect(scheduler.timeLeft).to.be.within(30 * 60000 - 100, 30 * 60000)
    scheduler.cancel()
    vi.useRealTimers()
  })

  it('follows adjustments, so a longer or shorter session changes the length', async () => {
    const { default: Scheduler } = await import('../app/utils/scheduler.js')
    vi.useFakeTimers()
    const scheduler = new Scheduler(() => {}, 40 * 60000, 'startMicrobreak')
    scheduler.plan()
    scheduler.adjust(5 * 60000)
    expect(scheduler.total).to.equal(45 * 60000)
    scheduler.adjust(-10 * 60000)
    expect(scheduler.total).to.equal(35 * 60000)
    scheduler.cancel()
    vi.useRealTimers()
  })
})
