import { describe, it } from 'vitest'
import { expect } from 'chai'
import { parseEntryList, formatEntryList } from '../app/utils/entryList.js'

describe('entryList', () => {
  it('reads one entry per line', () => {
    expect(parseEntryList('Youtube\nreddit\netc')).to.deep.equal(['Youtube', 'reddit', 'etc'])
  })

  it('trims, drops blank lines and handles Windows line endings', () => {
    expect(parseEntryList('  Youtube \r\n\r\n reddit\r\n')).to.deep.equal(['Youtube', 'reddit'])
  })

  it('also accepts commas, so a pasted comma separated list still works', () => {
    expect(parseEntryList('Youtube, reddit\nnetflix')).to.deep.equal(['Youtube', 'reddit', 'netflix'])
  })

  it('removes duplicates ignoring case and keeps the first spelling', () => {
    expect(parseEntryList('YouTube\nyoutube\nYOUTUBE\nreddit')).to.deep.equal(['YouTube', 'reddit'])
  })

  it('gives an empty list for empty text', () => {
    expect(parseEntryList('')).to.deep.equal([])
    expect(parseEntryList(' \n ,')).to.deep.equal([])
  })

  it('puts the cursor on a fresh line after the existing entries', () => {
    expect(formatEntryList(['Youtube', 'reddit'])).to.equal('Youtube\nreddit\n')
    expect(formatEntryList([])).to.equal('')
  })
})
