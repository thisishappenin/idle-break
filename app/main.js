import {
  app, nativeTheme, BrowserWindow, Menu, ipcMain,
  screen, shell, dialog, globalShortcut, Tray,
  powerMonitor
} from 'electron'
import { EventEmitter } from 'node:events'
import { readFile, writeFile, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'path'
import { resolveLocalImage } from './utils/imageResolver.js'
import { resolveLocalAudio } from './utils/audioResolver.js'
import { fileURLToPath } from 'url'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import log from 'electron-log/main.js'
import Store from 'electron-store'
import humanizeDuration from 'humanize-duration'
import { DateTime } from 'luxon'

import {
  canPostpone, canSkip, formatTimeRemaining,
  minutesRemaining, insideWindowsPortable
} from './utils/utils.js'
import IdeasLoader from './utils/ideasLoader.js'
import BreaksPlanner from './breaksPlanner.js'
import AppIcon from './utils/appIcon.js'
import TrayNumberIcons from './utils/trayNumberIcons.js'
import TrayPanel from './utils/trayPanel.js'
import { buildTrayPanelState } from './utils/trayPanelState.js'
import { breakWindowSize } from './utils/breakWindowSize.js'
import { countdownColor, trayNumberColor } from './utils/countdownColor.js'
import { UntilMorning } from './utils/untilMorning.js'
import AutostartManager from './utils/autostartManager.js'
import Command from './utils/commands.js'
import { registerBreakShortcuts, setupBreak, shortcuts as breakShortcuts } from './utils/breakShortcuts.js'
import defaultSettings from './utils/defaultSettings.js'
import StatusMessages from './utils/statusMessages.js'
import DisplayManager from './utils/displayManager.js'
import { readSystemUsesDarkTheme } from './utils/windowsTheme.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let handlingUncaughtException = false
process.on('uncaughtException', (err, _) => {
  log.error(err)
  if (handlingUncaughtException) {
    return
  }
  handlingUncaughtException = true
  const dialogOpts = {
    type: 'error',
    title: 'Stretchly',
    message: 'An error occurred while running Stretchly and it will now quit. To report the issue, click Report.',
    buttons: ['Report', 'OK']
  }
  dialog.showMessageBox(dialogOpts).then(async (returnValue) => {
    if (returnValue.response === 0) {
      try {
        await shell.openExternal('https://github.com/thisishappenin/stretchly/issues')
      } catch (error) {
        log.error(error)
      }
    }
  }).catch((error) => {
    log.error(error)
  }).finally(() => {
    app.exit(1)
  })
})

nativeTheme.on('updated', function theThemeHasChanged () {
  if (!gotTheLock || !i18next.isInitialized) {
    return
  }
  refreshWindowsTheme()
  updateTray()
})

let windowsUsesDarkTheme = null
let lastWindowsThemeCheck = 0

async function refreshWindowsTheme () {
  lastWindowsThemeCheck = Date.now()
  const usesDark = await readSystemUsesDarkTheme()
  if (usesDark === null || usesDark === windowsUsesDarkTheme) return
  windowsUsesDarkTheme = usesDark
  updateTray()
}

let microbreakIdeas
let breakIdeas
let breakPlanner
let toastWin = null
let toastTimer = null
let toastAction = null
let appIcon = null
let autostartManager = null
let displayManager = null
let processWin = null
let microbreakWins = null
let breakWins = null
let preferencesWin = null
let welcomeWin = null
let contributorPreferencesWin = null
let syncPreferencesWin = null
let myStretchlyWin = null
let settings
let pausedForSuspendOrLock = false
let nextIdea = null
let lastBreak = null
let danger = 0
let updateChecker
let currentTrayIconPath = null
let currentTrayMenuTemplate = null
let trayUpdateIntervalObj = null

if (insideWindowsPortable()) {
  const portableDataPath = join(process.env.PORTABLE_EXECUTABLE_DIR, 'Data')
  if (!existsSync(portableDataPath)) {
    mkdirSync(portableDataPath, { recursive: true })
  }
  app.setPath('userData', portableDataPath)
}

log.initialize({ preload: true })

// Match the appId the installer stamps onto the shortcut so notifications show Stretchly.
// Skip unpackaged dev runs.
if (process.platform === 'win32' && app.isPackaged) {
  app.setAppUserModelId('net.hovancik.stretchly')
}

const global = {
  isNewVersion: false,
  isContributor: false
}

ipcMain.on('set-global-value', (event, name, value) => {
  global[name] = value
})

ipcMain.handle('get-global-value', (event, name) => {
  return global[name]
})

const commandLineArguments = process.argv
  .slice(app.isPackaged ? 1 : 2)

const gotTheLock = app.requestSingleInstanceLock(commandLineArguments)

if (!gotTheLock) {
  const cmd = new Command(commandLineArguments, app.getVersion(), false)
  cmd.runOrForward()
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory, commandLineArguments) => {
    log.info(`Stretchly: arguments received from second instance: ${commandLineArguments}`)
    const cmd = new Command(commandLineArguments, app.getVersion())

    if (!cmd.hasSupportedCommand) {
      return
    }

    if (!cmd.checkInMain()) {
      log.info(`Stretchly: command '${cmd.command}' executed in second instance, dropped in main instance`)
      return
    }

    switch (cmd.command) {
      case 'reset':
        log.info('Stretchly: resetting breaks (requested by second instance)')
        resetBreaks()
        break

      case 'mini': {
        log.info('Stretchly: skip to Mini break (requested by second instance)')
        const delay = cmd.waitToMs()
        if (delay === -1) {
          log.error('Stretchly: error parsing wait interval to ms because of invalid value')
          return
        }
        if (cmd.options.title) nextIdea = cmd.options.title
        if (!cmd.options.noskip || delay) skipToMicrobreak(delay)
        break
      }

      case 'long': {
        log.info('Stretchly: skip to Long break (requested by second instance)')
        const delay = cmd.waitToMs()
        if (delay === -1) {
          log.error('Stretchly: error parsing wait interval to ms because of invalid value')
          return
        }
        nextIdea = [cmd.options.title ? cmd.options.title : null, cmd.options.text ? cmd.options.text : null]
        if (!cmd.options.noskip || delay) skipToBreak(delay)
        break
      }

      case 'last':
        log.info('Stretchly: start last break again (requested by second instance)')
        startLastBreakAgain()
        break

      case 'resume':
        log.info('Stretchly: resume Breaks (requested by second instance)')
        if (breakPlanner.isPaused) resumeBreaks(false)
        break

      case 'toggle':
        log.info('Stretchly: toggle Breaks (requested by second instance)')
        if (breakPlanner.isPaused) resumeBreaks(false)
        else pauseBreaks(1)
        break

      case 'postpone':
      case 'skip':
      case 'finish': {
        log.info(`Stretchly: requesting to ${cmd.command} the current break (requested by second instance)`)
        const reference = breakPlanner?.scheduler?.reference
        let windows
        if (reference === 'finishMicrobreak') {
          windows = microbreakWins
        } else if (reference === 'finishBreak') {
          windows = breakWins
        }
        const win = windows?.find(win =>
          !win.isDestroyed() &&
          (win.isVisible() || win.isMinimized()) &&
          !win.webContents.getURL().includes('?blank=1'))
        if (win) {
          win.webContents.send(`request-${cmd.command}-break`)
        } else {
          log.info(`Stretchly: cannot ${cmd.command} break (source: cli): no active break window`)
        }
        break
      }

      case 'pause': {
        log.info('Stretchly: pause Breaks (requested by second instance)')
        const duration = cmd.durationToMs(settings)
        // -1 indicates an invalid value
        if (duration === -1) {
          log.error('Stretchly: error when parsing duration to ms because of invalid value')
          return
        }
        pauseBreaks(duration)
        break
      }

      case 'preferences':
        log.info('Stretchly: open Preferences window (requested by second instance)')
        createPreferencesWindow()
        break
    }
  })
}

app.on('ready', initialize)
app.on('window-all-closed', () => {
  // do nothing, so app wont get closed
})
app.on('before-quit', (event) => {
  if ((breakPlanner?.scheduler?.reference === 'finishMicrobreak' && settings?.get('microbreakStrictMode')) ||
      (breakPlanner?.scheduler?.reference === 'finishBreak' && settings?.get('breakStrictMode'))
  ) {
    log.info('Stretchly: preventing app closure (in break with strict mode)')
    event.preventDefault()
  } else {
    globalShortcut.unregisterAll()
    if (processWin && !processWin.isDestroyed()) {
      processWin.destroy()
      processWin = null
    }
  }
})

