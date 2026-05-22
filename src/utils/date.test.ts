import { describe, it, expect } from 'vitest'
import { formatDate, isOverdue, getDateCategory } from './date'

describe('formatDate', () => {
  it('returns empty string for nullish input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('')).toBe('')
  })

  it('formats a valid date string', () => {
    expect(formatDate('2025-01-15')).toMatch(/Jan 15, 2025/)
  })
})

describe('isOverdue', () => {
  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false)
  })

  it('returns true for a past date', () => {
    expect(isOverdue('2020-01-01')).toBe(true)
  })

  it('returns false for a future date', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(isOverdue(future.toISOString().split('T')[0])).toBe(false)
  })
})

describe('getDateCategory', () => {
  it('returns noDate for null', () => {
    expect(getDateCategory(null)).toBe('noDate')
  })

  it('returns delayed for past dates', () => {
    expect(getDateCategory('2020-01-01')).toBe('delayed')
  })

  it('returns upcoming for far future dates', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(getDateCategory(future.toISOString().split('T')[0])).toBe('upcoming')
  })
})
