import EventEmitter from 'events'
import log from 'electron-log/main.js'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const RESTART_DELAY = 10000
const MICROPHONE_CONSENT_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone'

const SESSION_SCRIPT = `
$cs = @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class CapSessions {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator { int EnumAudioEndpoints(int flow, int mask, out IMMDeviceCollection c); }
  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection { int GetCount(out uint n); int Item(uint i, out IMMDevice d); }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice { int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 { int a(); int b(); int GetSessionEnumerator(out IAudioSessionEnumerator e); }
  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator { int GetCount(out int n); int GetSession(int i, out IAudioSessionControl2 s); }
  [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    int GetState(out int s); int GetDisplayName(out IntPtr n); int SetDisplayName(IntPtr n, ref Guid c); int GetIconPath(out IntPtr p); int SetIconPath(IntPtr p, ref Guid c);
    int GetGroupingParam(out Guid g); int SetGroupingParam(ref Guid g, ref Guid c); int RegisterAudioSessionNotification(IntPtr n); int UnregisterAudioSessionNotification(IntPtr n);
    int GetSessionIdentifier(out IntPtr id); int GetSessionInstanceIdentifier(out IntPtr id); int GetProcessId(out uint pid); int IsSystemSoundsSession(); int SetDuckingPreference(bool b);
  }
  public static string Active() {
    var names = new HashSet<string>();
    var en = (IMMDeviceEnumerator)new Enumerator();
    IMMDeviceCollection col; en.EnumAudioEndpoints(1, 1, out col);
    uint n; col.GetCount(out n);
    for (uint i = 0; i < n; i++) {
      IMMDevice dev; col.Item(i, out dev);
      Guid iid = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"); object o; dev.Activate(ref iid, 23, IntPtr.Zero, out o);
      IAudioSessionEnumerator se; ((IAudioSessionManager2)o).GetSessionEnumerator(out se);
      int c; se.GetCount(out c);
      for (int j = 0; j < c; j++) {
        IAudioSessionControl2 sc; se.GetSession(j, out sc);
        int st; sc.GetState(out st); uint pid; sc.GetProcessId(out pid);
        if (st != 1 || pid == 0) continue;
        try { names.Add(System.Diagnostics.Process.GetProcessById((int)pid).ProcessName); } catch {}
      }
    }
    return string.Join(",", names);
  }
}
'@
Add-Type -TypeDefinition $cs
while ($true) {
  if (-not (Get-Process -Id __PARENT__ -ErrorAction SilentlyContinue)) { exit }
  try { $line = 'ACTIVE|' + [CapSessions]::Active() } catch { $line = 'ERROR|' + $_.Exception.Message }
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds __INTERVAL__
}
`

export function isMicrophoneInUse (regOutput) {
  let start = 0n
  let stop = 0n
  const flush = () => start > stop
  let inUse = false
  for (const line of regOutput.split(/\r?\n/)) {
    if (line.startsWith('HKEY_')) {
      inUse = inUse || flush()
      start = 0n
      stop = 0n
      continue
    }
    const match = line.match(/^\s*LastUsedTime(Start|Stop)\s+REG_QWORD\s+(0x[0-9a-fA-F]+)/)
    if (!match) continue
    if (match[1] === 'Start') start = BigInt(match[2])
    else stop = BigInt(match[2])
  }
  return inUse || flush()
}

export function meetingApps (line, ignoredApps = []) {
  if (!line.startsWith('ACTIVE|')) return []
  const ignored = ignoredApps.map(app => app.toLowerCase())
  return line.slice('ACTIVE|'.length).split(',')
    .map(name => name.trim())
    .filter(Boolean)
    .filter(name => !ignored.some(app => name.toLowerCase().includes(app)))
}

export function hasMeetingSession (line, ignoredApps = []) {
  return meetingApps(line, ignoredApps).length > 0
}