async function initialize (isAppStart = true) {
  if (!gotTheLock) {
    return
  }
  // TODO maybe we should not reinitialize but handle everything when we save new values for preferences
  log.info(`Stretchly: ${isAppStart ? '' : 're'}initializing...`)
  EventEmitter.setMaxListeners(200) // for watching Store changes
  if (!settings) {
    settings = new Store({
      defaults: defaultSettings,
      beforeEachMigration: (store, context) => {
        log.info(`Stretchly: migrating preferences from Stretchly v${context.fromVersion} to v${context.toVersion}`)
      },
      migrations: {
        '1.13.0': store => {
          if (store.has('pauseBreaksShortcut')) {
            store.set('pauseBreaksToggleShortcut', store.get('pauseBreaksShortcut'))
            log.info(`Stretchly: settings pauseBreaksToggleShortcut to "${store.get('pauseBreaksShortcut')}"`)
            store.delete('pauseBreaksShortcut')
            log.info('Stretchly: removing pauseBreaksShortcut')
          } else {
            log.info('Stretchly: not migrating pauseBreaksShortcut')
          }
          if (store.has('pauseBreaksShortcut')) {
            store.delete('resumeBreaksShortcut')
            log.info('Stretchly: removing resumeBreaksShortcut')
          }
        },
        '1.17.0': store => {
          if (store.has('showBreakActionsInStrictMode')) {
            store.set('showTrayMenuInStrictMode', store.get('showBreakActionsInStrictMode'))
            log.info(`Stretchly: settings showTrayMenuInStrictMode to "${store.get('showBreakActionsInStrictMode')}"`)
            store.delete('showBreakActionsInStrictMode')
            log.info('Stretchly: removing showBreakActionsInStrictMode')
          } else {
            log.info('Stretchly: not migrating showBreakActionsInStrictMode')
          }
        },
        '1.19.0': store => {
          if (store.has('audio')) {
            const legacyAudio = store.get('audio')
            store.set('longBreakAudio', legacyAudio)
            log.info(`Stretchly: migrating audio to longBreakAudio with value "${legacyAudio}"`)
            store.delete('audio')
            log.info('Stretchly: removing audio')
          } else {
            log.info('Stretchly: not migrating audio to longBreakAudio')
          }
          if (store.has('microbreakStartSoundPlaying')) {
            const val = store.get('microbreakStartSoundPlaying') ? store.get('miniBreakAudio') : 'silence'
            store.set('miniBreakStartSound', val)
            log.info(`Stretchly: migrating microbreakStartSoundPlaying to miniBreakStartSound with value "${val}"`)
            store.delete('microbreakStartSoundPlaying')
            log.info('Stretchly: removing microbreakStartSoundPlaying')
          } else {
            log.info('Stretchly: not migrating microbreakStartSoundPlaying')
          }
          if (store.has('breakStartSoundPlaying')) {
            const val = store.get('breakStartSoundPlaying') ? store.get('longBreakAudio') : 'silence'
            store.set('longBreakStartSound', val)
            log.info(`Stretchly: migrating breakStartSoundPlaying to longBreakStartSound with value "${val}"`)
            store.delete('breakStartSoundPlaying')
            log.info('Stretchly: removing breakStartSoundPlaying')
          } else {
            log.info('Stretchly: not migrating breakStartSoundPlaying')
          }
        },
        '1.20.0': store => {
          if (store.has('timeToBreakInTray')) {
            if (store.get('timeToBreakInTray')) {
              store.set('trayIconStyle', 'time')
              log.info('Stretchly: migrating timeToBreakInTray to trayIconStyle="time"')
            } else {
              store.set('trayIconStyle', 'default')
              log.info('Stretchly: migrating tray settings to trayIconStyle="default"')
            }
            store.delete('timeToBreakInTray')
          }
        },
        '1.22.0': store => {
          if (store.has('useMonochromeInvertedTrayIcon')) {
            if (store.get('useMonochromeInvertedTrayIcon')) {
              store.set('trayIconThemeSource', 'dark')
              log.info('Stretchly: migrating useMonochromeInvertedTrayIcon to trayIconThemeSource="dark"')
            } else {
              store.set('trayIconThemeSource', 'system')
              log.info('Stretchly: migrating useMonochromeInvertedTrayIcon to trayIconThemeSource="system"')
            }
            store.delete('useMonochromeInvertedTrayIcon')
          } else {
            log.info('Stretchly: not migrating useMonochromeInvertedTrayIcon')
          }
          if (store.get('appExclusionsCheckInterval') === 1000) {
            store.set('appExclusionsCheckInterval', 2000)
            log.info('Stretchly: migrating appExclusionsCheckInterval from 1000 to 2000')
          } else {
            log.info('Stretchly: not migrating appExclusionsCheckInterval')
          }
        }
      },
      watch: true
    })
    log.info('Stretchly: loading preferences')
    Store.initRenderer()
    Object.entries(settings.store).forEach(([key, _]) => {
      settings.onDidChange(key, (newValue, oldValue) => {
        log.info(`Stretchly: setting '${key}' to '${JSON.stringify(newValue)}' (was '${JSON.stringify(oldValue)}')`)
      })
    })
  }
  if (!breakPlanner) {
    breakPlanner = new BreaksPlanner(settings)
    breakPlanner.nextBreak()
    breakPlanner.on('startMicrobreakNotification', () => {
      if (!breakPlanner.deferBreakForMeeting('startMicrobreakNotification')) startMicrobreakNotification()
    })
    breakPlanner.on('startBreakNotification', () => {
      if (!breakPlanner.deferBreakForMeeting('startBreakNotification')) startBreakNotification()
    })
    breakPlanner.on('startMicrobreak', () => {
      if (!breakPlanner.deferBreakForMeeting('startMicrobreak')) startMicrobreak()
    })
    breakPlanner.on('finishMicrobreak', (shouldPlaySound, shouldPlanNext) => {
      if (settings.get('miniBreakManualFinish')) {
        enterMiniBreakManualContinuation(shouldPlaySound)
        return
      }
      decreaseDanger(1)
      finishMicrobreak(shouldPlaySound, shouldPlanNext)
    })
    breakPlanner.on('startBreak', () => {
      if (!breakPlanner.deferBreakForMeeting('startBreak')) startBreak()
    })
    breakPlanner.on('finishBreak', (shouldPlaySound, shouldPlanNext) => {
      if (settings.get('longBreakManualFinish')) {
        enterLongBreakManualContinuation(shouldPlaySound)
        return
      }
      decreaseDanger(2)
      finishBreak(shouldPlaySound, shouldPlanNext)
    })
    breakPlanner.on('resumeBreaks', () => { resumeBreaks() })
    breakPlanner.on('idleReset', () => {
      if (settings.get('naturalBreaksResetNotification')) {
        showToast({
          message: i18next.t('main.idleReset'),
          actionLabel: i18next.t('main.undoIdleReset'),
          onAction: () => breakPlanner.undoIdleReset()
        })
      }
    })
    breakPlanner.on('updateToolTip', function () {
      updateTray()
    })
  } else {
    breakPlanner.clear()
    breakPlanner.appExclusionsManager.reinitialize(settings)
    breakPlanner.doNotDisturb(settings.get('monitorDnd'))
    breakPlanner.meetings(settings.get('monitorMeetings'))
    breakPlanner.naturalBreaks(settings.get('naturalBreaks'))
    breakPlanner.nextBreak()
  }

  autostartManager = new AutostartManager({ app })

  if (!settings.get('_migratedOpenAtLogin')) {
    // one time migration with 1.20 or after
    settings.set('openAtLogin', await autostartManager.autoLaunchStatus())
    settings.set('_migratedOpenAtLogin', true)
    log.info('Stretchly: Migrated to openAtLogin')
  }

  const currentAutostartValue = await autostartManager.autoLaunchStatus()
  const openAtLogin = settings.get('openAtLogin')
  if (openAtLogin !== currentAutostartValue) {
    autostartManager.setAutostartEnabled(openAtLogin)
  }
  log.info(`Stretchly: attempting to set autostart to ${openAtLogin}`)

  const imagesDir = join(app.getPath('userData'), 'images')
  if (!existsSync(imagesDir)) {
    try {
      mkdirSync(imagesDir, { recursive: true })
    } catch (error) {
      log.error('Stretchly: error creating images directory', error)
    }
  }

  const audioDir = join(app.getPath('userData'), 'audio')
  if (!existsSync(audioDir)) {
    try {
      mkdirSync(audioDir, { recursive: true })
    } catch (error) {
      log.error('Stretchly: error creating audio directory', error)
    }
  }
  displayManager = new DisplayManager(settings)

  try {
    await startI18next()
  } catch (err) {
    log.error(err.stack)
  }

  loadIdeas()

  startProcessWin()
  createWelcomeWindow()
  nativeTheme.themeSource = settings.get('themeSource')

  readFile(join(app.getPath('userData'), 'stamp'), 'utf8', (err, data) => {
    if (err) {
      return
    }
    if (DateTime.fromISO(data).month === DateTime.now().month) {
      global.isContributor = true
      log.info('Stretchly: Thanks for your contributions!')
      if (preferencesWin) {
        preferencesWin.webContents.send('enable-contributor-preferences')
      }
      updateTray()
    }
  })
  startPowerMonitoring()
  if (preferencesWin) {
    preferencesWin.webContents.send('renderSettings', settings.store)
  }
  if (welcomeWin) {
    welcomeWin.webContents.send('renderSettings', settings.store)
  }
  if (contributorPreferencesWin) {
    contributorPreferencesWin.webContents.send('renderSettings', settings.store)
  }
  globalShortcut.unregisterAll()

  registerBreakShortcuts({
    settings,
    log,
    globalShortcut,
    breakPlanner,
    functions: shortcutFunctions()
  })

  updateTray()
}

function shortcutFunctions () {
  return { pauseBreaks, resumeBreaks, skipToBreak, skipToMicrobreak, resetBreaks, startLastBreakAgain }
}

function startI18next () {
  return i18next
    .use(Backend)
    .init({
      lng: settings.get('language'),
      fallbackLng: 'en',
      debug: !app.isPackaged,
      backend: {
        loadPath: join(__dirname, '/locales/{{lng}}.json'),
        jsonIndent: 2
      }
    })
}

i18next.on('languageChanged', () => {
  if (!i18next.isInitialized) {
    return
  }
  if (welcomeWin) {
    welcomeWin.webContents.send('translate')
  }
  if (preferencesWin) {
    preferencesWin.webContents.send('translate')
  }
  updateTray()
  loadIdeas()
})

