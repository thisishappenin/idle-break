class AppIcon {
  constructor ({
    paused,
    monochrome,
    inverted,
    darkMode,
    trayIconStyle,
    timeToBreak,
    percentage,
    reference
  }) {
    this.paused = paused
    this.monochrome = monochrome
    this.inverted = inverted
    this.darkMode = darkMode
    this.trayIconStyle = trayIconStyle
    this.timeToBreak = timeToBreak
    this.percentage = percentage
    this.reference = reference
  }

  get textNumber () {
    if (this.trayIconStyle !== 'text' || this.paused || this.reference === 'finishMicrobreak' || this.reference === 'finishBreak') {
      return null
    }
    return Number.isInteger(this.timeToBreak) && this.timeToBreak >= 0 && this.timeToBreak <= 99
      ? this.timeToBreak
      : null
  }

  get trayIconFileName () {
    const pausedString = this.paused ? 'Paused' : ''
    const invertedMonochromeString = this.inverted ? 'Inverted' : ''
    const darkModeString = this.darkMode ? 'Dark' : ''
    let suffixString = ''

    if (!(this.paused || this.reference === 'finishMicrobreak' || this.reference === 'finishBreak')) {
      if (this.trayIconStyle === 'progress' && Number.isInteger(this.percentage) && this.percentage >= 0 && this.percentage <= 100) {
        suffixString = `Progress${this.percentage}`
      } else if ((this.trayIconStyle === 'time' || this.trayIconStyle === 'text') && Number.isInteger(this.timeToBreak) && this.timeToBreak >= 0 && this.timeToBreak <= 99) {
        suffixString = `Number${this.timeToBreak}`
      }
    }

    if (this.trayIconStyle === 'text' && suffixString !== '') {
      return `trayText${darkModeString}${suffixString}.ico`
    }

    if (this.monochrome) {
      return `trayMonochrome${invertedMonochromeString}${pausedString}${suffixString}.ico`
    }
    return `tray${pausedString}${darkModeString}${suffixString}.ico`
  }

  get windowIconFileName () {
    const darkModeString = this.darkMode ? 'Dark' : ''

    return `tray${darkModeString}.png`
  }
}

export default AppIcon
