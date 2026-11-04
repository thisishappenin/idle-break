import VersionChecker from './utils/versionChecker.js'
import { setSameWidths } from './utils/sameWidths.js'
import acceleratorFromEvent from './utils/acceleratorFromEvent.js'
import { isLightColor } from './utils/colorContrast.js'
import { parsePauseDurations, formatPauseDurations } from './utils/pauseDurations.js'
import HtmlTranslate from './utils/htmlTranslate.js'

import './platform.js'

const versionChecker = new VersionChecker()
let eventsAttached = false
let themePreviewAttached = false
const liveSliders = ['breakWindowWidth', 'breakWindowHeight', 'opacity']

function updateTrayOptionVisibility () {
  const numberOnly = document.querySelector('#trayIconStyle').value === 'text' &&
    document.body.classList.contains('win32')
  document.querySelectorAll('.tray-number-only').forEach(row => row.classList.toggle('hidden', !numberOnly))
}

function updateCountdownColorControl () {
  for (const name of ['countdownColor', 'trayNumberColor']) {
    document.querySelector(`#${name}`).disabled = !document.querySelector(`#${name}Custom`).checked
  }
}

function updateThemePreview () {
  updateTrayOptionVisibility()
  updateCountdownColorControl()
}

window.onload = async (e) => {
  const bounds = await window.stretchly.getWindowBounds()
  const settings = await window.settings.currentSettings()
  if (settings.disableAppUpdateFeatures) {
    document.querySelector('#checkNewVersion').closest('div').classList.add('hidden')
  }

  if (settings.hideStrictModePreferences) {
    document.querySelectorAll('[data-strict-mode]').forEach(element => {
      element.classList.add('hidden')
    })
    document.querySelector('#enablePostponeLong').closest('div').style.marginBottom = '56px'
  }

  if (settings.hidePreferencesFileLocation) {
    document.querySelectorAll('[data-preferences-file]').forEach(element => {
      element.classList.add('hidden')
    })
  }

  new HtmlTranslate(document).translate()
  setWindowHeight()
  setTimeout(() => { eventsAttached = true }, 500)

  if (settings.customPreferencesMessage) {
    const customMessageDiv = document.createElement('div')
    customMessageDiv.className = 'custom-message'
    customMessageDiv.textContent = settings.customPreferencesMessage
    document.querySelector('.navigation').parentNode.insertBefore(customMessageDiv, document.querySelector('.navigation').nextSibling)
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    imagesWithDarkVersion.forEach(image => {
      // replace last occurance https://github.com/electron-userland/electron-builder/issues/5152
      const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
      image.src = newSource
    })
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    if (event.matches) {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
        image.src = newSource
      })
    } else {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace('-dark.', '.')
        image.src = newSource
      })
    }
  })

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  document.onkeydown = async event => {
    if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
      const [
        reference, timeleft, breaknumber,
        postponesnumber, settingsfile, logsfile, doNotDisturb, imagesfolder, audiofolder
      ] = await window.stretchly.showDebug()
      const debugInfo = document.querySelector('.debug > :first-child')
      if (!debugInfo.classList.contains('hidden')) {
        debugInfo.classList.add('hidden')
      } else {
        debugInfo.classList.remove('hidden')
        document.querySelector('#reference').innerHTML = reference
        document.querySelector('#timeleft').innerHTML = timeleft
        document.querySelector('#breakNumber').innerHTML = breaknumber
        document.querySelector('#postponesNumber').innerHTML = postponesnumber
        document.querySelector('#settingsfile').textContent = settingsfile
        document.querySelector('#logsfile').textContent = logsfile
        document.querySelector('#imagesfolder').textContent = imagesfolder
        document.querySelector('#audiofolder').textContent = audiofolder
        document.querySelector('#donotdisturb').innerHTML = doNotDisturb
        document.querySelector('#node').innerHTML = await window.runtime.node()
        document.querySelector('#chrome').innerHTML = await window.runtime.chrome()
        document.querySelector('#electron').innerHTML = await window.runtime.electron()
        document.querySelector('#platform').innerHTML = await window.runtime.platform()
        document.querySelector('#windowsPortable').innerHTML = await window.runtime.windowsPortable() || false
      }
      setWindowHeight()
    }
  }

  window.stretchly.onTranslate(async () => {
    new HtmlTranslate(document).translate()
    document.querySelectorAll('input[type="range"]').forEach(async range => {
      const settings = await window.settings.currentSettings()
      const divisor = range.dataset.divisor
      const output = range.closest('div').querySelector('output')
      range.value = settings[range.name] / divisor
      const unit = output.dataset.unit
      output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
      document.querySelector('#longBreakEvery').closest('div').querySelector('output')
        .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
    })
    setWindowHeight()
  })

  window.stretchly.onEnableContributorPreferences(() => {
    showContributorPreferencesButton()
  })

  const showContributorPreferencesButton = () => {
    document.querySelectorAll('.contributor').forEach((item) => {
      item.classList.remove('hidden')
    })
    document.querySelectorAll('.become').forEach((item) => {
      item.classList.add('hidden')
    })
    document.querySelectorAll('.authenticate').forEach((item) => {
      item.classList.add('hidden')
    })
    setWindowHeight()
  }

  if (await window.global.getValue('isContributor')) {
    showContributorPreferencesButton()
  }

  document.querySelector('[name="contributorPreferences"]').onclick = (event) => {
    event.preventDefault()
    window.stretchly.openContributorPreferences()
  }

  document.querySelector('[name="syncPreferences"]').onclick = (event) => {
    event.preventDefault()
    window.stretchly.openSyncPreferences()
  }

  document.querySelector('.debug button').onclick = async (event) => {
    event.preventDefault()
    const toCopy = document.querySelector('#to-copy')
    await navigator.clipboard.writeText(toCopy.textContent)
    const copiedEl = document.createElement('span')
    copiedEl.innerHTML = ' copied!'
    event.target.parentNode.appendChild(copiedEl)
    setTimeout(() => copiedEl.remove(), 1275)
  }

  document.querySelectorAll('.navigation a').forEach(element => {
    element.onclick = event => {
      event.preventDefault()
      event.target.closest('.navigation').childNodes.forEach(link => {
        if (link.classList) {
          link.classList.remove('active')
        }
      })
      event.target.closest('a').classList.add('active')

      const toBeDisplayed = document.querySelector(`.${event.target.closest('[data-section]').getAttribute('data-section')}`)
      document.querySelectorAll('body > div:not(.custom-message)').forEach(section => {
        if (section !== toBeDisplayed) {
          section.classList.add('hidden')
        } else {
          section.classList.remove('hidden')
        }
      })

      setSameWidths()
      setWindowHeight()
    }
  })

  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    const isNegative = checkbox.classList.contains('negative')
    checkbox.checked = isNegative ? !settings[checkbox.value] : settings[checkbox.value]
    if (!eventsAttached) {
      checkbox.onchange = (event) =>
        window.settings.saveSettings(checkbox.value,
          isNegative ? !checkbox.checked : checkbox.checked)
    }
  })

  const customColorRadio = document.querySelector('#customColorRadio')
  const customColorPicker = document.querySelector('#customColor')
  customColorRadio.value = settings.customColor
  customColorPicker.value = settings.customColor
  customColorRadio.nextElementSibling.style.setProperty('--custom-color', settings.customColor)
  customColorRadio.nextElementSibling.style.setProperty('--custom-check', isLightColor(settings.customColor) ? '#000000' : '#ffffff')
  if (!eventsAttached) {
    customColorRadio.onclick = () => customColorPicker.click()
    customColorPicker.onchange = (event) => {
      window.settings.saveSettings('customColor', event.target.value)
      window.settings.saveSettings('mainColor', event.target.value)
    }
  }

  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    let value
    switch (radio.value) {
      case 'true':
        value = true
        break
      case 'false':
        value = false
        break
      default:
        value = radio.value
    }
    radio.checked = settings[radio.name] === value
    if (!eventsAttached) {
      radio.onchange = (event) => {
        window.settings.saveSettings(radio.name, value)
      }
    }
  })

  document.querySelector('#language').value = settings.language
  if (!eventsAttached) {
    document.querySelector('#language').onchange = (event) => {
      window.settings.saveSettings('language', event.target.value)
    }
  }

  document.querySelectorAll('select[data-setting]').forEach(select => {
    select.value = settings[select.name]
    if (!eventsAttached) {
      select.onchange = () => window.settings.saveSettings(select.name, select.value)
    }
  })

  const singleBreakType = document.querySelector('#singleBreakType')
  singleBreakType.value = String(settings.singleBreakType)
  await applyBreakType(settings.singleBreakType)
  if (!eventsAttached) {
    singleBreakType.onchange = async () => {
      const single = singleBreakType.value === 'true'
      window.settings.saveSettings('singleBreakType', single)
      document.querySelector('#enableMiniBreaks').checked = true
      document.querySelector('#enableLongBreaks').checked = !single
      await applyBreakType(single)
    }
  }

  const ignoredApps = document.querySelector('#monitorMeetingsIgnoreApps')
  ignoredApps.value = settings.monitorMeetingsIgnoreApps.join(', ')
  if (!eventsAttached) {
    ignoredApps.onchange = () => {
      const apps = ignoredApps.value.split(',').map(app => app.trim()).filter(Boolean)
      ignoredApps.value = apps.join(', ')
      window.settings.saveSettings('monitorMeetingsIgnoreApps', apps)
    }
  }

  const pauseWhileUsing = document.querySelector('#pauseWhileUsing')
  pauseWhileUsing.value = (settings.pauseWhileUsing ?? []).join(', ')
  if (!eventsAttached) {
    pauseWhileUsing.onchange = () => {
      const entries = pauseWhileUsing.value.split(',').map(entry => entry.trim()).filter(Boolean)
      pauseWhileUsing.value = entries.join(', ')
      window.settings.saveSettings('pauseWhileUsing', entries)
    }
  }

  const pauseDurations = document.querySelector('#pauseDurations')
  pauseDurations.value = formatPauseDurations(settings.pauseDurations)
  if (!eventsAttached) {
    pauseDurations.onchange = () => {
      const minutes = parsePauseDurations(pauseDurations.value)
      pauseDurations.value = formatPauseDurations(minutes)
      window.settings.saveSettings('pauseDurations', minutes)
    }
  }

  document.querySelectorAll('.shortcut-input[readonly]').forEach(input => {
    input.value = settings[input.name]
    if (!eventsAttached) {
      input.onkeydown = (event) => {
        event.preventDefault()
        if (event.key === 'Backspace' || event.key === 'Delete') {
          input.value = ''
          window.settings.saveSettings(input.name, '')
          return
        }
        const accelerator = acceleratorFromEvent(event)
        if (accelerator) {
          input.value = accelerator
          window.settings.saveSettings(input.name, accelerator)
        }
      }
    }
  })

  document.querySelectorAll('input[type="range"]').forEach(async range => {
    const divisor = range.dataset.divisor
    const output = range.closest('div').querySelector('output')
    range.value = settings[range.name] / divisor
    const unit = output.dataset.unit
    output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
    document.querySelector('#longBreakEvery').closest('div').querySelector('output')
      .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
    if (!eventsAttached) {
      range.onchange = async event => {
        output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
        document.querySelector('#longBreakEvery').closest('div').querySelector('output')
          .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
        window.settings.saveSettings(range.name, range.value * divisor)
      }
      range.oninput = async event => {
        if (liveSliders.includes(range.name)) window.settings.saveSettings(range.name, range.value * divisor)
        output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
        document.querySelector('#longBreakEvery').closest('div').querySelector('output')
          .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
      }
    }
  })

  for (const name of ['countdownColor', 'trayNumberColor']) {
    const picker = document.querySelector(`#${name}`)
    picker.value = settings[name]
    if (!eventsAttached) {
      picker.onchange = (event) => window.settings.saveSettings(name, event.target.value)
    }
  }
  updateThemePreview()
  if (!themePreviewAttached) {
    themePreviewAttached = true
    document.querySelector('#previewPopup').onclick = () => window.stretchly.previewBreak()
    document.addEventListener('input', updateThemePreview)
    document.addEventListener('change', updateThemePreview)
  }

  document.querySelectorAll('.sounds img').forEach(preview => {
    if (!eventsAttached) {
      preview.onclick = (event) =>
        window.stretchly.playSound(preview.closest('div').querySelector('input').value)
    }
  })

  setWindowHeight()

  document.querySelectorAll('.enabletype').forEach((element) => {
    element.onclick = async (event) => {
      const enabletypeChecked = document.querySelectorAll('.enabletype:checked')
      if (enabletypeChecked.length === 0) {
        element.checked = true
        window.settings.saveSettings(element.value, element.checked)
        window.alert(await window.i18next.t('preferences.schedule.cantDisableBoth'))
      }
    }
  })

  document.querySelector('#restoreDefaults').onclick = (event) => {
    window.stretchly.restoreDefaults()
  }

  document.querySelectorAll('.about a').forEach((item) => {
    item.onclick = (event) => {
      event.preventDefault()
      if (event.target.classList.contains('file')) {
        window.electronApi.openPath(event.target.textContent)
      } else {
        window.electronApi.openExternal(event.target.href)
      }
    }
  })

  document.querySelector('[name="becomeContributor"]').onclick = () => {
    window.electronApi.openExternal('https://hovancik.net/stretchly/sponsor')
  }

  document.querySelector('[name="alreadyContributor"]').onclick = () => {
    document.querySelectorAll('.become').forEach((item) => {
      item.classList.add('hidden')
    })
    document.querySelectorAll('.authenticate').forEach((item) => {
      item.classList.remove('hidden')
    })
    setWindowHeight()
  }

  document.querySelectorAll('.authenticate a').forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault()
      window.stretchly.openContributorAuth(button.dataset.provider)
    }
  })

  document.querySelector('.version').innerHTML = await window.stretchly.getVersion()
  if (!settings.disableAppUpdateFeatures) {
    versionChecker.latest()
      .then(version => {
        document.querySelector('.latestVersion').innerHTML = version.replace('v', '')
      })
      .catch(exception => {
        console.error(exception)
        document.querySelector('.latestVersion').innerHTML = 'N/A'
      })
  }

  function setWindowHeight () {
    const classes = document.querySelector('body').classList
    const scrollHeight = document.querySelector('body').scrollHeight
    const availHeight = window.screen.availHeight
    let height = null
    if (classes.contains('win32')) {
      if (scrollHeight + 40 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 40
      }
    } else {
      if (scrollHeight + 32 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 32
      }
    }
    if (height) {
      window.stretchly.setWindowSize(bounds.width, height)
    }
  }

  function realBreakInterval () {
    const microbreakInterval = document.querySelector('#miniBreakEvery').value * 1
    const breakInterval = document.querySelector('#longBreakEvery').value * 1
    return microbreakInterval * (breakInterval + 1)
  }
}

async function applyBreakType (single) {
  document.body.classList.toggle('single-break-type', single)
  for (const element of document.querySelectorAll('[data-i18next-single]')) {
    element.dataset.i18nextMulti ??= element.dataset.i18next
    element.dataset.i18next = single ? element.dataset.i18nextSingle : element.dataset.i18nextMulti
    element.innerHTML = await window.i18next.t(element.dataset.i18next)
  }
}