function onSuspendOrLock () {
  log.info('System: suspend or lock')
  if (settings.get('pauseForSuspendOrLock')) {
    if (breakPlanner.isPaused || breakPlanner.dndManager.isOnDnd ||
      breakPlanner.naturalBreaksManager.isSchedulerCleared ||
      breakPlanner.appExclusionsManager.isSchedulerCleared) {
      log.info('Stretchly: not pausing for suspendOrLock because paused already')
    } else {
      pausedForSuspendOrLock = true
      pauseBreaks(1)
      updateTray()
    }
  } else {
    log.info('Stretchly: not pausing for suspendOrLock because setting is disabled')
  }
}

function onResumeOrUnlock () {
  log.info('System: resume or unlock')
  if (pausedForSuspendOrLock) {
    pausedForSuspendOrLock = false
    resumeBreaks(false)
  } else {
    // correct the planner for the time spent in suspend
    breakPlanner.correctScheduler()
  }
  updateTray()
}

function startPowerMonitoring () {
  powerMonitor.removeListener('suspend', onSuspendOrLock)
  powerMonitor.removeListener('lock-screen', onSuspendOrLock)
  powerMonitor.removeListener('resume', onResumeOrUnlock)
  powerMonitor.removeListener('unlock-screen', onResumeOrUnlock)
  powerMonitor.on('suspend', onSuspendOrLock)
  powerMonitor.on('lock-screen', onSuspendOrLock)
  powerMonitor.on('resume', onResumeOrUnlock)
  powerMonitor.on('unlock-screen', onResumeOrUnlock)
}

function closeWindows (windowArray) {
  for (const window of windowArray) {
    if (!window || window.isDestroyed()) {
      continue
    }

    window.hide()
    if (windowArray[0] === window) {
      ipcMain.removeHandler('send-long-break-data')
      ipcMain.removeHandler('send-mini-break-data')
    }

    // Use destroy() for immediate, guaranteed cleanup on all platforms
    window.destroy()
  }
  return null
}

function trayIconUseDarkColors () {
  const source = settings.get('trayIconThemeSource')
  if (source === 'light') return false
  if (source === 'dark') return true
  if (process.platform === 'win32') return windowsUsesDarkTheme ?? nativeTheme.shouldUseDarkColorsForSystemIntegratedUI
  return nativeTheme.shouldUseDarkColors
}

let trayNumberIcons = null
let trayIconRequestId = 0
const trayIconRequests = new Map()

ipcMain.on('tray-icon-rendered', (event, id, result) => {
  const request = trayIconRequests.get(id)
  if (!request) return
  trayIconRequests.delete(id)
  clearTimeout(request.timeout)
  if (result?.error) {
    request.reject(new Error(result.error))
  } else {
    request.resolve(result?.frames ?? null)
  }
})

function renderTrayIcon (request) {
  if (!processWin || processWin.isDestroyed() || processWin.webContents.isLoading()) {
    return Promise.resolve(null)
  }
  return new Promise((resolve, reject) => {
    const id = ++trayIconRequestId
    const timeout = setTimeout(() => {
      trayIconRequests.delete(id)
      resolve(null)
    }, 5000)
    trayIconRequests.set(id, { resolve, reject, timeout })
    processWin.webContents.send('render-tray-icon', id, request)
  })
}

function drawnTrayNumberPath (number, useDarkColors) {
  const font = settings.get('trayIconFont')
  if (process.platform !== 'win32' || number === null || !font) return null
  trayNumberIcons ??= new TrayNumberIcons({
    directory: join(app.getPath('userData'), 'tray-icons'),
    render: renderTrayIcon,
    onReady: updateTray
  })
  return trayNumberIcons.pathFor({
    text: String(number),
    font,
    dark: useDarkColors,
    crisp: settings.get('trayIconCrispDigits'),
    heightRatio: settings.get('trayIconFontSize'),
    color: trayNumberColor(settings)
  })
}

function trayIconPath () {
  const useDarkColors = trayIconUseDarkColors()
  const params = {
    paused:
      breakPlanner.isPaused ||
      breakPlanner.dndManager.isOnDnd ||
      breakPlanner.naturalBreaksManager.isSchedulerCleared ||
      breakPlanner.appExclusionsManager.isSchedulerCleared,
    monochrome: settings.get('useMonochromeTrayIcon'),
    inverted: useDarkColors,
    darkMode: useDarkColors,
    trayIconStyle: settings.get('trayIconStyle'),
    timeToBreak: minutesRemaining(breakPlanner.timeToNextBreak),
    percentage: breakPlanner.progressPercentage,
    reference: breakPlanner.scheduler.reference
  }
  const icon = new AppIcon(params)
  const drawnPath = drawnTrayNumberPath(icon.textNumber, useDarkColors)
  if (drawnPath) return drawnPath
  const trayIconFileName = icon.trayIconFileName
  const pathToTrayIcon = join(__dirname, '/images/app-icons/', trayIconFileName)
  return pathToTrayIcon
}

function windowIconPath () {
  const params = {
    darkMode: nativeTheme.shouldUseDarkColors
  }
  const windowIconFileName = new AppIcon(params).windowIconFileName
  return join(__dirname, '/images/app-icons', windowIconFileName)
}

function closeToast () {
  clearTimeout(toastTimer)
  toastAction = null
  if (toastWin && !toastWin.isDestroyed()) toastWin.destroy()
  toastWin = null
}

function showToast ({ message, actionLabel, onAction, duration = 10000 }) {
  closeToast()
  const size = { width: 340, height: actionLabel ? 104 : 68 }
  toastWin = new BrowserWindow({
    ...size,
    ...displayManager.getPopupPosition(size),
    frame: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, './toast-preload.mjs'),
      sandbox: false
    }
  })
  toastWin.setAlwaysOnTop(true, 'pop-up-menu')
  toastAction = onAction ?? null
  const query = new URLSearchParams({
    message,
    duration: String(duration),
    background: calculateBackgroundColor(settings.get('mainColor'))
  })
  if (actionLabel) query.set('action', actionLabel)
  toastWin.loadURL('file://' + join(__dirname, '/toast.html') + '?' + query)
  toastWin.once('ready-to-show', () => toastWin?.showInactive())
  toastTimer = setTimeout(closeToast, duration)
}

ipcMain.on('toast-action', () => {
  const action = toastAction
  closeToast()
  action?.()
})

ipcMain.on('toast-dismiss', closeToast)

function startProcessWin () {
  if (processWin) {
    planVersionCheck()
    return
  }
  const modalPath = 'file://' + join(__dirname, '/process.html')

  processWin = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    backgroundThrottling: false,
    webPreferences: {
      preload: join(__dirname, './process-preload.mjs'),
      sandbox: false
    }
  })
  processWin.webContents.loadURL(modalPath)
  processWin.webContents.once('ready-to-show', () => {
    planVersionCheck()
  })
}

function createWelcomeWindow (isAppStart = true) {
  if (settings.get('isFirstRun') && isAppStart) {
    const modalPath = 'file://' + join(__dirname, '/welcome.html')
    welcomeWin = new BrowserWindow({
      x: displayManager.getDisplayX(-1, 1000),
      y: displayManager.getDisplayY(-1, 750),
      width: 1000,
      height: 750,
      show: false,
      autoHideMenuBar: true,
      icon: windowIconPath(),
      backgroundColor: 'EDEDED',
      webPreferences: {
        preload: join(__dirname, './welcome-preload.mjs'),
        sandbox: false
      }
    })
    welcomeWin.webContents.loadURL(modalPath)
    welcomeWin.once('ready-to-show', () => {
      welcomeWin.center()
      welcomeWin.show()
    })
    welcomeWin.once('closed', () => {
      welcomeWin = null
    })
  }
}

function createContributorSettingsWindow () {
  if (contributorPreferencesWin) {
    contributorPreferencesWin.show()
    return
  }
  const modalPath = 'file://' + join(__dirname, '/contributor-preferences.html')
  contributorPreferencesWin = new BrowserWindow({
    x: displayManager.getDisplayX(-1, 735),
    y: displayManager.getDisplayY(),
    width: 735,
    show: false,
    autoHideMenuBar: true,
    icon: windowIconPath(),
    backgroundColor: 'EDEDED',
    webPreferences: {
      preload: join(__dirname, './contributor-preferences-preload.mjs'),
      sandbox: false
    }
  })
  contributorPreferencesWin.webContents.loadURL(modalPath)
  contributorPreferencesWin.once('ready-to-show', () => {
    contributorPreferencesWin.center()
    contributorPreferencesWin.show()
  })
  contributorPreferencesWin.once('closed', () => {
    contributorPreferencesWin = null
  })
}

function createSyncPreferencesWindow () {
  if (syncPreferencesWin) {
    syncPreferencesWin.show()
    return
  }

  const syncPreferencesUrl = 'https://my.stretchly.net/app/v1/sync'
  syncPreferencesWin = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    width: 1000,
    height: 700,
    icon: windowIconPath(),
    x: displayManager.getDisplayX(),
    y: displayManager.getDisplayY(),
    backgroundColor: 'whitesmoke',
    webPreferences: {
      preload: join(__dirname, './electron-bridge.mjs'),
      sandbox: false
    }
  })
  syncPreferencesWin.webContents.loadURL(syncPreferencesUrl)

  syncPreferencesWin.once('closed', () => {
    syncPreferencesWin = null
  })

  syncPreferencesWin.once('ready-to-show', () => {
    syncPreferencesWin.center()
    syncPreferencesWin.show()
  })
}

function planVersionCheck (seconds = 1) {
  if (settings.get('disableAppUpdateFeatures')) return
  if (updateChecker) {
    clearTimeout(updateChecker)
    updateChecker = null
  }
  updateChecker = setTimeout(checkVersion, seconds * 1000)
}

