import 'chai/register-should'
import AppIcon from '../app/utils/appIcon'

describe('appIcon', function () {
  it('trayIconFileName works for dark mode on Windows', function () {
    const params = {
      paused: false,
      monochrome: false,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayDark.ico')
  })

  it('trayIconFileName works for dark mode on Windows with time in tray', function () {
    const params = {
      paused: false,
      monochrome: false,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayDarkNumber2.ico')
  })

  it('trayIconFileName works for dark mode on Windows with progress in tray', function () {
    const params = {
      paused: false,
      monochrome: false,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'progress',
      percentage: 20,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayDarkProgress20.ico')
  })

  it('trayIconFileName works for paused dark mode on Windows', function () {
    const params = {
      paused: true,
      monochrome: false,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayPausedDark.ico')
  })

  it('trayIconFileName works for paused dark mode on Windows with time in tray', function () {
    const params = {
      paused: true,
      monochrome: false,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayPausedDark.ico')
  })

  it('trayIconFileName works for light mode on Windows', function () {
    const params = {
      paused: false,
      monochrome: false,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('tray.ico')
  })

  it('trayIconFileName works for light mode on Windows with tray on', function () {
    const params = {
      paused: false,
      monochrome: false,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayNumber2.ico')
  })

  it('trayIconFileName works for light mode on Windows with progress in tray', function () {
    const params = {
      paused: false,
      monochrome: false,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'progress',
      percentage: 20,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayProgress20.ico')
  })

  it('trayIconFileName works for paused light mode on Windows', function () {
    const params = {
      paused: true,
      monochrome: false,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayPaused.ico')
  })

  it('trayIconFileName works for paused light mode on Windows with time in tray', function () {
    const params = {
      paused: true,
      monochrome: false,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayPaused.ico')
  })

  it('trayIconFileName works for monochrome on Windows', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochrome.ico')
  })

  it('trayIconFileName works for monochrome on Windows with time in tray', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeNumber2.ico')
  })

  it('trayIconFileName works for monochrome on Windows with progress in tray', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'progress',
      percentage: 20,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeProgress20.ico')
  })

  it('trayIconFileName works for paused monochrome on Windows', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromePaused.ico')
  })

  it('trayIconFileName works for paused monochrome on Windows with time in tray', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromePaused.ico')
  })

  it('trayIconFileName works for monochrome on Windows (with dark on)', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochrome.ico')
  })

  it('trayIconFileName works for monochrome on Windows (with dark on) and time in tray', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeNumber2.ico')
  })

  it('trayIconFileName works for paused monochrome on Windows (with dark on)', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromePaused.ico')
  })

  it('trayIconFileName works for paused monochrome on Windows (with dark on) and time in tray', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: false,
      darkMode: true,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromePaused.ico')
  })

  it('trayIconFileName works for inverted monochrome on Windows', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: true,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInverted.ico')
  })

  it('trayIconFileName works for inverted monochrome on Windows with time in tray', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: true,
      darkMode: false,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInvertedNumber2.ico')
  })

  it('trayIconFileName works for inverted monochrome on Windows with progress in tray', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: true,
      darkMode: false,
      trayIconStyle: 'progress',
      percentage: 20,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInvertedProgress20.ico')
  })

  it('trayIconFileName works for paused inverted monochrome on Windows', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: true,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInvertedPaused.ico')
  })

  it('trayIconFileName works for paused inverted monochrome on Windows with time in tray', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: true,
      darkMode: false,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInvertedPaused.ico')
  })

  it('trayIconFileName works for inverted monochrome on Windows (with dark on)', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: true,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInverted.ico')
  })

  it('trayIconFileName works for inverted monochrome on Windows (with dark on) with time in tray', function () {
    const params = {
      paused: false,
      monochrome: true,
      inverted: true,
      darkMode: true,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInvertedNumber2.ico')
  })

  it('trayIconFileName works for paused inverted monochrome on Windows (with dark on)', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: true,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInvertedPaused.ico')
  })

  it('trayIconFileName works for paused inverted monochrome on Windows (with dark on) with time in tray', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: true,
      darkMode: true,
      trayIconStyle: 'time',
      timeToBreak: 2,
      reference: 'startMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.trayIconFileName.should.equal('trayMonochromeInvertedPaused.ico')
  })

  it('windowIconFileName works for dark', function () {
    const params = {
      paused: true,
      monochrome: false,
      inverted: true,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('trayDark.png')
  })

  it('windowIconFileName works for light', function () {
    const params = {
      paused: true,
      monochrome: false,
      inverted: true,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('tray.png')
  })

  it('windowIconFileName ignores monochrome and stays colour', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: false,
      darkMode: false,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('tray.png')
  })

  it('windowIconFileName ignores monochrome and stays colour in dark mode', function () {
    const params = {
      paused: true,
      monochrome: true,
      inverted: true,
      darkMode: true,
      trayIconStyle: 'default',
      timeToBreak: 2,
      reference: 'finishMicrobreak'
    }
    const appIcon = new AppIcon(params)
    appIcon.windowIconFileName.should.equal('trayDark.png')
  })

  const textParams = { paused: false, monochrome: false, inverted: false, darkMode: false, trayIconStyle: 'text', timeToBreak: 25, reference: 'startMicrobreak' }

  it('trayIconFileName uses the text-only icon on Windows in light mode', function () {
    new AppIcon(textParams).trayIconFileName.should.equal('trayTextNumber25.ico')
  })

  it('trayIconFileName uses the light text icon in dark mode', function () {
    new AppIcon({ ...textParams, darkMode: true }).trayIconFileName.should.equal('trayTextDarkNumber25.ico')
  })

  it('trayIconFileName falls back to the regular icon when paused with text style', function () {
    new AppIcon({ ...textParams, paused: true }).trayIconFileName.should.equal('trayPaused.ico')
  })

  it('trayIconFileName falls back to the regular icon during a break with text style', function () {
    new AppIcon({ ...textParams, reference: 'finishBreak' }).trayIconFileName.should.equal('tray.ico')
  })

  it('textNumber is the minutes to break for the text style', function () {
    new AppIcon(textParams).textNumber.should.equal(25)
    new AppIcon({ ...textParams, timeToBreak: 0 }).textNumber.should.equal(0)
  })

  it('textNumber is null for other tray styles', function () {
    ;(new AppIcon({ ...textParams, trayIconStyle: 'time' }).textNumber === null).should.equal(true)
  })

  it('textNumber is null when paused or during a break', function () {
    ;(new AppIcon({ ...textParams, paused: true }).textNumber === null).should.equal(true)
    ;(new AppIcon({ ...textParams, reference: 'finishMicrobreak' }).textNumber === null).should.equal(true)
  })

  it('textNumber is null when the number does not fit two digits', function () {
    ;(new AppIcon({ ...textParams, timeToBreak: 100 }).textNumber === null).should.equal(true)
    ;(new AppIcon({ ...textParams, timeToBreak: undefined }).textNumber === null).should.equal(true)
  })
})
