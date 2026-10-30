const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)$/

const NAMED_KEYS = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'"
}

function keyName (code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return NAMED_KEYS[code] ?? null
}

export default function acceleratorFromEvent ({ code, ctrlKey, metaKey, altKey, shiftKey }) {
  if (MODIFIER_CODES.test(code)) return null
  const key = keyName(code)
  if (!key || !(ctrlKey || metaKey || altKey)) return null
  const modifiers = []
  if (ctrlKey || metaKey) modifiers.push('CmdOrCtrl')
  if (altKey) modifiers.push('Alt')
  if (shiftKey) modifiers.push('Shift')
  return [...modifiers, key].join('+')
}