function checkVersion () {
  if (settings.get('disableAppUpdateFeatures')) return
  if (settings.get('checkNewVersion')) {
    processWin.webContents.send('check-version',
      `v${app.getVersion()}`,
      settings.get('notifyNewVersion'),
      settings.get('silentNotifications')
    )
    planVersionCheck(3600 * 48)
  }
}

function startMicrobreakNotification () {
  showNotification(i18next.t(settings.get('singleBreakType') ? 'main.singleBreakIn' : 'main.microbreakIn', { seconds: settings.get('microbreakNotificationInterval') / 1000 }), settings.get('microbreakNotificationInterval'))
  log.info('Stretchly: showing Mini break notification')
  breakPlanner.nextBreakAfterNotification()
  updateTray()
}

function startBreakNotification () {
  showNotification(i18next.t('main.breakIn', { seconds: settings.get('breakNotificationInterval') / 1000 }), settings.get('breakNotificationInterval'))
  log.info('Stretchly: showing Long break notification')
  breakPlanner.nextBreakAfterNotification()
  updateTray()
}

function placeBreakWindow (win, displayId) {
  if (win.isDestroyed()) return
  if (!displayManager.usesCornerPosition) {
    win.center()
    return
  }
  const [width, height] = win.getSize()
  const { x, y } = displayManager.getBreakWindowPosition(displayId, { width, height })
  win.setPosition(x, y)
}

const BREAK_PREVIEW_KEYS = ['mainColor', 'miniBreakColor', 'transparentMode', 'opacity', 'breakWindowWidth', 'breakWindowHeight', 'breakWindowPosition', 'showBreaksAsRegularWindows', 'fullscreen', 'countdownColorCustom', 'countdownColor']
const BREAK_PREVIEW_RESIZE_KEYS = ['breakWindowWidth', 'breakWindowHeight', 'breakWindowPosition']
const BREAK_PREVIEW_DURATION = 4000
const BREAK_PREVIEW_SECONDS_ELAPSED = 13
let breakPreviewWin = null
let breakPreviewCloseTimer = null
let breakPreviewCreateTimer = null
let breakPreviewHandlerAdded = false
let breakPreviewLoadedListener = null

function breakWindowSizeFor (displayId) {
  return breakWindowSize({
    displayWidth: displayManager.getDisplayWidth(displayId),
    displayHeight: displayManager.getDisplayHeight(displayId),
    widthRatio: settings.get('breakWindowWidth'),
    heightRatio: settings.get('breakWindowHeight')
  })
}

function breakPreviewDisplayId () {
  const contentDisplayId = displayManager.getContentDisplayId()
  return contentDisplayId !== -1 ? contentDisplayId : 0
}

function breakPreviewBounds (displayId) {
  if (settings.get('fullscreen')) {
    return {
      width: displayManager.getDisplayWidth(displayId),
      height: displayManager.getDisplayHeight(displayId),
      x: displayManager.getDisplayX(displayId, 0, true),
      y: displayManager.getDisplayY(displayId, 0, true)
    }
  }
  const size = breakWindowSizeFor(displayId)
  return { ...size, ...displayManager.getBreakWindowPosition(displayId, size) }
}

function destroyBreakPreview () {
  if (breakPreviewLoadedListener) {
    ipcMain.off('mini-break-loaded', breakPreviewLoadedListener)
    breakPreviewLoadedListener = null
  }
  if (breakPreviewHandlerAdded) {
    ipcMain.removeHandler('send-mini-break-data')
    breakPreviewHandlerAdded = false
  }
  if (breakPreviewWin && !breakPreviewWin.isDestroyed()) breakPreviewWin.destroy()
  breakPreviewWin = null
}

function closeBreakPreview () {
  clearTimeout(breakPreviewCloseTimer)
  clearTimeout(breakPreviewCreateTimer)
  breakPreviewCloseTimer = null
  breakPreviewCreateTimer = null
  destroyBreakPreview()
}

function createBreakPreview () {
  if (microbreakWins || breakWins) return
  destroyBreakPreview()
  const showBreaksAsRegularWindows = settings.get('showBreaksAsRegularWindows')
  const color = calculateBackgroundColor(settings.get('miniBreakColor'))
  const idea = settings.get('ideas') ? microbreakIdeas.randomElement : ['']

  ipcMain.handle('send-mini-break-data', () => [
    idea, Date.now() - BREAK_PREVIEW_SECONDS_ELAPSED * 1000, 5 * 60 * 1000, false,
    true, 100, color, 0, false, true, countdownColor(settings)
  ])
  breakPreviewHandlerAdded = true

  const win = new BrowserWindow({
    ...breakPreviewBounds(breakPreviewDisplayId()),
    autoHideMenuBar: true,
    icon: windowIconPath(),
    resizable: false,
    frame: showBreaksAsRegularWindows,
    show: false,
    backgroundThrottling: false,
    transparent: !showBreaksAsRegularWindows,
    backgroundColor: !showBreaksAsRegularWindows && displayManager.usesCornerPosition ? '#00000000' : color,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    hasShadow: false,
    title: 'Stretchly',
    webPreferences: {
      preload: join(__dirname, './microbreak-preload.mjs'),
      sandbox: false
    }
  })
  breakPreviewWin = win
  win.setIgnoreMouseEvents(true)
  win.on('closed', () => {
    if (breakPreviewWin === win) breakPreviewWin = null
  })

  breakPreviewLoadedListener = (event) => {
    if (event.sender !== win.webContents) return
    ipcMain.off('mini-break-loaded', breakPreviewLoadedListener)
    breakPreviewLoadedListener = null
    if (!win.isDestroyed()) win.showInactive()
  }
  ipcMain.on('mini-break-loaded', breakPreviewLoadedListener)
  win.loadURL('file://' + join(__dirname, '/microbreak.html'))
}

function showBreakPreview (resizeOnly = false) {
  if (microbreakWins || breakWins || !processWin) return
  clearTimeout(breakPreviewCloseTimer)
  breakPreviewCloseTimer = setTimeout(closeBreakPreview, BREAK_PREVIEW_DURATION)
  if (resizeOnly && breakPreviewWin && !breakPreviewWin.isDestroyed()) {
    breakPreviewWin.setBounds(breakPreviewBounds(breakPreviewDisplayId()))
    return
  }
  clearTimeout(breakPreviewCreateTimer)
  breakPreviewCreateTimer = setTimeout(createBreakPreview, 150)
}

ipcMain.on('preview-break', () => showBreakPreview())