class MeetingManager extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.monitorMeetings = settings.get('monitorMeetings')
    this.monitorMeetingsCheckInterval = settings.get('monitorMeetingsCheckInterval')
    this.timer = null
    this.sessionProcess = null
    this.isInMeeting = false
    this.meetingApps = []
    this._errorLogged = false
    if (this.monitorMeetings) {
      this.start()
    }
  }

  start () {
    if (this.timer || this.sessionProcess || this.restartTimer) return
    this.monitorMeetings = true
    if (process.platform === 'win32') {
      this._watchAudioSessions()
    } else {
      this._checkMeeting()
    }
    log.info('Stretchly: starting meeting monitoring')
  }

  stop () {
    if (!this.timer && !this.sessionProcess && !this.monitorMeetings) return
    const wasInMeeting = this.isInMeeting
    this.monitorMeetings = false
    this.isInMeeting = false
    this.meetingApps = []
    clearInterval(this.timer)
    clearTimeout(this.restartTimer)
    this.restartTimer = null
    this.timer = null
    this.sessionProcess?.kill()
    this.sessionProcess = null
    log.info('Stretchly: stopping meeting monitoring')
    if (wasInMeeting) this.emit('meetingFinished')
  }

  _setInMeeting (inMeeting) {
    if (!this.isInMeeting && inMeeting) {
      this.isInMeeting = true
      this.emit('meetingStarted')
    } else if (this.isInMeeting && !inMeeting) {
      this.isInMeeting = false
      this.emit('meetingFinished')
    }
  }

  _watchAudioSessions () {
    const script = SESSION_SCRIPT
      .replace('__PARENT__', String(process.pid))
      .replace('__INTERVAL__', String(this.monitorMeetingsCheckInterval))
    const child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')
    ], { windowsHide: true })
    this.sessionProcess = child
    let heardFrom = false
    let buffered = ''
    child.stdout.on('data', chunk => {
      buffered += chunk
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop()
      for (const line of lines) {
        if (line.startsWith('ERROR|')) {
          log.error(`Stretchly: meeting detection error: ${line.slice(6)}`)
          continue
        }
        heardFrom = true
        const ignored = this.settings.get('monitorMeetingsIgnoreApps') ?? []
        const apps = meetingApps(line, ignored)
        if (apps.length && !this.isInMeeting) log.info(`Stretchly: microphone in use by ${apps.join(', ')}`)
        this.meetingApps = apps
        this._setInMeeting(apps.length > 0)
      }
    })
    const fallBack = (reason) => {
      if (this.sessionProcess !== child) return
      this.sessionProcess = null
      if (!this.monitorMeetings) return
      log.warn(`Stretchly: audio session monitoring unavailable (${reason}), checking the registry instead`)
      this._checkMeeting()
    }
    child.on('error', e => fallBack(e.message))
    child.on('exit', code => {
      if (!heardFrom) return fallBack(`exit code ${code}`)
      if (this.sessionProcess !== child) return
      this.sessionProcess = null
      if (!this.monitorMeetings) return
      log.warn(`Stretchly: audio session monitoring exited (code ${code}), restarting`)
      this._setInMeeting(false)
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null
        if (this.monitorMeetings && !this.sessionProcess) this._watchAudioSessions()
      }, RESTART_DELAY)
    })
  }

  async _microphoneInUse () {
    if (process.platform !== 'win32') return false
    try {
      const { stdout } = await promisify(execFile)('reg', ['query', MICROPHONE_CONSENT_KEY, '/s'], { windowsHide: true })
      return isMicrophoneInUse(stdout)
    } catch (e) {
      if (!this._errorLogged) {
        log.error('Stretchly: meeting detection error:', e)
        this._errorLogged = true
      }
      return false
    }
  }

  _checkMeeting () {
    this.timer = setInterval(async () => {
      const inMeeting = await this._microphoneInUse()
      if (!this.timer) return
      this._setInMeeting(inMeeting)
    }, this.monitorMeetingsCheckInterval)
  }
}

export default MeetingManager
