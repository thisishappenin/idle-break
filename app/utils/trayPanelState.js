export function buildTrayPanelState ({
  t,
  formatDuration,
  statusLines,
  locked,
  newVersion,
  paused,
  canAct,
  hasMicrobreak,
  hasBreak,
  singleBreakType,
  canAdjust,
  timeToNextBreak,
  countdownRunning,
  sessionStepMinutes,
  pauseDurations,
  pauseUntilMorning,
  pauseIndefinitely,
  idleEnabled,
  contributor,
  meeting,
  themeColor
}) {
  const start = []
  if (!locked && canAct && hasMicrobreak) {
    start.push({ type: 'startMicrobreak', label: t(singleBreakType ? 'main.startSingleBreakNow' : 'main.startMicrobreakNow') })
  }
  if (!locked && canAct && hasBreak) {
    start.push({ type: 'startBreak', label: t('main.startBreakNow') })
  }

  const canPause = !locked && canAct && !paused
  return {
    locked,
    newVersion: !locked && newVersion,
    themeColor: themeColor || null,
    meeting: !locked && meeting ? { apps: meeting.apps, waiting: Boolean(meeting.waiting) } : null,
    status: statusLines,
    countdown: {
      ms: Number.isFinite(timeToNextBreak) ? timeToNextBreak : null,
      running: Boolean(countdownRunning)
    },
    adjust: !locked && canAdjust
      ? { step: sessionStepMinutes, shorten: t('main.shortenWorkSession', { minutes: sessionStepMinutes }), extend: t('main.extendWorkSession', { minutes: sessionStepMinutes }) }
      : null,
    start,
    paused: !locked && paused,
    pause: canPause
      ? {
          options: pauseDurations.map(minutes => ({
            minutes,
            label: t('main.pauseFor', { duration: formatDuration(minutes * 60 * 1000) }),
            short: minutes >= 60 && minutes % 60 === 0
              ? t('main.trayPanelHours', { hours: minutes / 60 })
              : t('main.trayPanelMinutes', { minutes })
          })),
          morning: Boolean(pauseUntilMorning),
          indefinitely: Boolean(pauseIndefinitely)
        }
      : null,
    reset: canPause,
    idle: locked ? null : { enabled: Boolean(idleEnabled) },
    contributor: !locked && Boolean(contributor),
    labels: {
      inMeeting: t('statusMessages.inMeeting'),
      nextBreakIn: t('main.trayPanelNextBreakIn'),
      workSession: t('main.trayPanelWorkSession'),
      thisSessionOnly: t('main.trayPanelThisSessionOnly'),
      minutes: t('main.trayPanelMinutes', { minutes: '%d' }),
      pause: t('main.trayPanelPause'),
      pauseUntilMorning: t('main.pauseUntilMorning'),
      pauseIndefinitely: t('main.pauseIndefinitely'),
      resume: t('main.resume'),
      resetBreaks: t('main.resetBreaks'),
      resetWhenIdle: t('main.resetWhenIdle'),
      preferences: t('main.preferences'),
      contributorPreferences: t('main.contributorPreferences'),
      syncPreferences: t('main.syncPreferences'),
      quit: t('main.quitStretchly'),
      download: t('main.downloadLatestVersion')
    }
  }
}