function startMicrobreak () {
  closeBreakPreview()
  closeToast()
  // don't start another break if break running
  if (microbreakWins) {
    log.warn('Stretchly: Mini break already running, not starting Mini break')
    return
  }

  const breakDuration = settings.get('microbreakDuration')
  const strictMode = settings.get('microbreakStrictMode')
  const postponesLimit = settings.get('microbreakPostponesLimit')
  const postponableDurationPercent = settings.get('microbreakPostponableDurationPercent')
  const postponable = settings.get('microbreakPostpone') &&
    breakPlanner.postponesNumber < postponesLimit && postponesLimit > 0
  const showBreaksAsRegularWindows = settings.get('showBreaksAsRegularWindows')
  const keepOnTop = !showBreaksAsRegularWindows || settings.get('breakWindowAlwaysOnTop')

  const modalPath = 'file://' + join(__dirname, '/microbreak.html')
  microbreakWins = []

  const idea = nextIdea || (settings.get('ideas') ? microbreakIdeas.randomElement : [''])
  nextIdea = null
  lastBreak = { type: 'mini', idea }

  if (!settings.get('silentNotifications')) {
    const sound = settings.get('miniBreakStartSound')
    if (sound !== 'silence') {
      processWin.webContents.send('play-sound', sound, settings.get('volume'))
    }
  }

  ipcMain.handle('send-mini-break-data', (event) => {
    const startTime = Date.now()
    const shortcut = settings.get('endBreakShortcut')
    if (shortcut) {
      globalShortcut.register(shortcut, () => {
        log.info('Stretchly: end break shortcut pressed during Mini break')
        const passedPercent = (Date.now() - startTime) / breakDuration * 100
        if (passedPercent >= 100) {
          decreaseDanger(1)
          finishMicrobreak(false)
          return
        }
        if (canPostpone(postponable, passedPercent, postponableDurationPercent)) {
          postponeMicrobreak()
        } else if (canSkip(strictMode, postponable, passedPercent, postponableDurationPercent, settings.get('alwaysShowSkip'))) {
          increaseDanger(1)
          finishMicrobreak(false)
        }
      })
    }
    return [idea, startTime, breakDuration, strictMode,
      postponable, postponableDurationPercent,
      calculateBackgroundColor(settings.get('miniBreakColor')), danger, settings.get('breakHealthMode'), settings.get('alwaysShowSkip'), countdownColor(settings)]
  })

  const contentDisplayId = displayManager.getContentDisplayId()
  const useContentScreen = settings.get('allScreens') && !showBreaksAsRegularWindows && contentDisplayId !== -1
  const emitOnId = useContentScreen ? contentDisplayId : 0

  for (let localDisplayId = 0; localDisplayId < displayManager.getDisplayCount(); localDisplayId++) {
    const isBlank = useContentScreen && localDisplayId !== contentDisplayId
    const windowOptions = {
      ...breakWindowSizeFor(localDisplayId),
      autoHideMenuBar: true,
      icon: windowIconPath(),
      resizable: false,
      frame: showBreaksAsRegularWindows,
      show: false,
      backgroundThrottling: false,
      transparent: !showBreaksAsRegularWindows,
      backgroundColor: !showBreaksAsRegularWindows && displayManager.usesCornerPosition ? '#00000000' : calculateBackgroundColor(settings.get('miniBreakColor')),
      skipTaskbar: !showBreaksAsRegularWindows,
      focusable: showBreaksAsRegularWindows,
      alwaysOnTop: keepOnTop,
      hasShadow: false,
      title: 'Stretchly',
      webPreferences: {
        preload: join(__dirname, './microbreak-preload.mjs'),
        sandbox: false
      }
    }

    if (settings.get('fullscreen')) {
      windowOptions.width = displayManager.getDisplayWidth(localDisplayId)
      windowOptions.height = displayManager.getDisplayHeight(localDisplayId)
      windowOptions.x = displayManager.getDisplayX(localDisplayId, 0, true)
      windowOptions.y = displayManager.getDisplayY(localDisplayId, 0, true)
    } else if (!settings.get('fullscreen')) {
      Object.assign(windowOptions, displayManager.getBreakWindowPosition(localDisplayId, windowOptions))
    }

    let microbreakWinLocal = new BrowserWindow(windowOptions)
    // seems to help with multiple-displays problems
    microbreakWinLocal.setSize(windowOptions.width, windowOptions.height)

    microbreakWinLocal.once('ready-to-show', () => {
      log.info('Stretchly: ready-to-show fired')
    })

    const onMiniBreakLoaded = (event) => {
      if (event.sender !== microbreakWinLocal.webContents) return
      ipcMain.off('mini-break-loaded', onMiniBreakLoaded)
      log.info('Stretchly: Mini break window loaded')
      if (showBreaksAsRegularWindows) {
        microbreakWinLocal.show()
      } else {
        microbreakWinLocal.showInactive()
      }

      log.info(`Stretchly: showing window ${localDisplayId + 1} of ${displayManager.getDisplayCount()}`)
      if (localDisplayId === emitOnId) {
        breakPlanner.emit('microbreakStarted', true)
        log.info('Stretchly: starting Mini break')
      }
      if (!settings.get('fullscreen')) {
        setTimeout(() => {
          placeBreakWindow(microbreakWinLocal, localDisplayId)
        }, 0)
      }
      updateTray()
    }
    ipcMain.on('mini-break-loaded', onMiniBreakLoaded)

    microbreakWinLocal.loadURL(isBlank ? modalPath + '?blank=1' : modalPath)
    microbreakWinLocal.setAlwaysOnTop(keepOnTop, 'pop-up-menu')
    if (microbreakWinLocal) {
      microbreakWinLocal.on('close', (e) => {
        if (breakPlanner.scheduler.timeLeft > 0 && settings.get('microbreakStrictMode')) {
          log.info('Stretchly: preventing closing break window as in strict mode')
          e.preventDefault()
        }
      })
      microbreakWinLocal.once('closed', () => {
        ipcMain.off('mini-break-loaded', onMiniBreakLoaded)
        microbreakWinLocal = null
      })
    }
    microbreakWins.push(microbreakWinLocal)

    if (!settings.get('allScreens')) {
      if (displayManager.getDisplayCount() > 1) {
        log.info('Stretchly: not showing on more Monitors as it is disabled.')
      }
      break
    }
  }
}

function startBreak () {
  closeBreakPreview()
  closeToast()
  if (breakWins) {
    log.warn('Stretchly: Long break already running, not starting Long break')
    return
  }

  const breakDuration = settings.get('breakDuration')
  const strictMode = settings.get('breakStrictMode')
  const postponesLimit = settings.get('breakPostponesLimit')
  const postponableDurationPercent = settings.get('breakPostponableDurationPercent')
  const postponable = settings.get('breakPostpone') &&
    breakPlanner.postponesNumber < postponesLimit && postponesLimit > 0
  const showBreaksAsRegularWindows = settings.get('showBreaksAsRegularWindows')
  const keepOnTop = !showBreaksAsRegularWindows || settings.get('breakWindowAlwaysOnTop')

  const modalPath = 'file://' + join(__dirname, '/break.html')
  breakWins = []

  const defaultNextIdea = settings.get('ideas') ? breakIdeas.randomElement : ['', '']
  const idea = nextIdea ? (nextIdea.map((val, index) => val || defaultNextIdea[index])) : defaultNextIdea
  nextIdea = null
  lastBreak = { type: 'long', idea }

  if (!settings.get('silentNotifications')) {
    const sound = settings.get('longBreakStartSound')
    if (sound !== 'silence') {
      processWin.webContents.send('play-sound', sound, settings.get('volume'))
    }
  }

  ipcMain.handle('send-long-break-data', (event) => {
    const startTime = Date.now()
    const shortcut = settings.get('endBreakShortcut')
    if (shortcut) {
      globalShortcut.register(shortcut, () => {
        log.info('Stretchly: end break shortcut pressed during Long break')
        const passedPercent = (Date.now() - startTime) / breakDuration * 100
        if (passedPercent >= 100) {
          decreaseDanger(2)
          finishBreak(false)
          return
        }
        if (canPostpone(postponable, passedPercent, postponableDurationPercent)) {
          postponeBreak()
        } else if (canSkip(strictMode, postponable, passedPercent, postponableDurationPercent, settings.get('alwaysShowSkip'))) {
          increaseDanger(2)
          finishBreak(false)
        }
      })
    }
    return [idea, startTime, breakDuration, strictMode,
      postponable, postponableDurationPercent,
      calculateBackgroundColor(settings.get('mainColor')), danger, settings.get('breakHealthMode'), settings.get('alwaysShowSkip'), countdownColor(settings)]
  })

  const contentDisplayId = displayManager.getContentDisplayId()
  const useContentScreen = settings.get('allScreens') && !showBreaksAsRegularWindows && contentDisplayId !== -1
  const emitOnId = useContentScreen ? contentDisplayId : 0

  for (let localDisplayId = 0; localDisplayId < displayManager.getDisplayCount(); localDisplayId++) {
    const isBlank = useContentScreen && localDisplayId !== contentDisplayId
    const windowOptions = {
      ...breakWindowSizeFor(localDisplayId),
      autoHideMenuBar: true,
      icon: windowIconPath(),
      resizable: false,
      frame: showBreaksAsRegularWindows,
      show: false,
      backgroundThrottling: false,
      transparent: !showBreaksAsRegularWindows,
      backgroundColor: !showBreaksAsRegularWindows && displayManager.usesCornerPosition ? '#00000000' : calculateBackgroundColor(settings.get('mainColor')),
      skipTaskbar: !showBreaksAsRegularWindows,
      focusable: showBreaksAsRegularWindows,
      alwaysOnTop: keepOnTop,
      hasShadow: false,
      title: 'Stretchly',
      webPreferences: {
        preload: join(__dirname, './break-preload.mjs'),
        sandbox: false
      }
    }

    if (settings.get('fullscreen')) {
      windowOptions.width = displayManager.getDisplayWidth(localDisplayId)
      windowOptions.height = displayManager.getDisplayHeight(localDisplayId)
      windowOptions.x = displayManager.getDisplayX(localDisplayId, 0, true)
      windowOptions.y = displayManager.getDisplayY(localDisplayId, 0, true)
    } else if (!settings.get('fullscreen')) {
      Object.assign(windowOptions, displayManager.getBreakWindowPosition(localDisplayId, windowOptions))
    }

    let breakWinLocal = new BrowserWindow(windowOptions)
    // seems to help with multiple-displays problems
    breakWinLocal.setSize(windowOptions.width, windowOptions.height)

    breakWinLocal.once('ready-to-show', () => {
      log.info('Stretchly: ready-to-show fired')
    })

    const onLongBreakLoaded = (event) => {
      if (event.sender !== breakWinLocal.webContents) return
      ipcMain.off('long-break-loaded', onLongBreakLoaded)
      log.info('Stretchly: Long break window loaded')
      if (showBreaksAsRegularWindows) {
        breakWinLocal.show()
      } else {
        breakWinLocal.showInactive()
      }

      log.info(`Stretchly: showing window ${localDisplayId + 1} of ${displayManager.getDisplayCount()}`)
      if (localDisplayId === emitOnId) {
        breakPlanner.emit('breakStarted', true)
        log.info('Stretchly: starting Long break')
      }

      if (!settings.get('fullscreen')) {
        setTimeout(() => {
          placeBreakWindow(breakWinLocal, localDisplayId)
        }, 0)
      }
      updateTray()
    }
    ipcMain.on('long-break-loaded', onLongBreakLoaded)

    breakWinLocal.loadURL(isBlank ? modalPath + '?blank=1' : modalPath)
    breakWinLocal.setAlwaysOnTop(keepOnTop, 'pop-up-menu')
    if (breakWinLocal) {
      breakWinLocal.on('close', (e) => {
        if (breakPlanner.scheduler.timeLeft > 0 && settings.get('breakStrictMode')) {
          log.info('Stretchly: preventing closing break window as in strict mode')
          e.preventDefault()
        }
      })
      breakWinLocal.once('closed', () => {
        ipcMain.off('long-break-loaded', onLongBreakLoaded)
        breakWinLocal = null
      })
    }
    breakWins.push(breakWinLocal)

    if (!settings.get('allScreens')) {
      if (displayManager.getDisplayCount() > 1) {
        log.info('Stretchly: not showing on more Monitors as it is disabled.')
      }
      break
    }
  }
}

function breakComplete (shouldPlaySound, windows, breakType) {
  if (settings.get('endBreakShortcut') && globalShortcut.isRegistered(settings.get('endBreakShortcut'))) {
    globalShortcut.unregister(settings.get('endBreakShortcut'))
  }
  if (shouldPlaySound && !settings.get('silentNotifications')) {
    const audio = breakType === 'mini' ? 'miniBreakAudio' : 'longBreakAudio'
    processWin.webContents.send('play-sound', settings.get(audio), settings.get('volume'))
  }
  return closeWindows(windows)
}

