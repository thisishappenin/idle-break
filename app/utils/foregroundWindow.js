import log from 'electron-log/main.js'
import { spawn } from 'node:child_process'

const RESTART_DELAY = 10000

const FOREGROUND_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$cs = @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class Foreground {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static string Info() {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return "FOREGROUND||";
    var title = new StringBuilder(512);
    GetWindowText(h, title, 512);
    uint pid; GetWindowThreadProcessId(h, out pid);
    string name = "";
    try { name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch {}
    return "FOREGROUND|" + name + "|" + title.ToString().Replace("\\r", " ").Replace("\\n", " ");
  }
}
'@
Add-Type -TypeDefinition $cs
while ($true) {
  if (-not (Get-Process -Id __PARENT__ -ErrorAction SilentlyContinue)) { exit }
  try { $line = [Foreground]::Info() } catch { $line = 'ERROR|' + $_.Exception.Message }
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds __INTERVAL__
}
`

export function parseForeground (line) {
  if (!line.startsWith('FOREGROUND|')) return null
  const rest = line.slice('FOREGROUND|'.length)
  const separator = rest.indexOf('|')
  if (separator === -1) return null
  return { process: rest.slice(0, separator), title: rest.slice(separator + 1) }
}

export function matchForeground (patterns, foreground) {
  if (!foreground) return false
  const processName = foreground.process.toLowerCase()
  const title = foreground.title.toLowerCase()
  for (const pattern of patterns) {
    const wanted = pattern.trim().toLowerCase()
    if (wanted && (processName.includes(wanted) || title.includes(wanted))) return pattern.trim()
  }
  return false
}

export function watchForegroundWindow ({ interval, onChange }) {
  if (process.platform !== 'win32') return () => {}
  let child = null
  let restartTimer = null
  let stopped = false

  const start = () => {
    const script = FOREGROUND_SCRIPT
      .replace('__PARENT__', String(process.pid))
      .replace('__INTERVAL__', String(interval))
    const current = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')
    ], { windowsHide: true })
    child = current
    current.stdout.setEncoding('utf8')
    let buffered = ''
    current.stdout.on('data', chunk => {
      buffered += chunk
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop()
      for (const line of lines) {
        if (line.startsWith('ERROR|')) {
          log.error(`Stretchly: foreground window detection error: ${line.slice(6)}`)
          continue
        }
        const foreground = parseForeground(line)
        if (foreground) onChange(foreground)
      }
    })
    const restart = (reason) => {
      if (child !== current) return
      child = null
      onChange(null)
      if (stopped) return
      log.warn(`Stretchly: foreground window monitoring stopped (${reason}), restarting`)
      restartTimer = setTimeout(() => {
        restartTimer = null
        if (!stopped && !child) start()
      }, RESTART_DELAY)
    }
    current.on('error', error => restart(error.message))
    current.on('exit', code => restart(`exit code ${code}`))
  }

  start()
  return () => {
    stopped = true
    clearTimeout(restartTimer)
    restartTimer = null
    const current = child
    child = null
    current?.kill()
  }
}
