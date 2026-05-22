import { describe, it, expect } from 'vitest'
import { getInitials, avatarColor, truncate } from './string'

describe('getInitials', () => {
  it('returns ? for null', () => expect(getInitials(null)).toBe('?'))
  it('returns single initial for one-word name', () => expect(getInitials('Alice')).toBe('A'))
  it('returns first + last initials for multi-word name', () => expect(getInitials('Alice Bob')).toBe('AB'))
  it('handles extra spaces', () => expect(getInitials('  Alice   Bob  ')).toBe('AB'))
})

describe('avatarColor', () => {
  it('returns a hex color', () => {
    const c = avatarColor('Alice')
    expect(c).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('returns deterministic colors', () => {
    expect(avatarColor('Alice')).toBe(avatarColor('Alice'))
  })

  it('falls back for null', () => {
    expect(avatarColor(null)).toMatch(/^#/)
  })
})

describe('truncate', () => {
  it('does not truncate short strings', () => expect(truncate('hello', 10)).toBe('hello'))
  it('truncates and adds ellipsis', () => expect(truncate('hello world', 6)).toBe('hello…'))
})