function increaseDanger (amount) {
  if (!settings.get('breakHealthMode')) {
    return
  }
  danger = Math.min(danger + amount, 10)
  log.info(`Stretchly: danger increased to ${danger}`)
}

function decreaseDanger (amount) {
  if (!settings.get('breakHealthMode')) {
    return
  }
  danger = Math.max(danger - amount, 0)
  log.info(`Stretchly: danger decreased to ${danger}`)
}

function enterManualAwaitPhase (type, shouldPlaySound) {
  const isMini = type === 'mini'
  const manualSettingKey = isMini ? 'miniBreakManualFinish' : 'longBreakManualFinish'
  if (!settings.get(manualSettingKey)) return
  if (shouldPlaySound && !settings.get('silentNotifications')) {
    const audioKey = isMini ? 'miniBreakAudio' : 'longBreakAudio'
    processWin.webContents.send('play-sound', settings.get(audioKey), settings.get('volume'))
  }
  const wins = isMini ? microbreakWins : breakWins
  if (wins) {
    wins.forEach(w => {
      if (w && !w.isDestroyed()) {
        w.webContents.send('enter-manual-await', isMini ? 'microbreak' : 'break')
      }
    })
  }
  log.info('Stretchly: entering manual finish phase (' + (isMini ? 'Mini' : 'Long') + ' break)')
}

const enterMiniBreakManualContinuation = (shouldPlaySound) => enterManualAwaitPhase('mini', shouldPlaySound)
const enterLongBreakManualContinuation = (shouldPlaySound) => enterManualAwaitPhase('long', shouldPlaySound)

function finishMicrobreak (shouldPlaySound = true, shouldPlanNext = true) {
  microbreakWins = breakComplete(shouldPlaySound, microbreakWins, 'mini')
  log.info(`Stretchly: finishing Mini break (shouldPlanNext: ${shouldPlanNext})`)
  if (shouldPlanNext) {
    breakPlanner.nextBreakAfterBreak()
  } else {
    breakPlanner.clear()
  }
  updateTray()
}

function finishBreak (shouldPlaySound = true, shouldPlanNext = true) {
  breakWins = breakComplete(shouldPlaySound, breakWins, 'long')
  log.info(`Stretchly: finishing Long break (shouldPlanNext: ${shouldPlanNext})`)
  if (shouldPlanNext) {
    breakPlanner.nextBreakAfterBreak()
  } else {
    breakPlanner.clear()
  }
  updateTray()
}

function postponeMicrobreak () {
  increaseDanger(1)
  microbreakWins = breakComplete(false, microbreakWins, 'mini')
  breakPlanner.postponeCurrentBreak()
  log.info('Stretchly: postponing Mini break')
  updateTray()
}

function postponeBreak () {
  increaseDanger(1)
  breakWins = breakComplete(false, breakWins, 'long')
  breakPlanner.postponeCurrentBreak()
  log.info('Stretchly: postponing Long break')
  updateTray()
}

function skipToMicrobreak (delay) {
  if (microbreakWins) {
    increaseDanger(1)
    microbreakWins = breakComplete(false, microbreakWins)
  }
  if (breakWins) {
    increaseDanger(2)
    breakWins = breakComplete(false, breakWins)
  }
  if (delay) {
    breakPlanner.skipToMicrobreak(delay)
    log.info(`Stretchly: skipping to Mini break in ${delay}ms`)
  } else {
    breakPlanner.skipToMicrobreak()
    log.info('Stretchly: skipping to Mini break')
  }
  updateTray()
}

function skipToBreak (delay) {
  if (microbreakWins) {
    increaseDanger(1)
    microbreakWins = breakComplete(false, microbreakWins)
  }
  if (breakWins) {
    increaseDanger(2)
    breakWins = breakComplete(false, breakWins)
  }
  if (delay) {
    breakPlanner.skipToBreak(delay)
    log.info(`Stretchly: skipping to Long break in ${delay}ms`)
  } else {
    breakPlanner.skipToBreak()
    log.info('Stretchly: skipping to Long break')
  }
  updateTray()
}

function startLastBreakAgain () {
  if (!lastBreak) {
    log.info('Stretchly: no last break to start again')
    return
  }
  if (microbreakWins || breakWins) {
    log.info('Stretchly: not starting last break again, a break is running')
    return
  }
  if (breakPlanner.isPaused || breakPlanner.dndManager.isOnDnd || breakPlanner.appExclusionsManager.isSchedulerCleared) {
    log.info('Stretchly: not starting last break again, breaks are paused')
    return
  }
  nextIdea = lastBreak.idea
  if (lastBreak.type === 'mini') {
    skipToMicrobreak()
  } else {
    skipToBreak()
  }
}

function resetBreaks () {
  if (microbreakWins) {
    microbreakWins = breakComplete(false, microbreakWins)
  }
  if (breakWins) {
    breakWins = breakComplete(false, breakWins)
  }
  danger = 0
  log.info(`Stretchly: danger reset to ${danger}`)
  breakPlanner.reset()
  log.info('Stretchly: resetting breaks')
  updateTray()
}

function calculateBackgroundColor (color) {
  let opacityMultiplier = 1
  if (settings.get('transparentMode')) {
    opacityMultiplier = settings.get('opacity')
  }
  return color + Math.round(opacityMultiplier * 255).toString(16).padStart(2, '0')
}

function loadIdeas () {
  let longBreakIdeasData
  let miniBreakIdeasData
  if (settings.get('useIdeasFromSettings')) {
    longBreakIdeasData = settings.get('breakIdeas')
    miniBreakIdeasData = settings.get('microbreakIdeas')
    log.info('Stretchly: loading custom break ideas from preferences file')
  } else {
    const t = i18next.getFixedT('en')
    miniBreakIdeasData = Object.keys(t('miniBreakIdeas',
      { returnObjects: true }))
      .map((item) => {
        return { data: i18next.t(`miniBreakIdeas.${item}.text`), enabled: true }
      })

    longBreakIdeasData = Object.keys(t('longBreakIdeas',
      { returnObjects: true }))
      .map((item) => {
        return { data: [i18next.t(`longBreakIdeas.${item}.title`), i18next.t(`longBreakIdeas.${item}.text`)], enabled: true }
      })
    log.info('Stretchly: loading default break ideas')
  }

  breakIdeas = new IdeasLoader(longBreakIdeasData).ideas()
  microbreakIdeas = new IdeasLoader(miniBreakIdeasData).ideas()
}

function pauseBreaks (milliseconds) {
  if (microbreakWins) {
    increaseDanger(1)
    finishMicrobreak(false)
  }
  if (breakWins) {
    increaseDanger(2)
    finishBreak(false)
  }
  breakPlanner.pause(milliseconds)
  log.info(`Stretchly: pausing breaks for ${milliseconds}ms`)
  updateTray()
}

const SESSION_ADJUST_MS = 5 * 60 * 1000
let trayMenuPosition = null

function reopenTrayMenu () {
  if (!appIcon || !settings.get('trayMenuStaysOpen')) return
  const position = trayMenuPosition ?? screen.getCursorScreenPoint()
  setTimeout(() => {
    appIcon?.popUpContextMenu(Menu.buildFromTemplate(getTrayMenuTemplate()), position)
  }, 100)
}

function changeWorkSession (milliseconds) {
  if (breakPlanner.adjustWorkSession(milliseconds)) {
    log.info(`Stretchly: ${milliseconds < 0 ? 'shortening' : 'extending'} the next work session by ${Math.abs(milliseconds) / 60000} minutes`)
  }
  updateTray()
}

function adjustWorkSession (milliseconds) {
  changeWorkSession(milliseconds)
  reopenTrayMenu()
}

let trayPanel = null

function usesTrayPanel () {
  return settings.get('trayPanel')
}

function getTrayPanel () {
  trayPanel ??= new TrayPanel({
    pagePath: join(__dirname, '/tray-panel.html'),
    preloadPath: join(__dirname, './tray-panel-preload.mjs'),
    getState: trayPanelState,
    onAction: handleTrayPanelAction
  })
  return trayPanel
}

function trayPanelState () {
  const reference = breakPlanner.scheduler?.reference
  const scheduled = Boolean(reference?.startsWith('start'))
  const pauseDurations = settings.get('pauseDurations')
  return buildTrayPanelState({
    t: (key, options) => i18next.t(key, options),
    formatDuration: (milliseconds) => humanizeDuration(milliseconds, {
      round: true,
      delimiter: ' ',
      language: i18next.language.replace('-', '_'),
      fallbacks: ['en'],
      units: ['d', 'h', 'm']
    }),
    statusLines: new StatusMessages({
      breakPlanner,
      settings,
      i18next,
      humanizeDuration
    }).panelLines,
    meeting: breakPlanner.meetingManager.isInMeeting
      ? { apps: breakPlanner.meetingManager.meetingApps, waiting: Boolean(breakPlanner.deferredBreakEvent) }
      : null,
    locked: isTrayMenuLocked(),
    newVersion: !settings.get('disableAppUpdateFeatures') && Boolean(global.isNewVersion),
    paused: breakPlanner.isPaused,
    canAct: !(breakPlanner.isPaused || breakPlanner.dndManager.isOnDnd || breakPlanner.appExclusionsManager.isSchedulerCleared),
    hasMicrobreak: settings.get('microbreak'),
    hasBreak: settings.get('break'),
    singleBreakType: settings.get('singleBreakType'),
    canAdjust: scheduled,
    timeToNextBreak: scheduled ? breakPlanner.timeToNextBreak : null,
    countdownRunning: scheduled && !breakPlanner.scheduler.held,
    sessionStepMinutes: SESSION_ADJUST_MS / 60000,
    pauseDurations: Array.isArray(pauseDurations) ? pauseDurations : [],
    pauseUntilMorning: settings.get('pauseUntilMorningOption'),
    pauseIndefinitely: settings.get('pauseIndefinitelyOption'),
    idleEnabled: settings.get('naturalBreaks'),
    contributor: Boolean(global.isContributor),
    themeColor: settings.get('trayPanelThemeColor') ? settings.get('mainColor') : null,
    countdownColor: countdownColor(settings)
  })
}

function handleTrayPanelAction (action) {
  if (action?.type === 'close') {
    trayPanel.hide()
    return
  }
  if (isTrayMenuLocked()) return
  const hideAfter = () => trayPanel.hide()
  switch (action?.type) {
    case 'adjust':
      changeWorkSession(action.direction === 'shorten' ? -SESSION_ADJUST_MS : SESSION_ADJUST_MS)
      break
    case 'startMicrobreak':
      hideAfter()
      skipToMicrobreak()
      break
    case 'startBreak':
      hideAfter()
      skipToBreak()
      break
    case 'pause':
      if ((settings.get('pauseDurations') || []).includes(action.minutes)) pauseBreaks(action.minutes * 60 * 1000)
      break
    case 'pauseUntilMorning':
      pauseBreaks(new UntilMorning(settings).msToSunrise())
      break
    case 'pauseIndefinitely':
      pauseBreaks(1)
      break
    case 'resume':
      resumeBreaks(false)
      updateTray()
      break
    case 'reset':
      resetBreaks()
      break
    case 'toggleIdle':
      settings.set('naturalBreaks', Boolean(action.value))
      breakPlanner.setIdleReset(Boolean(action.value))
      updateTray()
      break
    case 'preferences':
      hideAfter()
      createPreferencesWindow()
      break
    case 'contributorPreferences':
      hideAfter()
      createContributorSettingsWindow()
      break
    case 'syncPreferences':
      hideAfter()
      createSyncPreferencesWindow()
      break
    case 'download':
      hideAfter()
      shell.openExternal('https://github.com/thisishappenin/stretchly/releases')
      break
    case 'quit':
      app.quit()
      break
  }
  trayPanel.refresh()
}

function resumeBreaks (notify = true) {
  if (breakPlanner.dndManager.isOnDnd) {
    log.info('Stretchly: not resuming breaks because in Do Not Disturb')
  } else {
    breakPlanner.resume()
    log.info('Stretchly: resuming breaks')
    if (notify) {
      showNotification(i18next.t('main.resumingBreaks'))
    }
  }
  updateTray()
}

function createPreferencesWindow () {
  if (preferencesWin) {
    preferencesWin.show()
    return
  }
  const modalPath = 'file://' + join(__dirname, '/preferences.html')
  const preferencesWidth = Math.min(1040, screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea.width - 40)
  preferencesWin = new BrowserWindow({
    autoHideMenuBar: true,
    show: false,
    backgroundThrottling: false,
    icon: windowIconPath(),
    width: preferencesWidth,
    height: 530,
    minWidth: 520,
    x: displayManager.getDisplayX(-1, preferencesWidth),
    y: displayManager.getDisplayY(-1, 530),
    backgroundColor: '#EDEDED',
    webPreferences: {
      preload: join(__dirname, './preferences-preload.mjs'),
      sandbox: false
    }
  })
  preferencesWin.webContents.loadURL(modalPath)
  preferencesWin.once('ready-to-show', () => {
    preferencesWin.center()
    preferencesWin.show()
  })
  preferencesWin.once('closed', () => {
    preferencesWin = null
  })
}

function updateTray () {
  if (process.platform === 'win32' && Date.now() - lastWindowsThemeCheck > 60000) refreshWindowsTheme()

  if (!appIcon && !settings.get('showTrayIcon')) {
    return
  }

  if (settings.get('showTrayIcon')) {
    if (!appIcon) {
      appIcon = new Tray(trayIconPath())
      appIcon.on('double-click', () => {
        createPreferencesWindow()
      })
      appIcon.on('click', (event, bounds) => {
        trayMenuPosition = screen.getCursorScreenPoint()
        if (usesTrayPanel()) {
          getTrayPanel().toggle(bounds?.width > 0 ? bounds : appIcon.getBounds())
        } else {
          appIcon.popUpContextMenu(Menu.buildFromTemplate(currentTrayMenuTemplate))
        }
      })
      appIcon.on('right-click', () => {
        trayMenuPosition = screen.getCursorScreenPoint()
        if (usesTrayPanel()) {
          trayPanel?.hide()
        }
      })
    }
    if (!trayUpdateIntervalObj) {
      trayUpdateIntervalObj = setInterval(updateTray, 10000)
    }

    updateToolTip()

    const newTrayIconPath = trayIconPath()
    if (newTrayIconPath !== currentTrayIconPath) {
      appIcon.setImage(newTrayIconPath)
      currentTrayIconPath = newTrayIconPath
    }

    const newTrayMenuTemplate = getTrayMenuTemplate()
    if (JSON.stringify(newTrayMenuTemplate) !== JSON.stringify(currentTrayMenuTemplate)) {
      appIcon.setContextMenu(Menu.buildFromTemplate(newTrayMenuTemplate))
      currentTrayMenuTemplate = newTrayMenuTemplate
    }
    trayPanel?.refresh()
  }
}

function isTrayMenuLocked () {
  return (breakPlanner.scheduler.reference === 'finishMicrobreak' && settings.get('microbreakStrictMode') &&
    !settings.get('showTrayMenuInStrictMode')) ||
    (breakPlanner.scheduler.reference === 'finishBreak' && settings.get('breakStrictMode') &&
    !settings.get('showTrayMenuInStrictMode'))
}

function getTrayMenuTemplate () {
  const trayMenu = []

  if (!settings.get('disableAppUpdateFeatures') && global.isNewVersion) {
    trayMenu.push({
      label: i18next.t('main.downloadLatestVersion'),
      click: function () {
        shell.openExternal('https://github.com/thisishappenin/stretchly/releases')
      }
    }, {
      type: 'separator'
    })
  }

  const statusMessage = new StatusMessages({
    breakPlanner,
    settings,
    i18next,
    humanizeDuration
  }).trayMessage

  if (statusMessage !== '') {
    const messages = statusMessage.split('\n')
    for (const index in messages) {
      trayMenu.push({
        label: messages[index],
        enabled: false
      })
    }

    trayMenu.push({
      type: 'separator'
    })
  }

  if (isTrayMenuLocked()) {
    // empty menu, we are in strict mode
    return trayMenu
  }

  const idle = !(breakPlanner.isPaused || breakPlanner.dndManager.isOnDnd || breakPlanner.appExclusionsManager.isSchedulerCleared)
  if (idle) {
    if (settings.get('microbreak')) {
      trayMenu.push({
        label: i18next.t(settings.get('singleBreakType') ? 'main.startSingleBreakNow' : 'main.startMicrobreakNow'),
        click: () => skipToMicrobreak()
      })
    }
    if (settings.get('break')) {
      trayMenu.push({
        label: i18next.t('main.startBreakNow'),
        click: () => skipToBreak()
      })
    }
    if (breakPlanner.scheduler?.reference?.startsWith('start')) {
      trayMenu.push({
        label: i18next.t('main.shortenWorkSession', { minutes: SESSION_ADJUST_MS / 60000 }),
        click: () => adjustWorkSession(-SESSION_ADJUST_MS)
      }, {
        label: i18next.t('main.extendWorkSession', { minutes: SESSION_ADJUST_MS / 60000 }),
        click: () => adjustWorkSession(SESSION_ADJUST_MS)
      })
    }
    if (settings.get('break') || settings.get('microbreak')) {
      trayMenu.push({ type: 'separator' })
    }
  }

  if (breakPlanner.isPaused) {
    trayMenu.push({
      label: i18next.t('main.resume'),
      click: function () {
        resumeBreaks(false)
        updateTray()
      }
    })
  } else if (idle) {
    const durationShortcuts = {
      30: 'pauseBreaksFor30MinutesShortcut',
      60: 'pauseBreaksFor1HourShortcut',
      120: 'pauseBreaksFor2HoursShortcut',
      300: 'pauseBreaksFor5HoursShortcut'
    }
    const pauseDurations = settings.get('pauseDurations')
    for (const minutes of Array.isArray(pauseDurations) ? pauseDurations : []) {
      const milliseconds = minutes * 60 * 1000
      trayMenu.push({
        label: i18next.t('main.pauseFor', {
          duration: humanizeDuration(milliseconds, {
            round: true,
            delimiter: ' ',
            language: i18next.language.replace('-', '_'),
            fallbacks: ['en'],
            units: ['d', 'h', 'm']
          })
        }),
        accelerator: (durationShortcuts[minutes] && settings.get(durationShortcuts[minutes])) || null,
        click: () => pauseBreaks(milliseconds)
      })
    }
    if (settings.get('pauseUntilMorningOption')) {
      trayMenu.push({
        label: i18next.t('main.pauseUntilMorning'),
        accelerator: settings.get('pauseBreaksUntilMorningShortcut') || null,
        click: () => pauseBreaks(new UntilMorning(settings).msToSunrise())
      })
    }
    if (settings.get('pauseIndefinitelyOption')) {
      trayMenu.push({
        label: i18next.t('main.pauseIndefinitely'),
        click: () => pauseBreaks(1)
      })
    }
    trayMenu.push({ type: 'separator' }, {
      label: i18next.t('main.resetBreaks'),
      click: resetBreaks
    })
  }

  trayMenu.push({
    type: 'separator'
  }, {
    label: i18next.t('main.resetWhenIdle'),
    type: 'checkbox',
    checked: settings.get('naturalBreaks'),
    click: (menuItem) => {
      settings.set('naturalBreaks', menuItem.checked)
      breakPlanner.setIdleReset(menuItem.checked)
      updateTray()
    }
  }, {
    type: 'separator'
  }, {
    label: i18next.t('main.preferences'),
    click: function () {
      createPreferencesWindow()
    }
  })

  if (global.isContributor) {
    trayMenu.push({
      label: i18next.t('main.contributorPreferences'),
      click: function () {
        createContributorSettingsWindow()
      }
    }, {
      label: i18next.t('main.syncPreferences'),
      click: function () {
        createSyncPreferencesWindow()
      }
    })
  }

  trayMenu.push({
    type: 'separator'
  }, {
    label: i18next.t('main.quitStretchly'),
    role: 'quit',
    click: function () {
      app.quit()
    }
  })

  return trayMenu
}

function updateToolTip () {
  const message = new StatusMessages({
    breakPlanner,
    settings,
    i18next,
    humanizeDuration
  }).tooltipMessage
  if (appIcon) {
    appIcon.setToolTip(message !== '' ? message : i18next.t('main.toolTipHeader'))
  }
}

function showNotification (text, duration = 5000) {
  if (settings.get('themedNotifications')) {
    showToast({ message: text, duration })
    return
  }
  processWin.webContents.send('show-notification',
    text,
    settings.get('silentNotifications')
  )
}

ipcMain.on('postpone-mini-break', function (event, source = 'button') {
  log.info(`Stretchly: postponement requested during Mini break (source: ${source})`)
  postponeMicrobreak()
})

ipcMain.on('postpone-long-break', function (event, source = 'button') {
  log.info(`Stretchly: postponement requested during Long break (source: ${source})`)
  postponeBreak()
})

ipcMain.on('finish-mini-break', function (event, shouldPlaySound, manualAwaiting, source = 'button') {
  log.info(`Stretchly: ${manualAwaiting ? 'finish' : 'skip'} requested during Mini break (source: ${source})`)
  if (manualAwaiting) {
    decreaseDanger(1)
  } else {
    increaseDanger(1)
  }
  finishMicrobreak(shouldPlaySound)
})

ipcMain.on('finish-long-break', function (event, shouldPlaySound, manualAwaiting, source = 'button') {
  log.info(`Stretchly: ${manualAwaiting ? 'finish' : 'skip'} requested during Long break (source: ${source})`)
  if (manualAwaiting) {
    decreaseDanger(2)
  } else {
    increaseDanger(2)
  }
  finishBreak(shouldPlaySound)
})

ipcMain.on('save-setting', function (event, key, value) {
  if (key === 'naturalBreaks') {
    breakPlanner.setIdleReset(value)
  }

  if (key === 'monitorDnd') {
    breakPlanner.doNotDisturb(value)
  }

  if (key === 'monitorMeetings') {
    breakPlanner.meetings(value)
  }

  if (key === 'singleBreakType') {
    settings.set('microbreak', true)
    settings.set('break', !value)
    if (value && breakPlanner.scheduler.reference?.startsWith('startBreak')) breakPlanner.reset()
  }

  if (key === 'language') {
    i18next.changeLanguage(value)
  }

  if (key === 'themeSource') {
    nativeTheme.themeSource = value
  }

  if (key === 'longBreakAudio') {
    settings.set('miniBreakAudio', value)
  }

  if (key === 'mainColor') {
    settings.set('miniBreakColor', value)
  }

  if (key === 'showTrayIcon') {
    settings.set('showTrayIcon', value)
    if (value) {
      updateTray()
    } else {
      clearInterval(trayUpdateIntervalObj)
      trayUpdateIntervalObj = null
      appIcon.destroy()
      appIcon = null
    }
  }

  if (key === 'openAtLogin') {
    autostartManager.setAutostartEnabled(value)
  }

  if (key === 'breakHealthMode' && !value) {
    danger = 0
    log.info('Stretchly: danger reset after disabling breakHealthMode')
  }

  const isBreakShortcut = Object.hasOwn(breakShortcuts, key)
  if (isBreakShortcut && settings.get(key)) {
    globalShortcut.unregister(settings.get(key))
  }

  settings.set(key, value)

  if (BREAK_PREVIEW_KEYS.includes(key)) {
    showBreakPreview(BREAK_PREVIEW_RESIZE_KEYS.includes(key))
  }

  if (isBreakShortcut && value) {
    setupBreak({
      name: key,
      shortcutText: value,
      settings,
      log,
      globalShortcut,
      breakPlanner,
      functions: shortcutFunctions()
    })
  }

  updateTray()
})

ipcMain.on('update-tray', function (event) {
  updateTray()
})

ipcMain.on('restore-defaults', (event) => {
  const dialogOpts = {
    type: 'question',
    title: i18next.t('main.restoreDefaults'),
    message: i18next.t('main.warning'),
    buttons: [i18next.t('main.continue'), i18next.t('main.cancel')]
  }
  dialog.showMessageBox(dialogOpts).then(async (returnValue) => {
    if (returnValue.response === 0) {
      log.info('Stretchly: restoring default settings')
      settings.store = Object.assign(defaultSettings, { isFirstRun: false, __internal__: settings.get('__internal__') })
      initialize(false)
      event.sender.reload()
    }
  })
})

ipcMain.on('play-sound', (event, sound) => {
  processWin.webContents.send('play-sound', sound, settings.get('volume'))
})

ipcMain.handle('show-debug', (event) => {
  const reference = breakPlanner.scheduler.reference
  const timeleft = formatTimeRemaining(
    breakPlanner.scheduler.timeLeft, settings.get('language'),
    i18next, humanizeDuration
  )
  const breaknumber = breakPlanner.breakNumber
  const postponesnumber = breakPlanner.postponesNumber
  const doNotDisturb = breakPlanner.dndManager.isOnDnd
  const settingsFile = settings.path
  const logsFile = log.transports.file.getFile().path
  const imagesFolder = join(app.getPath('userData'), 'images')
  const audioFolder = join(app.getPath('userData'), 'audio')
  return [
    reference,
    timeleft,
    breaknumber,
    postponesnumber,
    settingsFile,
    logsFile,
    doNotDisturb,
    imagesFolder,
    audioFolder
  ]
})

ipcMain.on('open-preferences', function (event) {
  createPreferencesWindow()
})

ipcMain.on('set-contributor', function (event) {
  const dir = app.getPath('userData')
  const contributorStampFile = `${dir}/stamp`
  writeFile(contributorStampFile, DateTime.now().toString(), () => { })
  global.isContributor = true
  log.info('Stretchly: Logged in. Thanks for your contributions!')
  if (preferencesWin) {
    preferencesWin.webContents.send('enable-contributor-preferences')
  }
  updateTray()
})

ipcMain.on('open-contributor-preferences', function () {
  createContributorSettingsWindow()
})

ipcMain.on('open-contributor-auth', function (event, provider) {
  if (myStretchlyWin) {
    myStretchlyWin.show()
    return
  }
  const myStretchlyUrl = `https://my.stretchly.net/app/v1?provider=${provider}`
  myStretchlyWin = new BrowserWindow({
    autoHideMenuBar: true,
    show: false,
    width: 1000,
    height: 700,
    icon: windowIconPath(),
    x: displayManager.getDisplayX(),
    y: displayManager.getDisplayY(),
    backgroundColor: 'whitesmoke',
    webPreferences: {
      preload: join(__dirname, './electron-bridge.mjs'),
      sandbox: false
    }
  })
  myStretchlyWin.webContents.loadURL(myStretchlyUrl)

  myStretchlyWin.once('closed', () => {
    myStretchlyWin = null
  })

  myStretchlyWin.once('ready-to-show', () => {
    myStretchlyWin.center()
    myStretchlyWin.show()
  })
})

ipcMain.on('open-sync-preferences', () => {
  createSyncPreferencesWindow()
})

ipcMain.handle('current-settings', (event) => {
  return { ...defaultSettings, ...settings.store }
})

ipcMain.handle('restore-remote-settings', (event, remoteSettings) => {
  log.info('Stretchly: restoring remote settings')
  settings.store = remoteSettings
  initialize(false)
})

ipcMain.handle('i18next-translate', (event, key, options) => {
  return i18next.t(key, options)
})

ipcMain.handle('i18next-dir', (event) => {
  return i18next.dir()
})

ipcMain.handle('settings-get', (event, key) => {
  return settings.get(key)
})

ipcMain.on('close-current-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.close()
  }
})

ipcMain.handle('get-window-bounds', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win.getBounds()
})

ipcMain.on('set-window-size', (event, width, height) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const { workAreaSize } = screen.getDisplayMatching(win.getBounds())
  win.setSize(width, Math.min(height, Math.round(workAreaSize.height * 0.9)))
})

ipcMain.handle('get-version', (event) => {
  return app.getVersion()
})

ipcMain.handle('resolve-local-image', (event, filename) => {
  const imagesPath = join(app.getPath('userData'), 'images')
  return resolveLocalImage(imagesPath, filename)
})

ipcMain.handle('resolve-local-audio', (event, filename) => {
  const audioPath = join(app.getPath('userData'), 'audio')
  return resolveLocalAudio(audioPath, filename)
})
